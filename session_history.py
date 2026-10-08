"""Explicitly saved text conversations, scoped to the opaque browser cookie."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from progress import DATABASE_PATH
from retrieval import load_corpus

MAX_SAVED_CONVERSATIONS = 20


class HistoryConflict(ValueError):
    """A save ID was retried with different conversation content."""


def _save_id(value: Any) -> str:
    try:
        parsed = uuid.UUID(value) if isinstance(value, str) else None
    except ValueError:
        parsed = None
    if parsed is None or parsed.version != 4:
        raise ValueError("Choose a valid conversation save ID.")
    return str(parsed)


@contextmanager
def _connection(path: Path) -> Iterator[sqlite3.Connection]:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            # Independent from quiz sessions: deleting scores does not delete saved text.
            connection.execute("""CREATE TABLE IF NOT EXISTS saved_conversations (
                browser_session_id TEXT NOT NULL, id TEXT NOT NULL,
                saved_at TEXT NOT NULL, title TEXT NOT NULL, language TEXT NOT NULL,
                message_count INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
                PRIMARY KEY (browser_session_id, id))""")
            connection.execute("""CREATE INDEX IF NOT EXISTS saved_conversations_owner_time
                ON saved_conversations(browser_session_id, saved_at DESC, id DESC)""")
            yield connection
    finally:
        connection.close()


def _snapshot(body: dict[str, Any]) -> dict[str, Any]:
    if body.get("consent_to_save") is not True:
        raise ValueError("Explicit consent is required to store conversation text.")
    language = body.get("language")
    messages = body.get("messages")
    if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
        raise ValueError("Choose Hindi/Hinglish or English for the saved conversation.")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 20:
        raise ValueError("Save between 1 and 20 conversation messages.")
    sources = {document["id"]: document["source"] for document in load_corpus()}
    cleaned = []
    for message in messages:
        if (not isinstance(message, dict) or not isinstance(message.get("role"), str)
                or message["role"] not in {"user", "assistant"}):
            raise ValueError("Saved messages need a user or assistant role.")
        content = message.get("content")
        limit = 1200 if message["role"] == "user" else 3000
        if not isinstance(content, str) or not content.strip() or len(content) > limit:
            raise ValueError("Saved message text is empty or exceeds its role limit.")
        try:
            content.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("Saved message text must use valid Unicode.") from None
        source_ids = message.get("source_ids", [])
        if not isinstance(source_ids, list) or len(source_ids) > len(sources):
            raise ValueError("Saved source IDs are invalid.")
        if any(not isinstance(source_id, str) or source_id not in sources for source_id in source_ids):
            raise ValueError("Saved sources must reference checked study notes.")
        if len(set(source_ids)) != len(source_ids):
            raise ValueError("Saved source IDs must be distinct.")
        cleaned.append({
            "role": message["role"], "content": content,
            "sources": [{"id": source_id, **sources[source_id]} for source_id in source_ids],
        })
    if not any(message["role"] == "user" for message in cleaned):
        raise ValueError("Save a conversation containing at least one learner message.")
    return {"schema_version": 1, "language": language, "messages": cleaned}


def save_conversation(session_id: str, body: dict[str, Any], path: Path = DATABASE_PATH) -> dict[str, Any]:
    save_id = _save_id(body.get("save_id"))
    snapshot = _snapshot(body)
    encoded = json.dumps(snapshot, ensure_ascii=False, sort_keys=True)
    title = next(message["content"] for message in snapshot["messages"] if message["role"] == "user").strip()[:80]
    saved_at = datetime.now(timezone.utc).isoformat()
    with _connection(path) as connection:
        # Serialize lookup/insert/retention so concurrent unchanged retries write once.
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute(
            "SELECT snapshot_json, saved_at FROM saved_conversations WHERE browser_session_id = ? AND id = ?",
            (session_id, save_id),
        ).fetchone()
        if existing:
            if existing["snapshot_json"] != encoded:
                raise HistoryConflict("This save ID already contains a different conversation. Use a new save ID.")
            saved_at = existing["saved_at"]
        else:
            connection.execute("INSERT INTO saved_conversations VALUES (?, ?, ?, ?, ?, ?, ?)",
                               (session_id, save_id, saved_at, title, snapshot["language"], len(snapshot["messages"]), encoded))
            connection.execute("""DELETE FROM saved_conversations WHERE browser_session_id = ? AND id IN (
                SELECT id FROM saved_conversations WHERE browser_session_id = ?
                ORDER BY saved_at DESC, id DESC LIMIT -1 OFFSET ?)""",
                (session_id, session_id, MAX_SAVED_CONVERSATIONS))
    return {"id": save_id, "saved_at_utc": saved_at, "title": title,
            "language": snapshot["language"], "message_count": len(snapshot["messages"])}


def list_conversations(session_id: str, path: Path = DATABASE_PATH) -> dict[str, Any]:
    with _connection(path) as connection:
        rows = connection.execute("""SELECT id, saved_at AS saved_at_utc, title, language, message_count
            FROM saved_conversations WHERE browser_session_id = ? ORDER BY saved_at DESC, id DESC LIMIT ?""",
            (session_id, MAX_SAVED_CONVERSATIONS)).fetchall()
    return {"schema_version": 1, "conversations": [dict(row) for row in rows]}


def get_conversation(session_id: str, save_id: Any, path: Path = DATABASE_PATH) -> dict[str, Any] | None:
    save_id = _save_id(save_id)
    with _connection(path) as connection:
        row = connection.execute("""SELECT id, saved_at, snapshot_json FROM saved_conversations
            WHERE browser_session_id = ? AND id = ?""", (session_id, save_id)).fetchone()
    if row is None:
        return None
    try:
        snapshot = json.loads(row["snapshot_json"])
        if not isinstance(snapshot, dict) or snapshot.get("schema_version") != 1:
            raise ValueError("Unsupported stored snapshot.")
    except (ValueError, TypeError) as error:
        raise RuntimeError("Stored conversation could not be read.") from error
    return {"id": row["id"], "saved_at_utc": row["saved_at"], **snapshot}


def clear_conversations(session_id: str, path: Path = DATABASE_PATH) -> None:
    with _connection(path) as connection:
        connection.execute("DELETE FROM saved_conversations WHERE browser_session_id = ?", (session_id,))
