"""Server-owned, opt-in tutor request metadata in the local SQLite database."""

from __future__ import annotations

import json
import math
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from progress import DATABASE_PATH

MAX_TRACES_PER_SESSION = 100
RETENTION_DAYS = 7
_MODEL_LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}\Z")
_TOOLS = ("start_quiz", "score_answer", "save_progress", "get_weak_topics")
_OUTCOMES = ("completed", "failed", "disconnected")
_FAILURE_REASONS = (None, "agent-error", "http-write-failed")


def _count(value: Any) -> bool:
    return type(value) is int and 0 <= value <= 9007199254740991


def _trace(value: dict[str, Any]) -> dict[str, Any]:
    """Copy only known metadata; never serialize a request/result wholesale."""
    if not isinstance(value, dict):
        raise ValueError("Request trace is invalid.")
    request_id = value.get("request_id")
    try:
        from uuid import UUID
        valid_id = isinstance(request_id, str) and UUID(request_id).version == 4
    except ValueError:
        valid_id = False
    started_at = value.get("started_at_utc")
    try:
        parsed_start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        valid_start = parsed_start.utcoffset() == timedelta(0)
    except (AttributeError, TypeError, ValueError):
        valid_start = False
    duration = value.get("server_duration_ms")
    mode = value.get("mode")
    configured = value.get("configured_model")
    outcome = value.get("outcome")
    reason = value.get("failure_reason")
    if (not valid_id or not valid_start or not isinstance(started_at, str) or len(started_at) > 64
            or type(duration) not in (int, float) or not math.isfinite(duration) or not 0 <= duration <= 86400000
            or mode not in ("model", "offline") or outcome not in _OUTCOMES
            or reason not in _FAILURE_REASONS
            or (outcome == "completed" and reason is not None)
            or (outcome == "failed" and reason != "agent-error")
            or (outcome == "disconnected" and reason != "http-write-failed")
            or configured is not None and (not isinstance(configured, str) or not _MODEL_LABEL.fullmatch(configured))
            or not _count(value.get("source_count")) or value["source_count"] > 100):
        raise ValueError("Request trace is invalid.")
    tools = value.get("tool_outcomes")
    if (not isinstance(tools, list) or len(tools) > 6
            or any(not isinstance(tool, dict) or tool.get("name") not in _TOOLS
                   or type(tool.get("ok")) is not bool for tool in tools)):
        raise ValueError("Request trace is invalid.")
    response_count = value.get("model_response_count")
    usage_count = value.get("usage_response_count")
    if (not (response_count is None or _count(response_count))
            or not (usage_count is None or _count(usage_count))
            or response_count is not None and usage_count is not None and usage_count > response_count):
        raise ValueError("Request trace is invalid.")
    models = value.get("provider_reported_models")
    if (models is not None and (not isinstance(models, list) or len(models) > 4
            or response_count != len(models)
            or any(model is not None and (not isinstance(model, str) or not _MODEL_LABEL.fullmatch(model))
                   for model in models))):
        raise ValueError("Request trace is invalid.")
    usage = value.get("usage")
    usage_fields = ("input_tokens", "output_tokens", "total_tokens", "response_count")
    if usage is not None:
        if (not isinstance(usage, dict) or not all(_count(usage.get(field)) for field in usage_fields)
                or usage["response_count"] == 0 or usage["response_count"] != response_count
                or usage["response_count"] != usage_count):
            raise ValueError("Request trace is invalid.")
        usage = {field: usage[field] for field in usage_fields}
    return {
        "request_id": request_id,
        "started_at_utc": started_at,
        "outcome": outcome,
        "server_duration_ms": duration,
        "mode": mode,
        "configured_model": configured,
        "provider_reported_models": models,
        "source_count": value["source_count"],
        "tool_outcomes": [{"name": tool["name"], "ok": tool["ok"]} for tool in tools],
        "usage": usage,
        "model_response_count": response_count,
        "usage_response_count": usage_count,
        "failure_reason": reason,
    }


@contextmanager
def _connection(path: Path) -> Iterator[sqlite3.Connection]:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS request_traces (
                browser_session_id TEXT NOT NULL, request_id TEXT NOT NULL,
                recorded_at_utc TEXT NOT NULL, trace_json TEXT NOT NULL,
                PRIMARY KEY (browser_session_id, request_id))""")
            connection.execute("""CREATE INDEX IF NOT EXISTS request_traces_owner_time
                ON request_traces(browser_session_id, recorded_at_utc DESC, request_id DESC)""")
            yield connection
    finally:
        connection.close()


def _prune(connection: sqlite3.Connection, session_id: str, now: datetime) -> None:
    cutoff = (now - timedelta(days=RETENTION_DAYS)).isoformat()
    connection.execute("DELETE FROM request_traces WHERE recorded_at_utc < ?", (cutoff,))
    connection.execute("""DELETE FROM request_traces WHERE browser_session_id = ? AND request_id IN (
        SELECT request_id FROM request_traces WHERE browser_session_id = ?
        ORDER BY recorded_at_utc DESC, request_id DESC LIMIT -1 OFFSET ?)""",
        (session_id, session_id, MAX_TRACES_PER_SESSION))


def save_trace(session_id: str, trace: dict[str, Any], path: Path = DATABASE_PATH) -> None:
    cleaned = _trace(trace)
    now = datetime.now(timezone.utc)
    with _connection(path) as connection:
        connection.execute("""INSERT INTO request_traces VALUES (?, ?, ?, ?)
            ON CONFLICT(browser_session_id, request_id) DO UPDATE SET
            recorded_at_utc = excluded.recorded_at_utc, trace_json = excluded.trace_json""",
            (session_id, cleaned["request_id"], now.isoformat(), json.dumps(cleaned, ensure_ascii=False)))
        _prune(connection, session_id, now)


def list_traces(session_id: str, path: Path = DATABASE_PATH) -> dict[str, Any]:
    with _connection(path) as connection:
        _prune(connection, session_id, datetime.now(timezone.utc))
        rows = connection.execute("""SELECT trace_json FROM request_traces WHERE browser_session_id = ?
            ORDER BY recorded_at_utc DESC, request_id DESC LIMIT ?""",
            (session_id, MAX_TRACES_PER_SESSION)).fetchall()
    return {"traces": [_trace(json.loads(row["trace_json"])) for row in rows]}


def clear_traces(session_id: str, path: Path = DATABASE_PATH) -> None:
    with _connection(path) as connection:
        connection.execute("DELETE FROM request_traces WHERE browser_session_id = ?", (session_id,))
