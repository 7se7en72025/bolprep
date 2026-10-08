"""Interactive text tutor for the BolPrep learning project."""

from __future__ import annotations

import argparse
import os
import re
import sys

from retrieval import is_generic_question, retrieval_query, retrieve
from conversation_history import model_history, prior_queries

MAX_MODEL_ANSWER_CHARS = 12000

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()


def offline_requested() -> bool:
    """Offline mode overrides a configured key without changing credentials."""
    return os.getenv("BOLPREP_OFFLINE", "0").strip() == "1"


def api_is_configured() -> bool:
    """Return whether provider mode is enabled and a key is available."""
    return not offline_requested() and bool(os.getenv("OPENAI_API_KEY", "").strip())


def configure_cli(description: str, *, include_port: bool = False) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--offline", action="store_true", help="Disable model/provider routes without editing .env")
    if include_port:
        parser.add_argument("--port", type=int, default=8000, help="Local HTTP port (1-65535; default 8000)")
    args = parser.parse_args()
    if include_port and not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if args.offline:
        os.environ["BOLPREP_OFFLINE"] = "1"
    return args


INSTRUCTIONS = (
    "You are BolPrep, a patient study tutor for Indian Polity. "
    "Reply in the language the learner uses (Hindi, English, or Hinglish). "
    "Keep explanations short, define difficult terms, and say when you are unsure. "
    "Use only the checked local notes attached to the current question for factual claims. "
    "If those notes do not support an answer, say so instead of filling gaps from memory. "
    "Sources are displayed separately by the app; never invent source details or URLs. "
    "These short notes are for study and are not a full legal explanation."
)


def answer_style(language: str, question: str) -> str:
    """Select the checked-note translation used by the browser response preference."""
    if language == "hi-IN":
        return "hi" if re.search(r"[\u0900-\u097F]", question) else "hinglish"
    return "en"


def response_instructions(language: str | None = None) -> str:
    """Keep terminal language inference, or add the browser's current preference."""
    if language is None:
        return INSTRUCTIONS
    if language not in {"hi-IN", "en-IN"}:
        raise ValueError("Choose Hindi/Hinglish or English.")
    preference = "English" if language == "en-IN" else (
        "Hindi or natural Hindi-English Hinglish; use Devanagari Hindi when the current "
        "question uses Devanagari, otherwise use conversational Roman Hinglish"
    )
    return (
        f"{INSTRUCTIONS} The current response preference is {preference}. "
        "For this turn, use that preference unless the learner explicitly requests another "
        "language in the current question. Earlier turns and the language of the study notes "
        "must not override this current preference. Keep the relevant conversation context "
        "when changing language; do not start the explanation over solely because the language changed."
    )


def checked_evidence(
    documents: list[dict[str, object]], question: str = "", language: str | None = None
) -> str:
    """Use checked translations without changing retrieval or source metadata."""
    style = answer_style(language, question) if language is not None else None
    notes = []
    for document in documents:
        title = document.get(f"title_{style}", document["title"]) if style else document["title"]
        summary = document.get(f"summary_{style}", document["summary"]) if style else document["summary"]
        notes.append(f"{title} ({document['source']['section']}): {summary}")
    return "\n\n".join(notes) or (
        "No checked study note matched this turn. Do not answer factual study questions from memory."
    )


def offline_answer(
    documents: list[dict[str, object]], language: str = "en-IN", question: str = "",
    *, retrieval_question: str | None = None,
) -> str:
    """Return a checked-note summary in English, Hindi, or Hinglish without implying AI was used."""
    style = answer_style(language, question)
    if not documents:
        selected_query = question if retrieval_question is None else retrieval_question
        if is_generic_question(selected_query):
            if style == "hi":
                return "आप किस अनुच्छेद या विषय के बारे में पूछ रहे हैं? अनुच्छेद संख्या या विषय बताइए।"
            if style == "hinglish":
                return "Kis Article ya topic ke baare mein pooch rahe ho? Article number ya topic batao."
            return "Which article or topic do you mean? Give an article number or a study topic."
        if style == "hi":
            return "जाँचे हुए अध्ययन नोट्स में अभी इस प्रश्न का उत्तर नहीं है।"
        if style == "hinglish":
            return "Mere checked study notes mein abhi is question ka answer nahi hai."
        return "My checked study notes do not cover this question yet."
    notes = []
    for document in documents:
        title = document.get(f"title_{style}", document["title"])
        summary = document.get(f"summary_{style}", document["summary"])
        notes.append(f"- {title}: {summary}")
    if style == "hi":
        heading = "ऑफलाइन अध्ययन नोट्स (AI से बना हुआ जवाब नहीं):"
    elif style == "hinglish":
        heading = "Offline study notes (AI-generated explanation nahi):"
    else:
        heading = "Offline study notes (not an AI-generated explanation):"
    return f"{heading}\n" + "\n".join(notes)


