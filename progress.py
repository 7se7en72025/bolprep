"""Local SQLite storage for quiz progress, scoped to an opaque browser session."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


DATABASE_PATH = Path(__file__).resolve().parent / ".codex" / "bolprep.sqlite3"


class ProgressConflict(ValueError):
    """A retry used the same quiz answer slot with different answer text."""


def _connect(path: Path = DATABASE_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def _connection(path: Path = DATABASE_PATH) -> Iterator[sqlite3.Connection]:
    connection = _connect(path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(path: Path = DATABASE_PATH) -> None:
    """Create the local progress tables when the app first needs them."""
    with _connection(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quiz_runs (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                topic TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quiz_run_questions (
                quiz_id TEXT NOT NULL REFERENCES quiz_runs(id) ON DELETE CASCADE,
                question_id TEXT NOT NULL,
                PRIMARY KEY (quiz_id, question_id)
            );
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                quiz_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                score INTEGER NOT NULL,
                complete INTEGER NOT NULL,
                result_json TEXT NOT NULL,
                saved_at TEXT NOT NULL,
                PRIMARY KEY (quiz_id, question_id),
                FOREIGN KEY (quiz_id, question_id)
                    REFERENCES quiz_run_questions(quiz_id, question_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_quiz_runs_session
                ON quiz_runs(session_id, created_at);
            """
        )
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(quiz_attempts)")}
        if "answer_hash" in columns and "idempotency_key" not in columns:
            connection.execute(
                """CREATE TABLE quiz_attempts_new (
                    quiz_id TEXT NOT NULL,
                    question_id TEXT NOT NULL,
                    idempotency_key TEXT,
                    score INTEGER NOT NULL,
                    complete INTEGER NOT NULL,
                    result_json TEXT NOT NULL,
                    saved_at TEXT NOT NULL,
                    PRIMARY KEY (quiz_id, question_id),
                    FOREIGN KEY (quiz_id, question_id)
                        REFERENCES quiz_run_questions(quiz_id, question_id) ON DELETE CASCADE
                )"""
            )
            connection.execute(
                """INSERT INTO quiz_attempts_new
                   (quiz_id, question_id, idempotency_key, score, complete, result_json, saved_at)
                   SELECT quiz_id, question_id, NULL, score, complete, result_json, saved_at
                   FROM quiz_attempts"""
            )
            connection.execute("DROP TABLE quiz_attempts")
            connection.execute("ALTER TABLE quiz_attempts_new RENAME TO quiz_attempts")


def ensure_session(session_id: str, path: Path = DATABASE_PATH) -> None:
    initialize(path)
    with _connection(path) as connection:
        connection.execute(
            "INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?)",
            (session_id, _now()),
        )


def create_quiz_run(
    session_id: str, quiz_id: str, topic: str, question_ids: list[str], path: Path = DATABASE_PATH
) -> None:
    initialize(path)
    with _connection(path) as connection:
        connection.execute(
            "INSERT INTO quiz_runs (id, session_id, topic, created_at) VALUES (?, ?, ?, ?)",
            (quiz_id, session_id, topic, _now()),
        )
        connection.executemany(
            "INSERT INTO quiz_run_questions (quiz_id, question_id) VALUES (?, ?)",
            [(quiz_id, question_id) for question_id in question_ids],
        )


def save_answer(
    session_id: str,
    quiz_id: str,
    question_id: str,
    idempotency_key: str,
    result: dict[str, Any],
    path: Path = DATABASE_PATH,
) -> dict[str, Any]:
    """Save a scored answer once; a retry with the same key returns the first result."""
    initialize(path)
    if not isinstance(idempotency_key, str) or not idempotency_key or len(idempotency_key) > 100:
        raise ValueError("A valid idempotency key is required to save this answer.")
    with _connection(path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        allowed = connection.execute(
            """SELECT 1 FROM quiz_run_questions q
               JOIN quiz_runs r ON r.id = q.quiz_id
               WHERE r.id = ? AND r.session_id = ? AND q.question_id = ?""",
            (quiz_id, session_id, question_id),
        ).fetchone()
        if allowed is None:
            raise ValueError("This question does not belong to an active quiz in this browser session.")

        saved = connection.execute(
            "SELECT idempotency_key, result_json FROM quiz_attempts WHERE quiz_id = ? AND question_id = ?",
            (quiz_id, question_id),
        ).fetchone()
        if saved:
            if saved["idempotency_key"] is None:
                return json.loads(saved["result_json"])
            if saved["idempotency_key"] != idempotency_key:
                raise ProgressConflict("This quiz answer was already saved. Start a new quiz to answer again.")
            return json.loads(saved["result_json"])

        connection.execute(
            """INSERT INTO quiz_attempts
               (quiz_id, question_id, idempotency_key, score, complete, result_json, saved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                quiz_id,
                question_id,
                idempotency_key,
                result["score"],
                int(result["complete"]),
                json.dumps(result, ensure_ascii=False),
                _now(),
            ),
        )
    return result


def clear_progress(session_id: str, path: Path = DATABASE_PATH) -> None:
    initialize(path)
    with _connection(path) as connection:
        connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


def get_progress(session_id: str, path: Path = DATABASE_PATH) -> dict[str, Any]:
    initialize(path)
    with _connection(path) as connection:
        rows = connection.execute(
            """SELECT a.question_id, a.score, a.complete, a.saved_at
               FROM quiz_attempts a
               JOIN quiz_runs r ON r.id = a.quiz_id
               WHERE r.session_id = ?
               ORDER BY a.saved_at DESC""",
            (session_id,),
        ).fetchall()

    by_question: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        by_question.setdefault(row["question_id"], []).append(row)
    questions = []
    for question_id, attempts in sorted(by_question.items()):
        article_number = question_id.removeprefix("art").split("_", 1)[0]
        average_score = round(sum(item["score"] for item in attempts) / len(attempts))
        questions.append(
            {
                "question_id": question_id,
                "topic": f"Article {article_number}",
                "attempts": len(attempts),
                "average_score": average_score,
                "latest_score": attempts[0]["score"],
                "latest_complete": bool(attempts[0]["complete"]),
                "last_attempt_at": attempts[0]["saved_at"],
            }
        )
    weak_topics = [item for item in questions if not item["latest_complete"] or item["latest_score"] < 70]
    overall_average = round(sum(row["score"] for row in rows) / len(rows)) if rows else None
    return {
        "attempt_count": len(rows),
        "average_score": overall_average,
        "questions": questions,
        "weak_topics": weak_topics,
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
