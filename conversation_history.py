"""Bounded text history with optional checked-article hints for quiz follow-ups."""

from typing import Any

from retrieval import load_corpus


def clean_history(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or len(value) > 20:
        raise ValueError("Conversation history is invalid.")
    checked_ids = None
    cleaned = []
    for entry in value:
        if (not isinstance(entry, dict) or entry.get("role") not in ("user", "assistant")
                or not isinstance(entry.get("content"), str) or len(entry["content"]) > 3000):
            raise ValueError("Conversation history is invalid.")
        selected = {"role": entry["role"], "content": entry["content"]}
        if "article_context" in entry:
            if checked_ids is None:
                checked_ids = {document["id"] for document in load_corpus()}
            context = entry["article_context"]
            if not isinstance(context, str) or context not in checked_ids:
                raise ValueError("Conversation article context is invalid.")
            selected["article_context"] = context
        cleaned.append(selected)
    return cleaned


def prior_queries(history: list[dict[str, str]]) -> list[str]:
    """Hints describe the quiz topic, not evidence that a learner answer is correct."""
    queries = []
    for entry in history:
        if context := entry.get("article_context"):
            queries.append(f"Article {context.removeprefix('article-')}")
        elif entry["role"] == "user":
            queries.append(entry["content"])
    return queries[-4:]


def model_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    """Internal retrieval hints never become provider message fields or claimed tool results."""
    return [{"role": entry["role"], "content": entry["content"]} for entry in history]