def require_completed_response(response: object) -> None:
    """Partial text or tool calls are not proof of a finished model response."""
    status = response.get("status") if isinstance(response, dict) else getattr(response, "status", None)
    if status != "completed":
        raise RuntimeError("The model response did not finish. Please try again.")


def ask_model(
    question: str,
    history: list[dict[str, str]],
    documents: list[dict[str, object]],
    language: str | None = None,
) -> str:
    """Answer one turn using recent context and retrieved local study notes."""
    if offline_requested():
        raise RuntimeError("Provider requests are disabled in offline mode.")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Install the optional API dependency with `python -m pip install -r requirements.txt`."
        ) from exc

    model = os.getenv("OPENAI_MODEL", "gpt-6-astra")
    evidence = checked_evidence(documents, question, language)
    with OpenAI(timeout=45.0, max_retries=1) as client:
        response = client.responses.create(
            model=model,
            instructions=response_instructions(language),
            input=[
                *model_history(history),
                {
                    "role": "user",
                    "content": f"Question: {question}\n\nChecked study notes:\n{evidence}",
                },
            ],
        )
    require_completed_response(response)
    answer = response.output_text.strip()
    if not answer:
        raise RuntimeError("The model returned an empty response. Please try again.")
    if len(answer) > MAX_MODEL_ANSWER_CHARS:
        raise RuntimeError("The model answer exceeded 12,000 characters. Ask a narrower question.")
    return answer


def run() -> int:
    """Run the interactive tutor until the learner enters /quit."""
    has_api_key = api_is_configured()
    history: list[dict[str, str]] = []
    language: str | None = None

    print("BolPrep text tutor - type /quit to exit.")
    print("Questions can contain up to 1,200 characters. Type /new to clear conversation context.")
    print("Language: /language hi for Hindi/Hinglish, /language en for English, /language auto for model inference (offline English).")
    if has_api_key:
        print("Model mode: using OPENAI_MODEL (or the default model).")
    elif offline_requested():
        print("Offline mode requested: model/provider routes are disabled.")
    else:
        print("Offline practice mode: set OPENAI_API_KEY to enable model answers.")

    while True:
        try:
            question = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBolPrep: Session ended.")
            return 0

        if not question:
            continue
        if question.casefold() in {"/quit", "/exit"}:
            print("BolPrep: Session ended.")
            return 0
        if question.casefold() == "/new":
            history.clear()
            print("BolPrep: Started a new study conversation.")
            continue
        command = question.casefold().split()
        if command and command[0] == "/language":
            choices = {"hi": "hi-IN", "en": "en-IN", "auto": None}
            if len(command) != 2 or command[1] not in choices:
                print("BolPrep: Use /language hi, /language en, or /language auto.")
                continue
            language = choices[command[1]]
            label = {"hi": "Hindi/Hinglish", "en": "English", "auto": "automatic model language (offline English)"}[command[1]]
            print(f"BolPrep: Response preference set to {label}; conversation context retained.")
            continue
        if len(question) > 1200:
            print("BolPrep: Shorten your question to 1,200 characters before asking.")
            continue

        try:
            prior_questions = prior_queries(history)
            selected_query = retrieval_query(question, prior_questions)
            documents = retrieve(selected_query)
            if not documents:
                answer = offline_answer([], language or "en-IN", question, retrieval_question=selected_query)
            elif has_api_key:
                answer = ask_model(question, history, documents, language)
            else:
                answer = offline_answer(documents, language or "en-IN", question, retrieval_question=selected_query)
        except Exception as exc:  # Keep the interactive process alive on provider errors.
            print(f"BolPrep: Request failed ({type(exc).__name__}). Try again or use offline mode.", file=sys.stderr)
            continue

        print(f"BolPrep: {answer}")
        for document in documents:
            source = document["source"]
            print(f"Source: {source['title']} - {source['section']} - {source['url']}")
        context_answer = answer
        if len(context_answer) > 3000:
            marker = "\n[Earlier answer clipped for context; full text remains in terminal output.]"
            context_answer = context_answer[:3000 - len(marker)] + marker
        history.extend(
            [
                {"role": "user", "content": question},
                {"role": "assistant", "content": context_answer},
            ]
        )
        # Bound prompt growth in a long-running session while retaining recent turns.
        history = history[-20:]


if __name__ == "__main__":
    configure_cli("BolPrep terminal study tutor")
    raise SystemExit(run())
