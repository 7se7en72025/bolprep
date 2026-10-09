"""Bounded quiz tools with deterministic, checked-answer rubric scoring."""

from __future__ import annotations

import json
import random
import re
import unicodedata
from pathlib import Path
from typing import Any


QUESTION_BANK = Path(__file__).resolve().parent / "data" / "quiz_questions.json"
MAX_QUESTIONS = 3
MAX_ANSWER_LENGTH = 1000
QUIZ_PRESETS = {
    "basic": ("art14_equality", "art21_protection"),
    "standard": None,
    "challenge": ("art19_freedoms", "art22_arrest_safeguards"),
}


def _concept_aliases(concept: dict[str, Any]) -> list[str]:
    """Feedback labels should also be recognized when a learner uses that wording."""
    return list(dict.fromkeys([
        *concept["aliases"],
        *(concept[key] for key in ("label", "label_hi", "label_hinglish") if key in concept),
    ]))


def _validate_concept_aliases(concepts: list[dict[str, Any]]) -> None:
    previous: list[list[str]] = []
    for concept in concepts:
        current = [_answer_tokens(alias) for alias in _concept_aliases(concept)]
        if any(not tokens for tokens in current):
            raise ValueError("Quiz concept phrases must contain words.")
        for tokens in current:
            if any(_contains_tokens(tokens, other) or _contains_tokens(other, tokens) for other in previous):
                raise ValueError("Quiz phrases overlap between distinct concepts; use separate concept wording.")
        previous.extend(current)


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
        if not isinstance(question["id"], str) or not question["id"].strip() or question["id"] in seen_ids:
            raise ValueError("Quiz question IDs must be unique strings.")
        if not all(
            isinstance(question[key], str) and question[key].strip()
            for key in ("topic", "prompt", "prompt_en")
        ):
            raise ValueError(f"Quiz question {question['id']} has invalid text fields.")
        seen_ids.add(question["id"])
        concepts = question["concepts"]
        if (
            not isinstance(concepts, list)
            or not concepts
            or not all(
                isinstance(concept, dict)
                and isinstance(concept.get("label"), str)
                and bool(concept["label"].strip())
                and (
                    "label_hi" not in concept
                    or isinstance(concept["label_hi"], str) and bool(concept["label_hi"].strip())
                )
                and (
                    "label_hinglish" not in concept
                    or isinstance(concept["label_hinglish"], str) and bool(concept["label_hinglish"].strip())
                )
                and isinstance(concept.get("aliases"), list)
                and concept["aliases"]
                and all(isinstance(alias, str) and alias.strip() for alias in concept["aliases"])
                for concept in concepts
            )
        ):
            raise ValueError(f"Quiz question {question['id']} has an invalid rubric.")
        minimum = question["minimum_concepts"]
        _validate_concept_aliases(concepts)
        if not isinstance(minimum, int) or isinstance(minimum, bool) or not 1 <= minimum <= len(concepts):
            raise ValueError(f"Quiz question {question['id']} has an invalid minimum score.")
        source = question["source"]
        if (
            not isinstance(source, dict)
            or not isinstance(source.get("title"), str)
            or not source["title"].strip()
            or not isinstance(source.get("section"), str)
            or not source["section"].strip()
            or not str(source.get("url", "")).startswith("https://")
        ):
            raise ValueError(f"Quiz question {question['id']} has invalid source metadata.")
    return questions


