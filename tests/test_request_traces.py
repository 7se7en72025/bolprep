"""Provider-free tests for opt-in, server-owned tutor diagnostics."""

import http.client
import json
import os
import sqlite3
import threading
import unittest
import uuid
from contextlib import closing
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import server
import trace_store
from access import AccessGate
from request_limits import RequestLimiter


class QuietHandler(server.BolPrepHandler):
    def log_message(self, *args):
        pass


class RequestTraceHttpTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.database = Path(temporary.name) / "traces.sqlite3"
        offline = patch.dict(os.environ, {"BOLPREP_OFFLINE": "1"})
        offline.start()
        self.addCleanup(offline.stop)
        self._patch(server, "ACCESS_GATE", AccessGate(""))
        self._patch(server, "REQUEST_LIMITER", RequestLimiter({
            bucket: 100 for bucket in server.REQUEST_LIMITER.limits
        }))
        for name in ("save_trace", "list_traces", "clear_traces"):
            self._patch(server, name, partial(getattr(trace_store, name), path=self.database))
        self._patch(server, "run_agent_turn", self.fake_agent)
        self.http = None
        self.addCleanup(self.stop_http)
        self.start_http()

    def _patch(self, module, name, value):
        active = patch.object(module, name, value)
        active.start()
        self.addCleanup(active.stop)

    def start_http(self):
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.http.daemon_threads = True
        self.port = self.http.server_address[1]
        self.worker = threading.Thread(target=self.http.serve_forever, kwargs={"poll_interval": 0.01})
        self.worker.start()

    def stop_http(self):
        if self.http is not None:
            self.http.shutdown()
            self.http.server_close()
            self.worker.join(timeout=3)
            self.assertFalse(self.worker.is_alive())
            self.http = None

    @staticmethod
    def fake_agent(question, history, session_id, language, **kwargs):
        return {"answer": "PRIVATE_RESPONSE_MARKER", "mode": "offline", "sources": [], "tool_events": []}

    def request(self, method, path, body=None, cookie=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Content-Type": "application/json"}
        if cookie:
            headers["Cookie"] = cookie
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        try:
            connection.request(method, path, payload, headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def cookie(self):
        status, headers, _ = self.request("GET", "/")
        self.assertEqual(status, 200)
        return headers["Set-Cookie"].split(";", 1)[0]

    def turn(self, cookie, retain_trace=None, question="PRIVATE_QUESTION_MARKER"):
        body = {"question": question, "language": "en-IN", "history": []}
        if retain_trace is not None:
            body["retain_trace"] = retain_trace
        status, _, content = self.request("POST", "/api/agent/turn", body, cookie)
        if status != 200:
            return status, json.loads(content)
        return status, [json.loads(line) for line in content.splitlines()]

    def traces(self, cookie):
        status, _, content = self.request("GET", "/api/traces", cookie=cookie)
        self.assertEqual(status, 200)
        return json.loads(content)["traces"]

    def test_opt_in_owner_restart_delete_and_no_content(self):
        owner, other = self.cookie(), self.cookie()
        self.assertNotEqual(owner, other)
        status, events = self.turn(owner, True)
        self.assertEqual(status, 200)
        complete = events[-1]["payload"]
        self.assertEqual(complete["trace_storage"], "saved")
        trace = complete["trace"]
        self.assertEqual(trace["outcome"], "completed")
        self.assertEqual(trace["failure_reason"], None)
        self.assertEqual(self.traces(owner), [trace])
        self.assertEqual(self.traces(other), [])
        stored = self.database.read_bytes()
        self.assertNotIn(b"PRIVATE_QUESTION_MARKER", stored)
        self.assertNotIn(b"PRIVATE_RESPONSE_MARKER", stored)

        self.stop_http()
        self.start_http()
        self.assertEqual(self.traces(owner), [trace])
        status, _, content = self.request("POST", "/api/traces/clear", {}, other)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(content), {"ok": True})
        self.assertEqual(self.traces(owner), [trace])
        status, _, content = self.request("POST", "/api/traces/clear", {}, owner)
        self.assertEqual(status, 200)
        self.assertEqual(self.traces(owner), [])

    def test_opt_out_invalid_flag_and_empty_clear_body(self):
        owner = self.cookie()
        for flag in (None, False):
            status, events = self.turn(owner, flag)
            self.assertEqual(status, 200)
            self.assertNotIn("trace_storage", events[-1]["payload"])
        self.assertFalse(self.database.exists(), "Opted-out turns must not open SQLite")
        for bad_flag in ("true", 1, [], {}):
            status, error = self.turn(owner, bad_flag)
            self.assertEqual(status, 400)
            self.assertNotIn("PRIVATE_QUESTION_MARKER", json.dumps(error))
        self.assertFalse(self.database.exists())
        status, _, _ = self.request("POST", "/api/traces/clear", {"unexpected": True}, owner)
        self.assertEqual(status, 400)
        self.assertFalse(self.database.exists())

    def test_failed_agent_and_storage_failure_do_not_leak_or_change_tutor_result(self):
        owner = self.cookie()

        def fail_agent(*args, **kwargs):
            raise RuntimeError("PRIVATE_PROVIDER_ERROR_MARKER")

        with patch.object(server, "run_agent_turn", fail_agent):
            status, events = self.turn(owner, True)
        self.assertEqual(status, 200)
        self.assertEqual(events[-1]["type"], "error")
        self.assertEqual(events[-1]["trace_storage"], "saved")
        failed = self.traces(owner)[0]
        self.assertEqual((failed["outcome"], failed["failure_reason"]), ("failed", "agent-error"))
        self.assertIsNone(failed["usage"])
        self.assertNotIn(b"PRIVATE_PROVIDER_ERROR_MARKER", self.database.read_bytes())

        with patch.object(server, "save_trace", side_effect=sqlite3.OperationalError("unavailable")):
            status, events = self.turn(owner, True)
        self.assertEqual(status, 200)
        self.assertEqual(events[-1]["type"], "complete")
        self.assertEqual(events[-1]["payload"]["answer"], "PRIVATE_RESPONSE_MARKER")
        self.assertEqual(events[-1]["payload"]["trace_storage"], "unavailable")
        self.assertEqual(len(self.traces(owner)), 1)

    def test_failed_turn_retains_server_observed_score_save_and_source_count(self):
        owner = self.cookie()

        def fail_after_save(*args, **kwargs):
            kwargs["on_sources"]([{"title": "Checked source", "url": "https://example.test", "section": "14"}])
            kwargs["on_tool_event"]({"name": "score_answer", "ok": True,
                                     "result": {"answer": "PRIVATE_TOOL_RESULT_MARKER"}})
            kwargs["on_tool_event"]({"name": "save_progress", "ok": True,
                                     "result": {"answer": "PRIVATE_SAVE_RESULT_MARKER"}})
            raise RuntimeError("PRIVATE_PROVIDER_ERROR_MARKER")

        with patch.object(server, "run_agent_turn", fail_after_save), patch.object(
            server, "api_is_configured", return_value=True
        ):
            status, events = self.turn(owner, True)
        self.assertEqual(status, 200)
        self.assertEqual(events[-1]["type"], "error")
        trace = events[-1]["trace"]
        self.assertEqual(trace["outcome"], "failed")
        self.assertEqual(trace["source_count"], 1)
        self.assertEqual(trace["tool_outcomes"], [
            {"name": "score_answer", "ok": True}, {"name": "save_progress", "ok": True},
        ])
        self.assertIsNone(trace["usage"])
        self.assertIsNone(trace["model_response_count"])
        self.assertEqual(self.traces(owner), [trace])
        stored = self.database.read_bytes()
        for marker in (b"PRIVATE_TOOL_RESULT_MARKER", b"PRIVATE_SAVE_RESULT_MARKER",
                       b"PRIVATE_PROVIDER_ERROR_MARKER", b"PRIVATE_QUESTION_MARKER"):
            self.assertNotIn(marker, stored)

    def test_observed_write_failure_preserves_known_usage(self):
        owner = self.cookie()

        def model_result(*args, **kwargs):
            return {
                "answer": "PRIVATE_MODEL_ANSWER", "mode": "model", "sources": [], "tool_events": [],
                "provider_reported_models": ["reported-model"], "model_response_count": 1,
                "usage_response_count": 1,
                "usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15, "response_count": 1},
            }

        with patch.object(server, "run_agent_turn", model_result), patch.object(
            QuietHandler, "_finish_chunked_response", side_effect=BrokenPipeError
        ):
            with self.assertRaises(http.client.IncompleteRead):
                self.turn(owner, True)
        saved = self.traces(owner)
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["outcome"], "disconnected")
        self.assertEqual(saved[0]["failure_reason"], "http-write-failed")
        self.assertEqual(saved[0]["usage"]["total_tokens"], 15)
        self.assertEqual(saved[0]["provider_reported_models"], ["reported-model"])
        self.assertNotIn(b"PRIVATE_MODEL_ANSWER", self.database.read_bytes())


