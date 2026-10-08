"""Responses API tool loop for the local study tutor."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from typing import Any, Callable

from bolprep import MAX_MODEL_ANSWER_CHARS, api_is_configured, checked_evidence, offline_answer, response_instructions, require_completed_response
from conversation_history import model_history, prior_queries
from progress import (
    ProgressConflict,
    create_quiz_run,
    get_progress,
    save_answer,
)
from quiz import QUIZ_PRESETS, score_answer, start_quiz
from retrieval import retrieval_query, retrieve


MAX_TOOL_CALLS = 6
MAX_TOOL_ROUNDS = 3
MAX_TOOL_ARGUMENT_CHARS = 16000

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "start_quiz",
        "description": "Start a short checked Fundamental Rights quiz. Basic selects Articles 14/21, challenge selects Articles 19/22 (each allows 1-2 questions); standard mixes the bank (1-3). These are author-assigned presets, not measured difficulty levels.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "enum": ["fundamental rights"]},
                "question_count": {"type": "integer", "enum": [1, 2, 3]},
                "language": {"type": "string", "enum": ["hi-IN", "en-IN"]},
                "difficulty": {"type": "string", "enum": ["basic", "standard", "challenge"]},
            },
            "required": ["topic", "question_count", "language", "difficulty"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "score_answer",
        "description": "Score a learner's answer with the checked deterministic rubric. Use only a question and quiz ID returned by start_quiz. Never invent or change the learner's answer.",
        "parameters": {
            "type": "object",
            "properties": {
                "quiz_id": {"type": "string"},
                "question_id": {"type": "string"},
                "answer": {"type": "string"},
                "language": {"type": "string", "enum": ["hi-IN", "en-IN"]},
            },
            "required": ["quiz_id", "question_id", "answer", "language"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "get_weak_topics",
        "description": "Read the current browser session's saved quiz scores and weak question areas when the learner asks what to revise.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

QUIZ_INTENT = re.compile(
    r"\b(?:quiz\s+me|test\s+me|viva\s+me|"
    r"(?:give|start|take|do)\s+(?:me\s+)?(?:a\s+)?(?:quiz|test|viva)|"
    r"(?:my|mera|meri)\s+(?:quiz|test|viva)\s+lo|"
    r"(?:quiz|test|viva)\s+(?:lo|karao|karwao|dijiye))\b"
    r"|\u0915\u094d\u0935\u093f\u091c\u093c?\s*"
    r"(?:\u0915\u0930\u093e\u0913|\u0915\u0930\u0935\u093e\u0913|\u0932\u094b|"
    r"\u0936\u0941\u0930\u0942\s+\u0915\u0930\u094b)"
)
REVISION_INTENT = re.compile(
    r"\b(?:practice more|what should i study|(?:help me|let'?s)\s+revise|"
    r"revise\s+(?:fundamental rights|article\s+\d+|this|these topics?|karo|karao|karwao)|"
    r"revision\s+(?:karao|karwao|please)|"
    r"weak\s+(?:topics?|areas?)|where am i weak(?:\s+at)?|my weak points|"
    r"kamzor\s+(?:topics?|areas?)|kamzori\s+(?:batao|dikhao)|"
    r"dohra(?:o|na|ana))\b|\u0915\u092e\u091c\u094b\u0930|\u0926\u094b\u0939\u0930\u093e"
)


def run_agent_turn(
    question: str,
    history: list[dict[str, str]],
    session_id: str,
    language: str = "hi-IN",
    responses_client: Any | None = None,
    on_text_delta: Callable[[str], None] | None = None,
    on_speech_mode: Callable[[bool], None] | None = None,
    on_sources: Callable[[list[dict[str, str]]], None] | None = None,
    quiz_difficulty: str = "standard",
) -> dict[str, Any]:
    """Answer a turn, using validated quiz/progress functions in model mode."""
    if not isinstance(quiz_difficulty, str) or quiz_difficulty not in QUIZ_PRESETS:
        raise ValueError("Choose basic, standard, or challenge quiz difficulty.")
    documents = retrieve(_retrieval_query(question, history))
    if on_sources is not None:
        on_sources([_source(document) for document in documents])
    if responses_client is None and not api_is_configured():
        return _offline_turn(question, documents, session_id, language, quiz_difficulty)

    if responses_client is None:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "Install the optional API dependency with `python -m pip install -r requirements.txt`."
            ) from exc
        with OpenAI(timeout=45.0, max_retries=1) as client:
            return _model_turn(
                question, history, session_id, language, client.responses,
                on_text_delta, on_speech_mode, quiz_difficulty, documents,
            )
    return _model_turn(
        question, history, session_id, language, responses_client,
        on_text_delta, on_speech_mode, quiz_difficulty, documents,
    )


def _model_turn(
    question: str,
    history: list[dict[str, str]],
    session_id: str,
    language: str,
    responses_client: Any,
    on_text_delta: Callable[[str], None] | None,
    on_speech_mode: Callable[[bool], None] | None,
    quiz_difficulty: str,
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    """Complete the tool workflow while the caller keeps its client open."""
    evidence = checked_evidence(documents, question, language)
    instructions = response_instructions(language)
    tools_requested = _has_tool_intent(question)
    if on_speech_mode is not None:
        on_speech_mode(not tools_requested and on_text_delta is not None)
    if tools_requested:
        instructions = (
            f"{instructions} You may use start_quiz to start a quiz, score_answer to score an answer "
            "with the server's fixed rubric, and get_weak_topics to read this browser session's saved results. "
            "Never claim a tool succeeded unless its result says ok."
            " Start at most one successful quiz per turn; use its returned questions and quiz ID."
            f" The current quiz preset is {quiz_difficulty}; use it unless the current question explicitly requests another preset."
        )
    input_items: list[Any] = [
        *model_history(history),
        {"role": "user", "content": f"{question.strip()}\n\nChecked study notes:\n{evidence}"},
    ]
    response_usages: list[dict[str, int] | None] = []
    provider_models: list[str | None] = []
    def create_response() -> Any:
        request = {
            "model": os.getenv("OPENAI_MODEL", "gpt-6-astra"),
            "instructions": instructions,
            "input": input_items,
        }
        if tools_requested:
            request["tools"] = TOOLS
            request["parallel_tool_calls"] = False
        if on_text_delta is None:
            response = responses_client.create(**request)
        else:
            response = _stream_response(responses_client, request, on_text_delta)
        require_completed_response(response)
        response_usages.append(_reported_token_usage(response))
        model = _field(response, "model")
        provider_models.append(model if isinstance(model, str)
                               and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}", model) else None)
        return response

    response = create_response()
    tool_events: list[dict[str, Any]] = []
    total_calls = 0

    for _ in range(MAX_TOOL_ROUNDS):
        calls = [item for item in _field(response, "output", []) if _field(item, "type") == "function_call"]
        if not calls:
            break
        if not tools_requested:
            raise RuntimeError("The model requested tools that were not enabled for this turn.")
        total_calls += len(calls)
        if total_calls > MAX_TOOL_CALLS:
            raise RuntimeError("This turn requested too many tool calls. Please try a simpler request.")

        input_items.extend(_field(response, "output", []))
        for call in calls:
            call_id = _field(call, "call_id", "")
            name = _field(call, "name", "")
            if not isinstance(call_id, str) or not call_id or not isinstance(name, str) or not name:
                raise RuntimeError("The model returned a tool call without its required identifiers.")
            if name == "start_quiz" and any(
                event["name"] == "start_quiz" and event["ok"] for event in tool_events
            ):
                message = "A quiz already started in this turn. Use its returned quiz ID and questions."
                output = {"ok": False, "error": message}
                event = {"name": name, "ok": False, "error": message}
            else:
                output, event = _execute_tool(
                    name,
                    _field(call, "arguments", ""),
                    call_id,
                    session_id,
                )
            input_items.append(
                {"type": "function_call_output", "call_id": call_id, "output": json.dumps(output, ensure_ascii=False)}
            )
            tool_events.append(event)

        response = create_response()
    else:
        if any(_field(item, "type") == "function_call" for item in _field(response, "output", [])):
            raise RuntimeError("The tutor did not finish its tool workflow. Please try again.")

    output_text = _field(response, "output_text", "")
    answer = output_text.strip() if isinstance(output_text, str) else ""
    if not answer:
        raise RuntimeError("The model returned an empty response. Please try again.")
    if len(answer) > MAX_MODEL_ANSWER_CHARS:
        raise RuntimeError("The model answer exceeded 12,000 characters. Ask a narrower question.")
    sources = [_source(document) for document in documents]
    reported_usages = [item for item in response_usages if item is not None]
    usage = None
    if len(reported_usages) == len(response_usages):
        usage = {key: sum(item[key] for item in reported_usages)
                 for key in ("input_tokens", "output_tokens", "total_tokens")}
        usage["response_count"] = len(response_usages)
    return {
        "answer": answer, "sources": sources, "tool_events": tool_events, "mode": "model",
        "usage": usage, "model_response_count": len(response_usages),
        "usage_response_count": len(reported_usages),
        "provider_reported_models": provider_models,
    }


def _reported_token_usage(response: Any) -> dict[str, int] | None:
    """Keep provider-reported token counts only; missing or invalid counts stay unavailable."""
    usage = _field(response, "usage")
    values = {key: _field(usage, key) for key in ("input_tokens", "output_tokens", "total_tokens")}
    if not all(isinstance(value, int) and not isinstance(value, bool) and value >= 0
               for value in values.values()):
        return None
    return values


def _stream_response(client: Any, request: dict[str, Any], on_text_delta: Callable[[str], None]) -> Any:
    """Yield text deltas while retaining the completed response for tool handling."""
    stream = client.create(**request, stream=True)
    completed = None
    text_characters = 0
    try:
        for event in stream:
            event_type = _field(event, "type", "")
            if event_type == "response.output_text.delta":
                if completed is not None:
                    raise RuntimeError("The model stream returned text after completion.")
                delta = _field(event, "delta", "")
                if isinstance(delta, str) and delta:
                    text_characters += len(delta)
                    if text_characters > MAX_MODEL_ANSWER_CHARS:
                        raise RuntimeError("The model stream exceeded 12,000 characters. Ask a narrower question.")
                    on_text_delta(delta)
            elif event_type == "response.completed":
                if completed is not None:
                    raise RuntimeError("The model stream returned duplicate completion events.")
                completed = _field(event, "response")
                if completed is None:
                    raise RuntimeError("The model stream returned no completed response.")
                require_completed_response(completed)
            elif event_type in {"error", "response.failed", "response.incomplete"}:
                # Provider messages may contain response/input details; keep failures local.
                raise RuntimeError("The model response failed or did not finish. Please try again.")
    finally:
        close = getattr(stream, "close", None)
        if callable(close):
            close()
    if completed is None:
        raise RuntimeError("The model stream ended before the response completed.")
    return completed


def _unique_tool_fields(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for key, value in pairs:
        if key in values:
            raise ValueError("Tool arguments contain duplicate fields.")
        values[key] = value
    return values


def _execute_tool(name: str, arguments: str, call_id: str, session_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        if not isinstance(arguments, str) or len(arguments) > MAX_TOOL_ARGUMENT_CHARS:
            raise ValueError("Tool arguments must be text of at most 16,000 characters.")
        try:
            values = json.loads(arguments, object_pairs_hook=_unique_tool_fields)
        except RecursionError as exc:
            raise ValueError("Tool arguments are nested too deeply.") from exc
        if not isinstance(values, dict):
            raise ValueError("Tool arguments must be an object.")
        if name == "start_quiz":
            difficulty = values.pop("difficulty", "standard")
            _check_fields(values, {"topic", "question_count", "language"})
            if (
                values["topic"] != "fundamental rights"
                or type(values["question_count"]) is not int
                or values["question_count"] not in {1, 2, 3}
                or not isinstance(values["language"], str) or values["language"] not in {"hi-IN", "en-IN"}
            ):
                raise ValueError("The quiz request contains an unsupported topic, size, or language.")
            quiz = start_quiz(values["topic"], values["question_count"], values["language"], difficulty)
            quiz_id = str(uuid.uuid4())
            create_quiz_run(session_id, quiz_id, quiz["topic"], [item["id"] for item in quiz["questions"]])
            result = {**quiz, "quiz_id": quiz_id}
        elif name == "score_answer":
            _check_fields(values, {"quiz_id", "question_id", "answer", "language"})
            if not all(isinstance(values[key], str) for key in values):
                raise ValueError("Quiz scoring arguments must be text.")
            if len(values["answer"]) > 1000:
                raise ValueError("Answer must contain at most 1,000 characters.")
            result = score_answer(values["question_id"], values["answer"], values["language"])
            result = save_answer(
                session_id,
                values["quiz_id"],
                values["question_id"],
                call_id,
                result,
            )
        elif name == "get_weak_topics":
            _check_fields(values, set())
            result = get_progress(session_id)
        else:
            raise ValueError("This tool is not available.")
        event = {"name": name, "ok": True, "result": result}
        return {"ok": True, "result": result}, event
    except (sqlite3.Error, OSError):
        message = "Study tool data is unavailable. Try again later; check saved progress before retrying a score."
        return {"ok": False, "error": message}, {"name": name or "unknown", "ok": False, "error": message}
    except (json.JSONDecodeError, KeyError, TypeError, ValueError, ProgressConflict) as exc:
        message = str(exc) or "The tool arguments are invalid."
        return {"ok": False, "error": message}, {"name": name or "unknown", "ok": False, "error": message}


def _check_fields(values: dict[str, Any], required: set[str]) -> None:
    if set(values) != required:
        raise ValueError("Tool arguments do not match the expected fields.")


def _offline_turn(
    question: str,
    documents: list[dict[str, Any]],
    session_id: str,
    language: str,
    difficulty: str = "standard",
) -> dict[str, Any]:
    tool_events: list[dict[str, Any]] = []
    normalized = question.casefold()
    quiz_intent = QUIZ_INTENT.search(normalized)
    revision_intent = REVISION_INTENT.search(normalized)
    if quiz_intent:
        try:
            quiz = start_quiz(language=language, difficulty=difficulty)
            quiz_id = str(uuid.uuid4())
            create_quiz_run(session_id, quiz_id, quiz["topic"], [item["id"] for item in quiz["questions"]])
        except (sqlite3.Error, OSError):
            return _offline_tool_unavailable("start_quiz", documents, language)
        result = {**quiz, "quiz_id": quiz_id}
        tool_events.append({"name": "start_quiz", "ok": True, "result": result})
        answer = "Thik hai, checked question bank se quiz shuru kar raha hoon." if language == "hi-IN" else "Starting a quiz from the checked question bank."
    elif revision_intent:
        try:
            result = get_progress(session_id)
        except (sqlite3.Error, OSError):
            return _offline_tool_unavailable("get_weak_topics", documents, language)
        tool_events.append({"name": "get_weak_topics", "ok": True, "result": result})
        if result["weak_topics"]:
            topics = ", ".join(item["topic"] for item in result["weak_topics"])
            answer = f"Revision ke liye in topics par wapas jao: {topics}." if language == "hi-IN" else f"For revision, revisit: {topics}."
        else:
            answer = "Abhi saved weak topics nahi hain. Ek quiz complete karke progress dekho." if language == "hi-IN" else "There are no saved weak topics yet. Complete a quiz to build your progress history."
    else:
        answer = offline_answer(documents, language, question)
    return {
        "answer": answer,
        "sources": [_source(document) for document in documents],
        "tool_events": tool_events,
        "mode": "offline",
    }


def _offline_tool_unavailable(
    name: str, documents: list[dict[str, Any]], language: str,
) -> dict[str, Any]:
    message = "Study tool data is unavailable. Try again later; check saved progress before retrying."
    action = "start the quiz" if name == "start_quiz" else "load saved revision topics"
    answer = (
        "Study tool ka data abhi available nahi hai; requested action complete nahi hua. "
        "Baad mein try karo aur saved progress check karo. Tutor se padhai ka sawal pooch sakte ho."
        if language == "hi-IN" else
        f"I could not {action} because study tool data is unavailable. Try later and check saved progress. "
        "You can still ask the tutor a study question."
    )
    return {
        "answer": answer, "sources": [_source(document) for document in documents],
        "tool_events": [{"name": name, "ok": False, "error": message}], "mode": "offline",
    }


def _has_tool_intent(question: str) -> bool:
    normalized = question.casefold()
    return bool(QUIZ_INTENT.search(normalized) or REVISION_INTENT.search(normalized))


def _retrieval_query(question: str, history: list[dict[str, str]]) -> str:
    prior_questions = prior_queries(history)
    return retrieval_query(question, prior_questions)


def _source(document: dict[str, Any]) -> dict[str, str]:
    return {
        "title": document["source"]["title"],
        "url": document["source"]["url"],
        "section": document["source"]["section"],
    }


def _field(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)