def start_quiz(
    topic: str = "fundamental rights",
    question_count: int | None = None,
    language: str = "hi-IN",
    difficulty: str = "standard",
) -> dict[str, Any]:
    """Start a bounded quiz and reveal only prompts and source metadata."""
    if not isinstance(topic, str) or topic.casefold().strip() != "fundamental rights":
        raise ValueError("Only the supported topic 'fundamental rights' is available.")
    if question_count is not None and (not isinstance(question_count, int) or isinstance(question_count, bool)):
        raise ValueError("Question count must be an integer.")
    if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
        raise ValueError("Choose Hindi/Hinglish or English questions.")
    if not isinstance(difficulty, str) or difficulty not in QUIZ_PRESETS:
        raise ValueError("Choose basic, standard, or challenge quiz difficulty.")

    available = [question for question in _load_questions() if question["topic"] == "fundamental rights"]
    pool = QUIZ_PRESETS[difficulty]
    if pool is not None:
        available = [question for question in available if question["id"] in pool]
    if not available:
        raise ValueError("No checked questions are available for this quiz preset.")
    if question_count is None:
        question_count = min(MAX_QUESTIONS, len(available))
    if not 1 <= question_count <= min(MAX_QUESTIONS, len(available)):
        raise ValueError(f"Choose between 1 and {min(MAX_QUESTIONS, len(available))} questions.")

    selected = random.SystemRandom().sample(available, question_count)
    return {
        "topic": "fundamental rights",
        "difficulty": difficulty,
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
    """Keep Unicode combining marks attached so Hindi phrases stay whole."""
    tokens: list[str] = []
    current: list[str] = []
    for character in unicodedata.normalize("NFC", answer.casefold()):
        if character.isalnum() or unicodedata.category(character).startswith("M"):
            current.append(character)
        elif current:
            tokens.append("".join(current))
            current.clear()
    if current:
        tokens.append("".join(current))
    return tokens


def _contains_tokens(answer_tokens: list[str], phrase_tokens: list[str]) -> bool:
    width = len(phrase_tokens)
    return bool(width) and any(
        answer_tokens[index : index + width] == phrase_tokens
        for index in range(len(answer_tokens) - width + 1)
    )


def _contains_phrase(answer_tokens: list[str], phrase: str) -> bool:
    return _contains_tokens(answer_tokens, _answer_tokens(phrase))


NEGATORS = {
    "no", "not", "never", "without", "neither", "nor", "cannot",
    "doesn", "don", "isn", "aren", "won",  # Contractions split at the apostrophe.
    "nahi", "nahin", "nhi", "bina", "नहीं", "नही", "बिना", "न",
}
CONTRAST_WORDS = {"but", "however", "balki", "lekin", "बल्कि", "लेकिन", "परंतु"}
COPULA_WORDS = {"is", "are", "was", "were", "hai", "hain", "है", "हैं"}
NEGATED_FOLLOWERS = {
    "protected", "guaranteed", "allowed", "exists", "hai", "hain", "hota", "hoti",
    "milta", "milti", "है", "हैं", "होता", "होती", "मिलता", "मिलती", "करता", "करती",
}
PROTECTION_WORDS = {"protect", "protects", "protected", "रक्षा", "सुरक्षा"}
DENIAL_WORDS = {"deny", "denies", "denied", "denying"}
NEGATION_FILLERS = {"a", "an", "any", "the", "right", "rights", "to", "of", "का", "की", "के", "अधिकार"}


def _ignored_negator(tokens: list[str], index: int) -> bool:
    """Keep common additive expressions such as 'not only ... but also' positive."""
    next_word = tokens[index + 1] if index + 1 < len(tokens) else ""
    if tokens[index] == "not" and next_word in {"only", "just", "merely"}:
        return True
    previous = tokens[index - 1] if index else ""
    if tokens[index] in {"nahi", "nahin", "nhi", "नहीं", "नही"} and previous in {"hi", "ही"}:
        return any(word in {"balki", "बल्कि"} for word in tokens[index + 1:index + 4])
    return False


def _negates_phrase(tokens: list[str], start: int, end: int) -> bool:
    """Catch nearby explicit denial; this deliberately does not infer full meaning."""
    for index in range(max(0, start - 3), start):
        if tokens[index] in NEGATORS and not _ignored_negator(tokens, index):
            between = tokens[index + 1:start]
            if any(word in CONTRAST_WORDS for word in between):
                continue
            if tokens[index] in {"no", "without", "bina", "बिना"} and any(
                word not in NEGATION_FILLERS for word in between
            ):
                continue
            if any(word in DENIAL_WORDS for word in between):
                continue
            return True
    if end < len(tokens):
        next_word = tokens[end]
        following = tokens[end + 1] if end + 1 < len(tokens) else ""
        if next_word in COPULA_WORDS and following in NEGATORS:
            later = tokens[end + 2] if end + 2 < len(tokens) else ""
            return later not in DENIAL_WORDS
        if next_word in NEGATORS and following in NEGATED_FOLLOWERS:
            return True
        if next_word in {"hi", "ही"} and following in NEGATORS:
            return not _ignored_negator(tokens, end + 1)
    return False


def _denies_protection(tokens: list[str]) -> bool:
    """A negated protection verb applies to the concepts named in its clause."""
    for index, word in enumerate(tokens):
        if word not in PROTECTION_WORDS:
            continue
        if index + 1 < len(tokens) and tokens[index + 1] in NEGATORS:
            if not _ignored_negator(tokens, index + 1):
                return True
        for prior in range(max(0, index - 2), index):
            if tokens[prior] in NEGATORS and not _ignored_negator(tokens, prior):
                return True
    return False


def _concept_mentions(clauses: list[list[str]], aliases: list[str]) -> tuple[bool, bool]:
    positive = False
    negated = False
    phrases = [_answer_tokens(alias) for alias in aliases]
    for tokens in clauses:
        denied_clause = _denies_protection(tokens)
        for phrase in phrases:
            width = len(phrase)
            for start in range(len(tokens) - width + 1):
                if tokens[start:start + width] != phrase:
                    continue
                if denied_clause or _negates_phrase(tokens, start, start + width):
                    negated = True
                else:
                    positive = True
    return positive, negated


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

    clauses = [_answer_tokens(part) for part in re.split(r"[.!?;।,\n]+", answer)]
    matched: list[str] = []
    missing: list[str] = []
    all_labels: list[str] = []
    negated_labels: list[str] = []
    hindi_script_answer = any("\u0900" <= character <= "\u097f" for character in answer)
    for concept in question["concepts"]:
        if language == "hi-IN" and hindi_script_answer:
            label = concept.get("label_hi", concept["label"])
        elif language == "hi-IN":
            label = concept.get("label_hinglish", concept["label"])
        else:
            label = concept["label"]
        all_labels.append(label)
        positive, negated = _concept_mentions(clauses, _concept_aliases(concept))
        if positive and not negated:
            matched.append(label)
        else:
            missing.append(label)
            if negated:
                negated_labels.append(label)

    # A denied rubric idea makes an otherwise high lexical count misleading.
    # Withhold automatic credit until the learner states a consistent answer.
    if negated_labels:
        matched = []
        missing = all_labels
    minimum = question["minimum_concepts"]
    score = min(100, round(100 * len(matched) / minimum))
    complete = len(matched) >= minimum
    if negated_labels:
        correction = ", ".join(negated_labels)
        feedback = (f"In ideas par denial/contradiction lagti hai: {correction}. Automatic score roka gaya; jawab saaf karke dobara do."
                    if language == "hi-IN" else
                    f"Your wording may deny or contradict: {correction}. Automatic credit was withheld; clarify and try again.")
    elif language == "hi-IN":
        feedback = "Sahi jawab!" if complete else f"{len(matched)}/{minimum} key ideas mile. Add: {', '.join(missing[:minimum - len(matched)])}."
    else:
        feedback = "Good answer!" if complete else f"You covered {len(matched)} of {minimum} key ideas. Add: {', '.join(missing[:minimum - len(matched)])}."

    return {
        "question_id": question_id,
        "score": score,
        "matched_concepts": matched,
        "missing_concepts": missing,
        "minimum_concepts": minimum,
        "total_concepts": len(question["concepts"]),
        "complete": complete,
        "feedback": feedback,
        "source": question["source"],
    }
