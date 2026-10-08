"""Provider-free HTTP checks on an OS-assigned loopback port."""

import http.client
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import server
from access import AccessGate


class QuietHandler(server.BolPrepHandler):
    def log_message(self, *args):
        pass


class LocalOriginTests(unittest.TestCase):
    def setUp(self):
        self.offline = patch.dict(os.environ, {"BOLPREP_OFFLINE": "1"})
        self.offline.start()
        self.gate = patch.object(server, "ACCESS_GATE", AccessGate("local-test-password-only"))
        self.gate.start()
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.port = self.http.server_address[1]
        self.worker = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.worker.join(timeout=3)
        self.gate.stop()
        self.offline.stop()

    def request(self, method, path, body=None, origin=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            headers = {"Content-Type": "application/json"}
            if origin is not None:
                headers["Origin"] = origin
            connection.request(method, path, json.dumps(body) if body is not None else None, headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), json.loads(response.read())
        finally:
            connection.close()

    def test_health_reports_offline_on_assigned_port(self):
        status, _, payload = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["mode"], "offline")
        self.assertFalse(payload["streaming_tts"])
        self.assertFalse(payload["server_transcription"])
        self.assertFalse(payload["live_transcription"])

    def test_login_accepts_actual_loopback_port(self):
        for host in ("127.0.0.1", "localhost"):
            with self.subTest(host=host):
                status, headers, payload = self.request(
                    "POST", "/api/login", {"password": "local-test-password-only"},
                    f"http://{host}:{self.port}",
                )
                self.assertEqual(status, 200)
                self.assertTrue(payload["ok"])
                self.assertIn("bolprep_access=", headers["Set-Cookie"])

    def test_login_rejects_another_port_and_foreign_origin(self):
        for origin in (f"http://127.0.0.1:{self.port + 1}", "https://example.invalid"):
            with self.subTest(origin=origin):
                status, headers, _ = self.request(
                    "POST", "/api/login", {"password": "local-test-password-only"}, origin,
                )
                self.assertEqual(status, 403)
                self.assertNotIn("Set-Cookie", headers)


if __name__ == "__main__":
    unittest.main()
