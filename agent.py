"""Responses API tool loop for the local study tutor."""

from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any

from bolprep import INSTRUCTIONS, api_is_configured, offline_answer
from progress import (
    ProgressConflict,
    create_quiz_run,
    get_progress,
    save_answer,
)
from quiz import score_answer, start_quiz
from retrieval import retrieval_query, retrieve


MAX_TOOL_CALLS = 6
MAX_TOOL_ROUNDS = 3

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "start_quiz",
        "description": "Start a short quiz from the checked Fundamental Rights question bank when the learner asks for a quiz, test, or viva.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "enum": ["fundamental rights"]},
                "question_count": {"type": "integer", "enum": [1, 2, 3]},
                "language": {"type": "string", "enum": ["hi-IN", "en-IN"]},
            },
            "required": ["topic", "question_count", "language"],
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


def run_agent_turn(
    question: str,
    history: list[dict[str, str]],
    session_id: str,
    language: str = "hi-IN",
    responses_client: Any | None = None,
) -> dict[str, Any]:
    """Answer a turn, using validated quiz/progress functions in model mode."""
    documents = retrieve(_retrieval_query(question, history))
    if responses_client is None and not api_is_configured():
        return _offline_turn(question, documents, session_id, language)

    if responses_client is None:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "Install the optional API dependency with `python -m pip install -r requirements.txt`."
            ) from exc
        responses_client = OpenAI(timeout=45.0, max_retries=1).responses

    evidence = "\n\n".join(
        f"{document['title']} ({document['source']['section']}): {document['summary']}"
        for document in documents
    ) or "No checked study note matched this turn. Do not answer factual study questions from memory."
    instructions = (
        f"{INSTRUCTIONS} You may use start_quiz to start a quiz, score_answer to score an answer "
        "with the server's fixed rubric, and get_weak_topics to read this browser session's saved results. "
        "Never claim a tool succeeded unless its result says ok."
    )
    input_items: list[Any] = [
        *history,
        {"role": "user", "content": f"{question.strip()}\n\nChecked study notes:\n{evidence}"},
    ]
    response = responses_client.create(
        model=os.getenv("OPENAI_MODEL", "gpt-6-astra"),
        instructions=instructions,
        input=input_items,
        tools=TOOLS,
        parallel_tool_calls=False,
    )
    tool_events: list[dict[str, Any]] = []
    total_calls = 0

    for _ in range(MAX_TOOL_ROUNDS):
        calls = [item for item in _field(response, "output", []) if _field(item, "type") == "function_call"]
        if not calls:
            break
        total_calls += len(calls)
        if total_calls > MAX_TOOL_CALLS:
            raise RuntimeError("This turn requested too many tool calls. Please try a simpler request.")

        input_items.extend(_field(response, "output", []))
        for call in calls:
            call_id = _field(call, "call_id", "")
            name = _field(call, "name", "")
            if not isinstance(call_id, str) or not call_id or not isinstance(name, str) or not name:
                raise RuntimeError("The model returned a tool call without its required identifiers.")
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

        response = responses_client.create(
            model=os.getenv("OPENAI_MODEL", "gpt-6-astra"),
            instructions=instructions,
            input=input_items,
            tools=TOOLS,
            parallel_tool_calls=False,
        )
    else:
        if any(_field(item, "type") == "function_call" for item in _field(response, "output", [])):
            raise RuntimeError("The tutor did not finish its tool workflow. Please try again.")

    output_text = _field(response, "output_text", "")
    answer = output_text.strip() if isinstance(output_text, str) else ""
    if not answer:
        raise RuntimeError("The model returned an empty response. Please try again.")
    sources = [_source(document) for document in documents]
    return {"answer": answer, "sources": sources, "tool_events": tool_events, "mode": "model"}


def _execute_tool(name: str, arguments: str, call_id: str, session_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        values = json.loads(arguments)
        if not isinstance(values, dict):
            raise ValueError("Tool arguments must be an object.")
        if name == "start_quiz":
            _check_fields(values, {"topic", "question_count", "language"})
            if (
                values["topic"] != "fundamental rights"
                or isinstance(values["question_count"], bool)
                or values["question_count"] not in {1, 2, 3}
                or values["language"] not in {"hi-IN", "en-IN"}
            ):
                raise ValueError("The quiz request contains an unsupported topic, size, or language.")
            quiz = start_quiz(values["topic"], values["question_count"], values["language"])
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
) -> dict[str, Any]:
    tool_events: list[dict[str, Any]] = []
    normalized = question.casefold()
    quiz_intent = re.search(r"\b(quiz|test|viva)\b|\u0915\u094d\u0935\u093f\u091c", normalized)
    revision_intent = re.search(r"\b(revis(e|ion)|weak|practice more|what should i study)\b|\u0915\u092e\u091c\u094b\u0930|\u0926\u094b\u0939\u0930\u093e", normalized)
    if quiz_intent:
        quiz = start_quiz(language=language)
        quiz_id = str(uuid.uuid4())
        create_quiz_run(session_id, quiz_id, quiz["topic"], [item["id"] for item in quiz["questions"]])
        result = {**quiz, "quiz_id": quiz_id}
        tool_events.append({"name": "start_quiz", "ok": True, "result": result})
        answer = "Thik hai, checked question bank se quiz shuru kar raha hoon." if language == "hi-IN" else "Starting a quiz from the checked question bank."
    elif revision_intent:
        result = get_progress(session_id)
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


def _retrieval_query(question: str, history: list[dict[str, str]]) -> str:
    prior_questions = [item["content"] for item in history if item["role"] == "user"][-4:]
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
