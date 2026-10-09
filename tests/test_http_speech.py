"""Provider-free HTTP checks for streamed speech response startup."""

import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

import server
from access import AccessGate
from request_limits import RequestLimiter


class QuietHandler(server.BolPrepHandler):
    def log_message(self, *args):
        pass


class FakeSpeechResponse:
    def __init__(self, items):
        self.items = items
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def iter_bytes(self, chunk_size):
        assert chunk_size == 4096
        for item in self.items:
            if isinstance(item, Exception):
                raise item
            yield item


class FakeProvider:
    def __init__(self, items):
        self.response = FakeSpeechResponse(items)
        self.client_closed = False
        self.request = None

    def create(self, **kwargs):
        self.request = kwargs
        return self.response

    def openai(self, **kwargs):
        provider = self

        class Client:
            audio = SimpleNamespace(speech=SimpleNamespace(
                with_streaming_response=SimpleNamespace(create=provider.create)))

            def __enter__(self):
                return self

            def __exit__(self, *args):
                provider.client_closed = True

        return Client()


class SpeechTransportHttpTests(unittest.TestCase):
    def setUp(self):
        self.patches = []
        self.addCleanup(self._stop_patches)
        self._patch(patch.object(server, "ACCESS_GATE", AccessGate("")))
        self._patch(patch.object(server, "REQUEST_LIMITER", RequestLimiter({
            bucket: 100 for bucket in server.REQUEST_LIMITER.limits
        })))
        self._patch(patch.object(server, "api_is_configured", return_value=True))
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.http.daemon_threads = True
        self.port = self.http.server_address[1]
        self.worker = threading.Thread(target=self.http.serve_forever, kwargs={"poll_interval": 0.01})
        self.worker.start()
        self.addCleanup(self.stop_http)

    def _patch(self, active):
        active.start()
        self.patches.append(active)

    def _stop_patches(self):
        for active in reversed(self.patches):
            active.stop()

    def stop_http(self):
        self.http.shutdown()
        self.http.server_close()
        self.worker.join(timeout=3)
        self.assertFalse(self.worker.is_alive())

    def send(self, provider):
        self._patch(patch.dict(sys.modules, {"openai": SimpleNamespace(OpenAI=provider.openai)}))
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        body = json.dumps({"text": "PRIVATE_SPEECH_TEXT", "language": "en-IN", "voice": "alloy"})
        try:
            connection.request("POST", "/api/speech", body,
                               {"Content-Type": "application/json"})
            response = connection.getresponse()
            status, headers = response.status, dict(response.getheaders())
            return status, headers, response.read()
        finally:
            connection.close()

    def test_empty_stream_returns_json_failure_before_audio_headers(self):
        provider = FakeProvider([b"", b""])
        status, headers, body = self.send(provider)
        self.assertEqual(status, 502)
        self.assertIn("application/json", headers["Content-Type"])
        self.assertNotIn("Transfer-Encoding", headers)
        self.assertNotIn("PRIVATE_SPEECH_TEXT", body.decode())
        self.assertTrue(provider.response.closed)
        self.assertTrue(provider.client_closed)

    def test_first_read_failure_returns_json_failure_without_provider_details(self):
        provider = FakeProvider([RuntimeError("PRIVATE_PROVIDER_ERROR_MARKER")])
        status, headers, body = self.send(provider)
        self.assertEqual(status, 502)
        self.assertIn("application/json", headers["Content-Type"])
        self.assertNotIn("PRIVATE_PROVIDER_ERROR_MARKER", body.decode())
        self.assertTrue(provider.response.closed)
        self.assertTrue(provider.client_closed)

    def test_normal_chunks_are_preserved_after_initial_empty_chunk(self):
        provider = FakeProvider([b"", b"\x01\x00", b"\x02\x00"])
        status, headers, body = self.send(provider)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "audio/pcm")
        self.assertEqual(headers["X-Audio-Sample-Rate"], "24000")
        self.assertEqual(body, b"\x01\x00\x02\x00")
        self.assertEqual(provider.request["model"], "gpt-4o-mini-tts")
        self.assertEqual(headers["X-TTS-Requested-Model"], provider.request["model"])
        self.assertTrue(provider.response.closed)
        self.assertTrue(provider.client_closed)

    def test_requested_model_header_matches_the_model_sent_to_provider(self):
        provider = FakeProvider([b"\x01\x00"])
        with patch.object(server, "STREAMED_TTS_MODEL", "mock-tts-config"):
            status, headers, _ = self.send(provider)
        self.assertEqual(status, 200)
        self.assertEqual(provider.request["model"], "mock-tts-config")
        self.assertEqual(headers["X-TTS-Requested-Model"], provider.request["model"])

    def test_oversized_first_chunk_returns_502_before_audio_headers(self):
        provider = FakeProvider([b"12345"])
        with patch.object(server, "MAX_SPEECH_PCM_BYTES", 4):
            status, headers, _ = self.send(provider)
        self.assertEqual(status, 502)
        self.assertIn("application/json", headers["Content-Type"])
        self.assertTrue(provider.response.closed)
        self.assertTrue(provider.client_closed)

    def test_later_failure_closes_incomplete_stream_and_provider(self):
        provider = FakeProvider([b"\x01\x00", RuntimeError("PRIVATE_LATE_ERROR_MARKER")])
        with self.assertRaises(http.client.IncompleteRead):
            self.send(provider)
        self.assertTrue(provider.response.closed)
        self.assertTrue(provider.client_closed)


if __name__ == "__main__":
    unittest.main()
