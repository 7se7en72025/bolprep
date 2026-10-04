"""Interactive text tutor for the BolPrep learning project."""

from __future__ import annotations

import os
import sys

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
    "This early version has no verified study corpus, so do not claim citations "
    "or pretend facts were retrieved from project notes."
)


def offline_answer(question: str) -> str:
    """Return a transparent practice response when no model key is configured."""
    del question  # This exercise intentionally does not interpret the question.
    return (
        "Offline practice mode: abhi AI model configured nahi hai, isliye main "
        "question ka jawab generate nahi kar sakta. Model connect karne ke liye "
        "README ke setup steps follow karo."
    )


def ask_model(question: str, history: list[dict[str, str]]) -> str:
    """Send one turn and the current conversation to the OpenAI Responses API."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Install the optional API dependency with `python -m pip install -r requirements.txt`."
        ) from exc

    model = os.getenv("OPENAI_MODEL", "gpt-6-astra")
    client = OpenAI()
    response = client.responses.create(
        model=model,
        instructions=INSTRUCTIONS,
        input=[*history, {"role": "user", "content": question}],
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
            answer = ask_model(question, history) if has_api_key else offline_answer(question)
        except Exception as exc:  # Keep the interactive process alive on provider errors.
            print(f"BolPrep: Request failed: {exc}", file=sys.stderr)
            continue

        print(f"BolPrep: {answer}")
        if has_api_key:
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
