"""Small lexical retrieval baseline over the checked local study notes."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any


CORPUS_PATH = Path(__file__).resolve().parent / "data" / "fundamental_rights.json"
HINDI_STOPWORDS = {
    "\u0905\u0927\u093f\u0915\u093e\u0930",
    "\u0905\u0928\u0941\u091a\u094d\u091b\u0947\u0926",
}
STOPWORDS = {
    "a", "about", "an", "and", "are", "can", "explain", "for", "hai", "hain",
    "ho", "how", "in", "is", "ka", "ke", "ki", "kya", "me", "mein", "of",
    "article", "art", "does", "please", "tell", "the", "to", "what", "who", "which", "why", "ya", "ye", "your",
    "right", "rights", "fundamental", "freedom", "freedoms", "adhikar", "adhikaar",
    *HINDI_STOPWORDS,
}
GENERIC_ARTICLE_QUERY_TOKENS = {"cover", "protect", "guarantee", "list", "mean", "say", "karta", "karti"}


def _tokens(text: str) -> set[str]:
    """Split words while keeping Devanagari combining marks attached."""
    tokens: set[str] = set()
    current: list[str] = []
    for character in unicodedata.normalize("NFC", text.casefold()):
        if character.isalnum() or unicodedata.category(character).startswith("M"):
            current.append(character)
        elif current:
            tokens.add("".join(current))
            current.clear()
    if current:
        tokens.add("".join(current))
    return {token for token in tokens if token not in STOPWORDS and len(token) > 1}


def load_corpus(path: Path = CORPUS_PATH) -> list[dict[str, Any]]:
    """Load notes and fail closed if a record is missing required metadata."""
    documents = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(documents, list) or not documents:
        raise ValueError("Study corpus must be a non-empty JSON list.")
    required = {
        "id", "title", "title_hi", "title_hinglish", "summary", "summary_hi",
        "summary_hinglish", "keywords", "source",
    }
    seen_ids: set[str] = set()
    for document in documents:
        if not isinstance(document, dict) or not required.issubset(document):
            raise ValueError("Each study note needs an id, title, summary, keywords, and source.")
        if not isinstance(document["id"], str) or not document["id"].strip() or document["id"] in seen_ids:
            raise ValueError("Each study note needs a unique, non-empty id.")
        seen_ids.add(document["id"])
        source = document["source"]
        if (
            not isinstance(source, dict)
            or not isinstance(source.get("title"), str)
            or not source["title"].strip()
            or not isinstance(source.get("url"), str)
            or not source["url"].startswith("https://")
            or not isinstance(source.get("section"), str)
            or not source["section"].strip()
        ):
            raise ValueError(f"Study note {document['id']} has invalid source metadata.")
        checked_on = source.get("checked_on")
        try:
            if not isinstance(checked_on, str):
                raise ValueError
            checked_date = date.fromisoformat(checked_on)
            if checked_date.isoformat() != checked_on or checked_date > date.today():
                raise ValueError
        except ValueError:
            raise ValueError(
                f"Study note {document['id']} needs a non-future source checked_on date (YYYY-MM-DD)."
            ) from None
        text_fields = (
            "title", "title_hi", "title_hinglish", "summary", "summary_hi", "summary_hinglish"
        )
        if not all(
            isinstance(document[field], str) and document[field].strip()
            for field in text_fields
        ):
            raise ValueError(f"Study note {document['id']} needs non-empty text in every language.")
        if (
            not isinstance(document["keywords"], list)
            or not document["keywords"]
            or not all(isinstance(keyword, str) and keyword.strip() for keyword in document["keywords"])
        ):
            raise ValueError("Study note fields have invalid types.")
    return documents


def retrieve(question: str, limit: int | None = None) -> list[dict[str, Any]]:
    """Rank notes with a transparent keyword overlap score and article-number boost."""
    if (
        not isinstance(question, str)
        or not question.strip()
        or (limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1))
    ):
        return []

    query_tokens = {token for token in _tokens(question) if not token.isdigit()}
    informative_tokens = {
        token for token in query_tokens
        if token not in GENERIC_ARTICLE_QUERY_TOKENS | {"article", "art", "anuchhed"}
        and not token.isdigit()
    }
    normalized_question = question.casefold()
    article_reference = re.search(
        r"(?:\b(?:article|art|anuchhed)\s*[-.]?\s*(?P<article_id>\d+[a-z]?)\b|\u0905\u0928\u0941\u091a\u094d\u091b\u0947\u0926\s*[-.]?\s*(?P<hindi_id>\d+[a-z]?)\b)",
        question,
        re.IGNORECASE,
    )
    documents = load_corpus()
    if article_reference:
        article_id = (article_reference.group("article_id") or article_reference.group("hindi_id")).casefold()
        document = next((item for item in documents if item["id"] == f"article-{article_id}"), None)
        if document is None:
            return []
        if informative_tokens:
            keyword_tokens = _tokens(" ".join(document["keywords"]))
            body_tokens = _tokens(f"{document['title']} {document['summary']}")
            if not informative_tokens & (keyword_tokens | body_tokens):
                return []
        return [document][:limit] if limit is not None else [document]

    if any(phrase in normalized_question for phrase in ("fundamental rights", "\u092e\u094c\u0932\u093f\u0915 \u0905\u0927\u093f\u0915\u093e\u0930", "maulik adhikar")):
        return documents if limit is None else documents[:limit]

    scored: list[tuple[int, dict[str, Any]]] = []
    for document in documents:
        keyword_tokens = _tokens(" ".join(document["keywords"]))
        body_tokens = _tokens(f"{document['title']} {document['summary']}")
        score = 2 * len(query_tokens & keyword_tokens) + len(query_tokens & body_tokens)
        if score >= 2:
            scored.append((score, document))
    scored.sort(key=lambda result: (-result[0], result[1]["id"]))
    if not scored:
        return []
    relevance_floor = max(2, scored[0][0] * 0.6)
    result_limit = 3 if limit is None else limit
    return [document for score, document in scored if score >= relevance_floor][:result_limit]
