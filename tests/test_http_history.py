"""Provider-free HTTP storage checks using an isolated SQLite database."""

import http.client
import json
import os
import threading
import unittest
import uuid
from copy import deepcopy
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import progress
import server
import session_history
from access import AccessGate
from request_limits import RequestLimiter


class QuietHandler(server.BolPrepHandler):
    def log_message(self, *args):
        pass


class SavedDataHttpTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        database = Path(temporary.name) / "saved-data.sqlite3"

        offline = patch.dict(os.environ, {"BOLPREP_OFFLINE": "1"})
        offline.start()
        self.addCleanup(offline.stop)
        self._patch(server, "ACCESS_GATE", AccessGate(""))
        self._patch(server, "REQUEST_LIMITER", RequestLimiter({
            bucket: 100 for bucket in server.REQUEST_LIMITER.limits
        }))
        for name in ("save_conversation", "list_conversations", "get_conversation", "clear_conversations"):
            self._patch(server, name, partial(getattr(session_history, name), path=database))
        for name in ("create_quiz_run", "save_answer", "get_progress", "clear_progress"):
            self._patch(server, name, partial(getattr(progress, name), path=database))

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

    def request(self, method, path, body=None, cookie=None, raw=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Content-Type": "application/json"}
        if cookie:
            headers["Cookie"] = cookie
        payload = raw if raw is not None else json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        try:
            connection.request(method, path, payload, headers)
            response = connection.getresponse()
            result = (response.status, dict(response.getheaders()), json.loads(response.read()))
            return result
        finally:
            connection.close()

    def browser_cookie(self):
        status, headers, _ = self.request("GET", "/api/history")
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        return headers["Set-Cookie"].split(";", 1)[0]

    @staticmethod
    def save_body(save_id=None, question="Article 14 kya hai?"):
        return {
            "save_id": save_id or str(uuid.uuid4()),
            "consent_to_save": True,
            "language": "hi-IN",
            "messages": [
                {"role": "user", "content": question},
                {"role": "assistant", "content": "Kanoon ke samne samanata.", "source_ids": ["article-14"]},
            ],
        }

    def test_saved_conversation_owner_retry_and_restart(self):
        owner = self.browser_cookie()
        other = self.browser_cookie()
        self.assertNotEqual(owner, other)
        body = self.save_body()

        status, _, first = self.request("POST", "/api/history", body, owner)
        self.assertEqual(status, 200)
        self.assertEqual(first["id"], body["save_id"])
        self.assertEqual(first["message_count"], 2)
        status, _, retry = self.request("POST", "/api/history", body, owner)
        self.assertEqual(status, 200)
        self.assertEqual(retry, first)

        changed = deepcopy(body)
        changed["messages"][0]["content"] = "Different question"
        status, _, _ = self.request("POST", "/api/history", changed, owner)
        self.assertEqual(status, 409)

        status, _, owner_list = self.request("GET", "/api/history", cookie=owner)
        self.assertEqual(status, 200)
        self.assertEqual([item["id"] for item in owner_list["conversations"]], [body["save_id"]])
        status, _, other_list = self.request("GET", "/api/history", cookie=other)
        self.assertEqual(status, 200)
        self.assertEqual(other_list["conversations"], [])
        status, _, denied = self.request("POST", "/api/history/load", {"save_id": body["save_id"]}, other)
        self.assertEqual(status, 404)
        self.assertNotIn(body["messages"][0]["content"], json.dumps(denied))

        self.stop_http()
        self.start_http()
        status, _, loaded = self.request("POST", "/api/history/load", {"save_id": body["save_id"]}, owner)
        self.assertEqual(status, 200)
        self.assertEqual(loaded["messages"][0]["content"], body["messages"][0]["content"])
        self.assertEqual(loaded["messages"][1]["sources"][0]["id"], "article-14")
        self.assertEqual(loaded["saved_at_utc"], first["saved_at_utc"])

        status, _, _ = self.request("DELETE", "/api/history", cookie=other)
        self.assertEqual(status, 200)
        status, _, still_loaded = self.request("POST", "/api/history/load", {"save_id": body["save_id"]}, owner)
        self.assertEqual(status, 200)
        self.assertEqual(still_loaded, loaded)
        status, _, _ = self.request("DELETE", "/api/history", cookie=owner)
        self.assertEqual(status, 200)
        status, _, empty = self.request("GET", "/api/history", cookie=owner)
        self.assertEqual(status, 200)
        self.assertEqual(empty["conversations"], [])

    def test_progress_owner_retry_restart_and_independent_delete(self):
        owner = self.browser_cookie()
        other = self.browser_cookie()
        saved = self.save_body()
        self.assertEqual(self.request("POST", "/api/history", saved, owner)[0], 200)
        status, _, quiz = self.request("POST", "/api/quiz/start", {
            "topic": "fundamental rights", "question_count": 2,
            "language": "en-IN", "difficulty": "basic",
        }, owner)
        self.assertEqual(status, 200)
        self.assertIn("art14_equality", {question["id"] for question in quiz["questions"]})
        answer = {
            "quiz_id": quiz["quiz_id"], "question_id": "art14_equality",
            "answer": "Equality before the law and equal protection of the laws.",
            "language": "en-IN", "idempotency_key": str(uuid.uuid4()),
        }
        status, _, result = self.request("POST", "/api/quiz/score", answer, owner)
        self.assertEqual(status, 200)
        self.assertEqual(result["score"], 100)
        self.assertEqual(self.request("POST", "/api/quiz/score", answer, owner)[2], result)

        changed_key = {**answer, "idempotency_key": str(uuid.uuid4())}
        self.assertEqual(self.request("POST", "/api/quiz/score", changed_key, owner)[0], 409)
        status, _, denied = self.request("POST", "/api/quiz/score", answer, other)
        self.assertEqual(status, 400)
        self.assertNotIn(answer["answer"], json.dumps(denied))
        self.assertEqual(self.request("GET", "/api/progress", cookie=other)[2]["attempt_count"], 0)
        self.assertEqual(self.request("GET", "/api/progress", cookie=owner)[2]["attempt_count"], 1)

        self.stop_http()
        self.start_http()
        self.assertEqual(self.request("GET", "/api/progress", cookie=owner)[2]["attempt_count"], 1)
        self.assertEqual(self.request("DELETE", "/api/progress", cookie=other)[0], 200)
        self.assertEqual(self.request("GET", "/api/progress", cookie=owner)[2]["attempt_count"], 1)
        self.assertEqual(self.request("DELETE", "/api/progress", cookie=owner)[0], 200)
        self.assertEqual(self.request("GET", "/api/progress", cookie=owner)[2]["attempt_count"], 0)
        self.assertEqual(self.request("GET", "/api/history", cookie=owner)[2]["conversations"][0]["id"], saved["save_id"])

    def test_invalid_history_fields_do_not_write_or_leak_saved_text(self):
        owner = self.browser_cookie()
        other = self.browser_cookie()
        private_text = "Private learner answer marker"
        body = self.save_body(question=private_text)
        self.assertEqual(self.request("POST", "/api/history", body, owner)[0], 200)

        without_consent = {**body, "save_id": str(uuid.uuid4()), "consent_to_save": False}
        invalid_source = deepcopy(body)
        invalid_source["save_id"] = str(uuid.uuid4())
        invalid_source["messages"][1]["source_ids"] = ["unreviewed-source"]
        for invalid in (without_consent, invalid_source):
            with self.subTest(invalid=invalid["save_id"]):
                status, _, error = self.request("POST", "/api/history", invalid, owner)
                self.assertEqual(status, 400)
                self.assertNotIn(private_text, json.dumps(error))
        status, _, _ = self.request("POST", "/api/history/load", {"save_id": "not-a-uuid"}, owner)
        self.assertEqual(status, 400)

        duplicate_fields = b'{"save_id":"one","save_id":"two"}'
        status, headers, error = self.request("POST", "/api/history", cookie=owner, raw=duplicate_fields)
        self.assertEqual(status, 400)
        self.assertEqual(headers.get("Connection"), "close")
        self.assertNotIn(private_text, json.dumps(error))
        self.assertEqual(len(self.request("GET", "/api/history", cookie=owner)[2]["conversations"]), 1)
        self.assertEqual(self.request("GET", "/api/history", cookie=other)[2]["conversations"], [])


if __name__ == "__main__":
    unittest.main()
