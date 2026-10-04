"""Small lexical retrieval baseline over the checked local study notes."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


CORPUS_PATH = Path(__file__).resolve().parent / "data" / "fundamental_rights.json"
STOPWORDS = {
    "a", "about", "an", "and", "are", "can", "explain", "for", "hai", "hain",
    "ho", "how", "in", "is", "ka", "ke", "ki", "kya", "me", "mein", "of",
    "article", "art", "does", "please", "tell", "the", "to", "what", "who", "which", "why", "ya", "ye", "your",
    "right", "rights", "fundamental", "freedom", "freedoms", "adhikar", "adhikaar",
}
GENERIC_ARTICLE_QUERY_TOKENS = {"cover", "protect", "guarantee", "list", "mean", "say", "karta", "karti"}


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[\w]+", text.casefold(), flags=re.UNICODE)
        if token not in STOPWORDS and len(token) > 1
    }


def load_corpus(path: Path = CORPUS_PATH) -> list[dict[str, Any]]:
    """Load notes and fail closed if a record is missing required metadata."""
    documents = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(documents, list) or not documents:
        raise ValueError("Study corpus must be a non-empty JSON list.")
    required = {
        "id", "title", "title_hi", "title_hinglish", "summary", "summary_hi",
        "summary_hinglish", "keywords", "source",
    }
    for document in documents:
        if not isinstance(document, dict) or not required.issubset(document):
            raise ValueError("Each study note needs an id, title, summary, keywords, and source.")
        source = document["source"]
        if (
            not isinstance(source, dict)
            or not isinstance(source.get("title"), str)
            or not isinstance(source.get("url"), str)
            or not source["url"].startswith("https://")
            or not isinstance(source.get("section"), str)
        ):
            raise ValueError(f"Study note {document['id']} has invalid source metadata.")
        if (
            not isinstance(document["id"], str)
            or not isinstance(document["title"], str)
            or not all(
                isinstance(document[field], str)
                for field in ("summary", "summary_hi", "summary_hinglish", "title_hi", "title_hinglish")
            )
            or not isinstance(document["keywords"], list)
            or not all(isinstance(keyword, str) for keyword in document["keywords"])
        ):
            raise ValueError("Study note fields have invalid types.")
    return documents


def retrieve(question: str, limit: int = 3) -> list[dict[str, Any]]:
    """Rank notes with a transparent keyword overlap score and article-number boost."""
    if not isinstance(question, str) or not question.strip() or limit < 1:
        return []

    query_tokens = {token for token in _tokens(question) if not token.isdigit()}
    normalized_question = question.casefold()
    if any(phrase in normalized_question for phrase in ("fundamental rights", "मौलिक अधिकार", "maulik adhikar")):
        return load_corpus()[:limit]

    informative_tokens = {
        token for token in query_tokens
        if token not in GENERIC_ARTICLE_QUERY_TOKENS and not token.isdigit()
    }
    scored: list[tuple[int, dict[str, Any]]] = []
    for document in load_corpus():
        keyword_tokens = _tokens(" ".join(document["keywords"]))
        body_tokens = _tokens(f"{document['title']} {document['summary']}")
        score = 2 * len(query_tokens & keyword_tokens) + len(query_tokens & body_tokens)
        article_id = document["id"].removeprefix("article-")
        if re.search(rf"\b(?:article|art)\s*[-.]?\s*{re.escape(article_id)}\b", question, re.IGNORECASE):
            topic_match = bool(informative_tokens & (keyword_tokens | body_tokens))
            if topic_match or not informative_tokens:
                score += 12
        if score >= 2:
            scored.append((score, document))

    scored.sort(key=lambda result: (-result[0], result[1]["id"]))
    if not scored:
        return []
    relevance_floor = max(2, scored[0][0] * 0.6)
    return [document for score, document in scored if score >= relevance_floor][:limit]
