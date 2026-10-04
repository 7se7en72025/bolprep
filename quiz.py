"""Bounded quiz tools with deterministic, checked-answer rubric scoring."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any


QUESTION_BANK = Path(__file__).resolve().parent / "data" / "quiz_questions.json"
MAX_QUESTIONS = 3
MAX_ANSWER_LENGTH = 1000


def _load_questions() -> list[dict[str, Any]]:
    questions = json.loads(QUESTION_BANK.read_text(encoding="utf-8"))
    if not isinstance(questions, list) or not questions:
        raise ValueError("Quiz question bank must be a non-empty JSON list.")
    seen_ids: set[str] = set()
    for question in questions:
        if not isinstance(question, dict):
            raise ValueError("Each quiz question must be an object.")
        if not all(key in question for key in ("id", "topic", "prompt", "minimum_concepts", "concepts", "source")):
            raise ValueError("Quiz question is missing required fields.")
        if not isinstance(question["id"], str) or question["id"] in seen_ids:
            raise ValueError("Quiz question IDs must be unique strings.")
        if not all(isinstance(question[key], str) and question[key] for key in ("topic", "prompt", "prompt_en")):
            raise ValueError(f"Quiz question {question['id']} has invalid text fields.")
        seen_ids.add(question["id"])
        concepts = question["concepts"]
        if (
            not isinstance(concepts, list)
            or not concepts
            or not all(
                isinstance(concept, dict)
                and isinstance(concept.get("label"), str)
                and ("label_hi" not in concept or isinstance(concept["label_hi"], str))
                and isinstance(concept.get("aliases"), list)
                and concept["aliases"]
                and all(isinstance(alias, str) for alias in concept["aliases"])
                for concept in concepts
            )
        ):
            raise ValueError(f"Quiz question {question['id']} has an invalid rubric.")
        minimum = question["minimum_concepts"]
        if not isinstance(minimum, int) or isinstance(minimum, bool) or not 1 <= minimum <= len(concepts):
            raise ValueError(f"Quiz question {question['id']} has an invalid minimum score.")
        source = question["source"]
        if (
            not isinstance(source, dict)
            or not isinstance(source.get("title"), str)
            or not isinstance(source.get("section"), str)
            or not str(source.get("url", "")).startswith("https://")
        ):
            raise ValueError(f"Quiz question {question['id']} has invalid source metadata.")
    return questions


def start_quiz(
    topic: str = "fundamental rights",
    question_count: int = 3,
    language: str = "hi-IN",
) -> dict[str, Any]:
    """Start a bounded quiz and reveal only prompts and source metadata."""
    if not isinstance(topic, str) or topic.casefold().strip() != "fundamental rights":
        raise ValueError("Only the supported topic 'fundamental rights' is available.")
    if not isinstance(question_count, int) or isinstance(question_count, bool):
        raise ValueError("Question count must be an integer.")
    if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
        raise ValueError("Choose Hindi/Hinglish or English questions.")

    available = [question for question in _load_questions() if question["topic"] == "fundamental rights"]
    if not 1 <= question_count <= min(MAX_QUESTIONS, len(available)):
        raise ValueError(f"Choose between 1 and {min(MAX_QUESTIONS, len(available))} questions.")

    selected = random.SystemRandom().sample(available, question_count)
    return {
        "topic": "fundamental rights",
        "questions": [
            {
                "id": question["id"],
                "prompt": question["prompt_en"] if language == "en-IN" else question["prompt"],
                "source": question["source"],
            }
            for question in selected
        ],
    }


def _answer_tokens(answer: str) -> list[str]:
    return re.findall(r"[\w]+", answer.casefold(), flags=re.UNICODE)


def _contains_phrase(answer_tokens: list[str], phrase: str) -> bool:
    phrase_tokens = _answer_tokens(phrase)
    width = len(phrase_tokens)
    return bool(width) and any(
        answer_tokens[index : index + width] == phrase_tokens
        for index in range(len(answer_tokens) - width + 1)
    )


def score_answer(question_id: str, answer: str, language: str = "en-IN") -> dict[str, Any]:
    """Score listed concept groups only; this is lexical rubric matching, not semantic grading."""
    if not isinstance(question_id, str) or not isinstance(answer, str):
        raise ValueError("Question ID and answer must be text.")
    if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
        raise ValueError("Choose Hindi/Hinglish or English feedback.")
    if not answer.strip() or len(answer) > MAX_ANSWER_LENGTH:
        raise ValueError(f"Answer must contain 1 to {MAX_ANSWER_LENGTH} characters.")

    question = next((item for item in _load_questions() if item["id"] == question_id), None)
    if question is None:
        raise ValueError("Unknown question ID.")

    answer_tokens = _answer_tokens(answer)
    matched: list[str] = []
    missing: list[str] = []
    for concept in question["concepts"]:
        label = concept.get("label_hi", concept["label"]) if language == "hi-IN" else concept["label"]
        if any(_contains_phrase(answer_tokens, alias) for alias in concept["aliases"]):
            matched.append(label)
        else:
            missing.append(label)

    minimum = question["minimum_concepts"]
    score = min(100, round(100 * len(matched) / minimum))
    complete = len(matched) >= minimum
    if language == "hi-IN":
        feedback = "Sahi jawab!" if complete else f"{len(matched)}/{minimum} key ideas mile. Add: {', '.join(missing[:minimum - len(matched)])}."
    else:
        feedback = "Good answer!" if complete else f"You covered {len(matched)} of {minimum} key ideas. Add: {', '.join(missing[:minimum - len(matched)])}."

    return {
        "question_id": question_id,
        "score": score,
        "matched_concepts": matched,
        "missing_concepts": missing,
        "complete": complete,
        "feedback": feedback,
        "source": question["source"],
    }
