"""Local lexical retrieval with overlap and experimental rarity scoring."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any


CORPUS_PATH = Path(__file__).resolve().parent / "data" / "fundamental_rights.json"
ENGLISH_ONES = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")
ENGLISH_TEENS = ("ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen")
ARTICLE_WORD_IDS = {word: str(number) for number, word in enumerate(ENGLISH_ONES + ENGLISH_TEENS)}
for tens, word in ((20, "twenty"), (30, "thirty"), (40, "forty"), (50, "fifty"),
                   (60, "sixty"), (70, "seventy"), (80, "eighty"), (90, "ninety")):
    ARTICLE_WORD_IDS[word] = str(tens)
    ARTICLE_WORD_IDS.update({f"{word} {ENGLISH_ONES[one]}": str(tens + one) for one in range(1, 10)})
# Common spoken references in the opening fundamental-rights/quiz topics.
# This is an explicit vocabulary, not Hindi number-word or phonetic inference.
ARTICLE_WORD_IDS.update({
    "बारह": "12", "तेरह": "13", "चौदह": "14",
    "पंद्रह": "15", "पन्द्रह": "15", "सोलह": "16", "सत्रह": "17",
    "अठारह": "18", "उन्नीस": "19", "बीस": "20", "इक्कीस": "21", "बाईस": "22",
})
ARTICLE_WORD_EXPRESSION = "|".join(
    r"[\s-]+".join(re.escape(part) for part in word.split())
    for word in sorted(ARTICLE_WORD_IDS, key=lambda word: (-len(word), word))
)
ARTICLE_ID_EXPRESSION = rf"(?:\d+[a-z]?|(?:{ARTICLE_WORD_EXPRESSION})(?:[\s-]+[a-z])?)"
# Python's \w excludes vowel signs/other combining marks. A plain \b can
# therefore accept a known word immediately followed by a Hindi vowel sign.
ARTICLE_ID_END = r"(?![\w\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962-\u0963])"
ARTICLE_REFERENCE_PATTERN = re.compile(
    rf"(?:\b(?:articles?|arts?|anuchhed)\s*[-.]?\s*(?P<article_id>{ARTICLE_ID_EXPRESSION}){ARTICLE_ID_END}|"
    rf"\u0905\u0928\u0941\u091a\u094d\u091b\u0947\u0926\s*[-.]?\s*(?P<hindi_id>{ARTICLE_ID_EXPRESSION}){ARTICLE_ID_END})",
    re.IGNORECASE,
)
ARTICLE_LIST_CONTINUATION_PATTERN = re.compile(
    r"\s*(?:,\s*(?:(?:and|aur|\u0914\u0930)\s+)?|&\s*|"
    rf"(?:and|aur|\u0914\u0930|vs\.?|versus)\s+)(?P<article_id>{ARTICLE_ID_EXPRESSION}){ARTICLE_ID_END}",
    re.IGNORECASE,
)
ARTICLE_RANGE_CONTINUATION_PATTERN = re.compile(
    r"\s*(?:[-\u2013\u2014]\s*|(?:to|through|se|\u0938\u0947)\s+)"
    rf"(?P<article_id>{ARTICLE_ID_EXPRESSION}){ARTICLE_ID_END}",
    re.IGNORECASE,
)
HINDI_STOPWORDS = {
    "\u0905\u0927\u093f\u0915\u093e\u0930",
    "\u0905\u0928\u0941\u091a\u094d\u091b\u0947\u0926",
}
STOPWORDS = {
    "a", "about", "an", "and", "are", "can", "explain", "for", "hai", "hain",
    "ho", "how", "in", "is", "ka", "ke", "ki", "kya", "me", "mein", "of",
    "article", "art", "do", "does", "please", "tell", "the", "to", "what", "who", "which", "why", "ya", "ye", "your",
    "right", "rights", "fundamental", "freedom", "freedoms", "adhikar", "adhikaar",
    *HINDI_STOPWORDS,
}
GENERIC_ARTICLE_QUERY_TOKENS = {
    "tak", "\u0924\u0915",
    "compare", "comparison", "difference", "differences", "different", "between", "vs", "versus",
    "antar", "farq", "fark", "tulna",
    "\u0905\u0902\u0924\u0930", "\u0924\u0941\u0932\u0928\u093e", "\u0914\u0930",
    "hindi", "english", "hinglish", "translate", "translation", "bolo",
    "\u0939\u093f\u0902\u0926\u0940", "\u0939\u093f\u0928\u094d\u0926\u0940",
    "\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u0940", "\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940",
    "\u0939\u093f\u0902\u0917\u094d\u0932\u093f\u0936", "\u092c\u094b\u0932\u094b",
    "example", "examples", "give", "show", "again", "simpler", "repeat", "detail", "details",
    "samjhao", "dobara", "udaharan", "misal", "aasaan", "asan", "ek", "aur",
    "\u0909\u0926\u093e\u0939\u0930\u0923", "\u0926\u094b", "\u092b\u093f\u0930",
    "\u0938\u092e\u091d\u093e\u0913", "\u0906\u0938\u093e\u0928", "\u090f\u0915",
    "cover", "protect", "guarantee", "list", "mean", "say", "provide", "provides",
    "karta", "karti", "kehta", "kehti", "kehte", "क्या", "है", "हैं",
    "कहता", "कहती", "कहते", "written", "said", "में", "likha", "likhi", "likhe",
    "लिखा", "लिखी", "लिखे",
}


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


def _normalize_article_id(raw_id: str) -> str:
    words = " ".join(raw_id.casefold().replace("-", " ").split())
    if words in ARTICLE_WORD_IDS:
        return ARTICLE_WORD_IDS[words]
    number, _, suffix = words.rpartition(" ")
    if number in ARTICLE_WORD_IDS and len(suffix) == 1 and "a" <= suffix <= "z":
        return ARTICLE_WORD_IDS[number] + suffix
    normalized = "".join(
        str(unicodedata.decimal(character)) if character.isdecimal() else character
        for character in raw_id.casefold()
    )
    numeric = re.fullmatch(r"([0-9]+)([a-z]?)", normalized)
    if numeric:
        # Strip zeros as text, without converting an arbitrarily long integer.
        return (numeric.group(1).lstrip("0") or "0") + numeric.group(2)
    return normalized


def _range_article_ids(start: str, end: str) -> list[str]:
    """Expand bounded ascending integer ranges; reject suffix/ambiguous bounds."""
    start, end = _normalize_article_id(start), _normalize_article_id(end)
    if not start.isdecimal() or not end.isdecimal() or len(start) > 3 or len(end) > 3:
        return ["unsupported-range"]
    first, last = int(start), int(end)
    if first < 1 or last < first or last - first + 1 > 64:
        return ["unsupported-range"]
    return [str(number) for number in range(first, last + 1)]


def _article_references(question: str) -> list[tuple[str, list[str]]]:
    """Keep explicit prefixes, immediately connected lists, and numeric ranges."""
    references: list[tuple[str, list[str]]] = []
    for reference in ARTICLE_REFERENCE_PATTERN.finditer(question):
        article_ids: list[str] = []
        current_id = reference.group("article_id") or reference.group("hindi_id")
        end = reference.end()
        while True:
            range_end = ARTICLE_RANGE_CONTINUATION_PATTERN.match(question, end)
            if range_end:
                article_ids.extend(_range_article_ids(current_id, range_end.group("article_id")))
                end = range_end.end()
            else:
                article_ids.append(current_id)
            continuation = ARTICLE_LIST_CONTINUATION_PATTERN.match(question, end)
            if not continuation:
                break
            current_id = continuation.group("article_id")
            end = continuation.end()
        references.append((question[reference.start():end], article_ids))
    return references


def retrieval_query(question: str, prior_questions: list[str]) -> str:
    """Prefer current evidence, then the most recent substantive user topic."""
    current_question = question.strip()
    if ARTICLE_REFERENCE_PATTERN.search(current_question):
        return current_question
    # Only generic clarification requests inherit a prior topic. A new subject
    # must stand on its own even when no note matches, or old words can create
    # false evidence for an unsupported question. Both scorers share this rule.
    if _tokens(current_question) - GENERIC_ARTICLE_QUERY_TOKENS:
        return current_question
    for previous in reversed(prior_questions[-4:]):
        references = _article_references(previous)
        if references:
            return " ".join([*(text for text, _ in references), current_question])
        if _tokens(previous) - GENERIC_ARTICLE_QUERY_TOKENS:
            return f"{previous} {current_question}"
    return current_question


def load_corpus(path: Path = CORPUS_PATH) -> list[dict[str, Any]]:
    """Load notes and fail closed if a record is missing required metadata."""
    return parse_corpus(path.read_text(encoding="utf-8"))


def parse_corpus(text: str) -> list[dict[str, Any]]:
    """Validate one text snapshot, allowing inventories to hash the exact parsed bytes."""
    documents = json.loads(text)
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


def _note_token_fields(document: dict[str, Any]) -> tuple[set[str], set[str]]:
    """Index checked titles/summaries in every available corpus language."""
    body = " ".join(document[field] for field in (
        "title", "summary", "title_hi", "summary_hi", "title_hinglish", "summary_hinglish",
    ))
    return _tokens(" ".join(document["keywords"])), _tokens(body)


def retrieve(question: str, limit: int | None = None, *, scoring: str = "overlap") -> list[dict[str, Any]]:
    """Rank notes with shared article checks and a selected lexical scoring rule."""
    if (
        not isinstance(question, str)
        or not question.strip()
        or (limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1))
    ):
        return []

    if scoring not in {"overlap", "rarity"}:
        raise ValueError("Retrieval scoring must be overlap or rarity.")
    query_tokens = {token for token in _tokens(question) if not token.isdigit()}
    informative_tokens = {
        token for token in query_tokens
        if token not in GENERIC_ARTICLE_QUERY_TOKENS | {"article", "art", "anuchhed"}
        and not token.isdigit()
    }
    normalized_question = question.casefold()
    article_references = _article_references(question)
    documents = load_corpus()
    if article_references:
        # References identify notes; their number/suffix tokens are not topic evidence.
        for reference_text, _ in article_references:
            informative_tokens -= _tokens(reference_text)
        by_id = {document["id"]: document for document in documents}
        selected: dict[str, dict[str, Any]] = {}
        for raw_id in (article_id for _, article_ids in article_references for article_id in article_ids):
            article_id = _normalize_article_id(raw_id)
            document = by_id.get(f"article-{article_id}")
            if document is None:
                return []
            if informative_tokens:
                keyword_tokens, body_tokens = _note_token_fields(document)
                if not informative_tokens & (keyword_tokens | body_tokens):
                    return []
            selected[document["id"]] = document
        results = list(selected.values())
        return results[:limit] if limit is not None else results

    broad_phrases = ("fundamental rights", "\u092e\u094c\u0932\u093f\u0915 \u0905\u0927\u093f\u0915\u093e\u0930", "maulik adhikar")
    matched_phrases = [phrase for phrase in broad_phrases if phrase in normalized_question]
    if matched_phrases:
        topic_tokens = informative_tokens.copy()
        for phrase in matched_phrases:
            topic_tokens -= _tokens(phrase)
        # Overview scaffolding is not evidence of a subject-specific question.
        topic_tokens -= {"from", "starter", "notes", "study", "upsc", "exam", "preparation"}
        if not topic_tokens:
            return documents if limit is None else documents[:limit]
        # Rank the requested subject, without the broad label supplying matches
        # that would mask an unrelated or unsupported topic.
        query_tokens = topic_tokens

    token_fields = [_note_token_fields(document) for document in documents]
    weights: dict[str, float] = {}
    if scoring == "rarity":
        for token in query_tokens:
            frequency = sum(token in keywords | body for keywords, body in token_fields)
            weights[token] = math.log1p(len(documents) / (1 + frequency))
    scored: list[tuple[float, dict[str, Any]]] = []
    for document, (keyword_tokens, body_tokens) in zip(documents, token_fields):
        score = 2 * len(query_tokens & keyword_tokens) + len(query_tokens & body_tokens)
        if score >= 2:
            if scoring == "rarity":
                score = 2 * sum(weights[token] for token in query_tokens & keyword_tokens)
                score += sum(weights[token] for token in query_tokens & body_tokens)
            scored.append((score, document))
    scored.sort(key=lambda result: (-result[0], result[1]["id"]))
    if not scored:
        return []
    relevance_floor = max(2 if scoring == "overlap" else 0, scored[0][0] * 0.6)
    result_limit = 3 if limit is None else limit
    return [document for score, document in scored if score >= relevance_floor][:result_limit]