class TraceStoreTests(unittest.TestCase):
    @staticmethod
    def trace():
        return {
            "request_id": str(uuid.uuid4()), "started_at_utc": datetime.now(timezone.utc).isoformat(),
            "outcome": "completed", "server_duration_ms": 1.2, "mode": "offline",
            "configured_model": None, "provider_reported_models": [], "source_count": 0,
            "tool_outcomes": [], "usage": None, "model_response_count": 0,
            "usage_response_count": 0, "failure_reason": None,
        }

    def test_cap_retention_and_allowlist(self):
        with TemporaryDirectory() as temporary:
            database = Path(temporary) / "traces.sqlite3"
            owner = str(uuid.uuid4())
            for number in range(101):
                trace = self.trace()
                trace["private_text"] = "NEVER_PERSIST_ME"
                trace_store.save_trace(owner, trace, database)
            listed = trace_store.list_traces(owner, database)["traces"]
            self.assertEqual(len(listed), 100)
            self.assertNotIn(b"NEVER_PERSIST_ME", database.read_bytes())
            old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
            with closing(sqlite3.connect(database)) as connection:
                with connection:
                    connection.execute("UPDATE request_traces SET recorded_at_utc = ? WHERE request_id = ?",
                                       (old, listed[-1]["request_id"]))
            self.assertEqual(len(trace_store.list_traces(owner, database)["traces"]), 99)

    def test_read_revalidates_stored_rows(self):
        with TemporaryDirectory() as temporary:
            database = Path(temporary) / "traces.sqlite3"
            owner = str(uuid.uuid4())
            trace = self.trace()
            trace_store.save_trace(owner, trace, database)
            with closing(sqlite3.connect(database)) as connection:
                with connection:
                    connection.execute("UPDATE request_traces SET trace_json = ? WHERE request_id = ?",
                                       (json.dumps({**trace, "private_text": "NEVER_RETURN_ME"}),
                                        trace["request_id"]))
            returned = trace_store.list_traces(owner, database)["traces"]
            self.assertEqual(len(returned), 1)
            self.assertNotIn("private_text", returned[0])


if __name__ == "__main__":
    unittest.main()
