"""Provider-free HTTP acceptance checks for the optional local access gate."""

import http.client
import json
import os
import threading
import unittest
import uuid
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import access
import progress
import server
import session_history
import trace_store
from access import ACCESS_LIFETIME_SECONDS, AccessGate
from request_limits import RequestLimiter


class QuietHandler(server.BolPrepHandler):
    def log_message(self, *args):
        pass


class AccessHttpTests(unittest.TestCase):
    PASSWORD = "local-demo-test-password"

    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.database = Path(temporary.name) / "access.sqlite3"
        self.now = 1_000.0
        self._patch(patch.object(access, "time", SimpleNamespace(monotonic=lambda: self.now)))
        self._patch(patch.dict(os.environ, {"BOLPREP_OFFLINE": "1"}))
        self._patch(patch.object(server, "ACCESS_GATE", AccessGate(self.PASSWORD)))
        self._patch(patch.object(server, "REQUEST_LIMITER", RequestLimiter({
            **{bucket: 100 for bucket in server.REQUEST_LIMITER.limits}, "login": 6,
        })))
        for name in ("create_quiz_run", "save_answer", "get_progress", "clear_progress"):
            self._patch(patch.object(server, name, partial(getattr(progress, name), path=self.database)))
        for name in ("save_conversation", "list_conversations", "get_conversation", "clear_conversations"):
            self._patch(patch.object(server, name, partial(getattr(session_history, name), path=self.database)))
        self._patch(patch.object(server, "list_traces", partial(trace_store.list_traces, path=self.database)))
        self.http = None
        self.addCleanup(self.stop_http)
        self.start_http()

    def _patch(self, active):
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

    def request(self, method, path, body=None, cookies=(), origin=True):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Content-Type": "application/json"}
        if cookies:
            headers["Cookie"] = "; ".join(cookies)
        if origin:
            headers["Origin"] = (f"http://127.0.0.1:{self.port}"
                                 if origin is True else origin)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        try:
            connection.request(method, path, payload, headers)
            response = connection.getresponse()
            result = (response.status, dict(response.getheaders()), response.read())
            return result
        finally:
            connection.close()

    @staticmethod
    def decoded(response):
        return json.loads(response[2])

    @staticmethod
    def cookie(response, name):
        cookie = response[1].get("Set-Cookie", "").split(";", 1)[0]
        assert cookie.startswith(f"{name}=")
        return cookie

    def login(self, cookies=()):
        response = self.request("POST", "/api/login", {"password": self.PASSWORD}, cookies)
        self.assertEqual(response[0], 200)
        self.assertTrue(self.decoded(response)["ok"])
        return self.cookie(response, "bolprep_access")

    def browser_session(self, access_cookie):
        response = self.request("GET", "/", cookies=(access_cookie,))
        self.assertEqual(response[0], 200)
        return self.cookie(response, "bolprep_session")

    def test_unauthenticated_page_and_api_do_not_open_storage(self):
        page = self.request("GET", "/", origin=False)
        self.assertEqual(page[0], 302)
        self.assertEqual(page[1]["Location"], "/login")
        self.assertNotIn("Set-Cookie", page[1])
        for method, path, body in (
            ("GET", "/api/progress", None),
            ("GET", "/api/history", None),
            ("GET", "/api/traces", None),
            ("POST", "/api/quiz/start", {"question_count": 2}),
            ("DELETE", "/api/progress", None),
        ):
            with self.subTest(method=method, path=path):
                response = self.request(method, path, body)
                self.assertEqual(response[0], 401)
                self.assertEqual(self.decoded(response)["code"], "login-required")
                self.assertNotIn("Set-Cookie", response[1])
        self.assertFalse(self.database.exists())

    def test_wrong_password_and_six_attempt_login_limit(self):
        for _ in range(6):
            response = self.request("POST", "/api/login", {"password": "incorrect-password"})
            self.assertEqual(response[0], 401)
            self.assertNotIn("Set-Cookie", response[1])
        limited = self.request("POST", "/api/login", {"password": self.PASSWORD})
        self.assertEqual(limited[0], 429)
        self.assertEqual(self.decoded(limited)["code"], "rate-limited")
        self.assertIn("Retry-After", limited[1])
        self.assertNotIn("Set-Cookie", limited[1])
        self.assertFalse(self.database.exists())

    def test_authenticated_mutations_require_local_origin(self):
        access_cookie = self.login()
        session_cookie = self.browser_session(access_cookie)
        cookies = (access_cookie, session_cookie)
        quiz_body = {"topic": "fundamental rights", "question_count": 2,
                     "language": "en-IN", "difficulty": "basic"}
        for origin in (False, "https://example.invalid"):
            with self.subTest(origin=origin):
                response = self.request("POST", "/api/quiz/start", quiz_body, cookies, origin=origin)
                self.assertEqual(response[0], 403)
                self.assertEqual(self.decoded(response)["code"], "unexpected-origin")
                self.assertNotIn("Set-Cookie", response[1])
        self.assertFalse(self.database.exists())
        self.assertEqual(self.request("POST", "/api/quiz/start", quiz_body, cookies)[0], 200)
        self.assertEqual(self.request("DELETE", "/api/progress", cookies=cookies, origin=False)[0], 403)

    def test_login_rotation_logout_and_browser_cookie_progress_ownership(self):
        first_access = self.login()
        second_access = self.login((first_access,))
        self.assertNotEqual(first_access, second_access)
        self.assertEqual(self.request("GET", "/api/progress", cookies=(first_access,))[0], 401)
        owner_session = self.browser_session(second_access)
        owner_cookies = (second_access, owner_session)
        quiz_response = self.request("POST", "/api/quiz/start", {
            "topic": "fundamental rights", "question_count": 2,
            "language": "en-IN", "difficulty": "basic",
        }, owner_cookies)
        self.assertEqual(quiz_response[0], 200)
        quiz = self.decoded(quiz_response)
        answer = {
            "quiz_id": quiz["quiz_id"], "question_id": "art14_equality",
            "answer": "Equality before the law and equal protection of the laws.",
            "language": "en-IN", "idempotency_key": str(uuid.uuid4()),
        }
        self.assertEqual(self.request("POST", "/api/quiz/score", answer, owner_cookies)[0], 200)
        self.assertEqual(self.decoded(self.request("GET", "/api/progress", cookies=owner_cookies))["attempt_count"], 1)

        other_session = self.browser_session(second_access)
        self.assertNotEqual(owner_session, other_session)
        other_cookies = (second_access, other_session)
        self.assertEqual(self.decoded(self.request("GET", "/api/progress", cookies=other_cookies))["attempt_count"], 0)
        denied = self.request("POST", "/api/quiz/score", answer, other_cookies)
        self.assertEqual(denied[0], 400)
        self.assertNotIn(answer["answer"], denied[2].decode())

        logout = self.request("POST", "/api/logout", {}, owner_cookies)
        self.assertEqual(logout[0], 200)
        self.assertIn("Max-Age=0", logout[1]["Set-Cookie"])
        self.assertEqual(self.request("GET", "/api/progress", cookies=owner_cookies)[0], 401)
        renewed_access = self.login((owner_session,))
        renewed_owner = (renewed_access, owner_session)
        self.assertEqual(self.decoded(self.request("GET", "/api/progress", cookies=renewed_owner))["attempt_count"], 1)
        self.assertEqual(self.decoded(self.request("GET", "/api/progress", cookies=(renewed_access, other_session)))["attempt_count"], 0)

    def test_expired_token_and_new_gate_after_restart_reject_old_token(self):
        access_cookie = self.login()
        session_cookie = self.browser_session(access_cookie)
        self.assertEqual(self.request("GET", "/api/progress", cookies=(access_cookie, session_cookie))[0], 200)
        self.now += ACCESS_LIFETIME_SECONDS + 1
        self.assertEqual(self.request("GET", "/api/progress", cookies=(access_cookie, session_cookie))[0], 401)

        renewed_access = self.login((session_cookie,))
        self.stop_http()
        server.ACCESS_GATE = AccessGate(self.PASSWORD)
        self.start_http()
        self.assertEqual(self.request("GET", "/api/progress", cookies=(renewed_access, session_cookie))[0], 401)
        after_restart = self.login((session_cookie,))
        self.assertEqual(self.request("GET", "/api/progress", cookies=(after_restart, session_cookie))[0], 200)


if __name__ == "__main__":
    unittest.main()
