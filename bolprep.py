"""Interactive text tutor for the BolPrep learning project."""

from __future__ import annotations

import os
import re
import sys

from retrieval import retrieval_query, retrieve
from conversation_history import model_history, prior_queries

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()


def api_is_configured() -> bool:
    """Return whether model mode has a key available to the server process."""
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


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
        f"{INSTRUCTIONS} The current browser response preference is {preference}. "
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
    documents: list[dict[str, object]], language: str = "en-IN", question: str = ""
) -> str:
    """Return a checked-note summary in English, Hindi, or Hinglish without implying AI was used."""
    style = answer_style(language, question)
    if not documents:
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


def ask_model(
    question: str,
    history: list[dict[str, str]],
    documents: list[dict[str, object]],
    language: str | None = None,
) -> str:
    """Answer one turn using recent context and retrieved local study notes."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Install the optional API dependency with `python -m pip install -r requirements.txt`."
        ) from exc

    model = os.getenv("OPENAI_MODEL", "gpt-6-astra")
    client = OpenAI(timeout=45.0, max_retries=1)
    evidence = checked_evidence(documents, question, language)
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
    answer = response.output_text.strip()
    if not answer:
        raise RuntimeError("The model returned an empty response. Please try again.")
    return answer


def run() -> int:
    """Run the interactive tutor until the learner enters /quit."""
    has_api_key = api_is_configured()
    history: list[dict[str, str]] = []

    print("BolPrep text tutor - type /quit to exit.")
    if has_api_key:
        print("Model mode: using OPENAI_MODEL (or the default model).")
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

        try:
            prior_questions = prior_queries(history)
            documents = retrieve(retrieval_query(question, prior_questions))
            if not documents:
                answer = offline_answer([], question=question)
            elif has_api_key:
                answer = ask_model(question, history, documents)
            else:
                answer = offline_answer(documents)
        except Exception as exc:  # Keep the interactive process alive on provider errors.
            print(f"BolPrep: Request failed: {exc}", file=sys.stderr)
            continue

        print(f"BolPrep: {answer}")
        for document in documents:
            source = document["source"]
            print(f"Source: {source['title']} - {source['section']} - {source['url']}")
        history.extend(
            [
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer},
            ]
        )
        # Bound prompt growth in a long-running session while retaining recent turns.
        history = history[-20:]


if __name__ == "__main__":
    raise SystemExit(run())
