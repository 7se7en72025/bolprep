"""Local-only HTTP server for the BolPrep browser prototype."""

from __future__ import annotations

import json
import hashlib
import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore
from typing import Any

from bolprep import api_is_configured, ask_model, offline_answer
from conversation_history import clean_history, prior_queries
from agent import run_agent_turn
from progress import ProgressConflict, clear_progress, create_quiz_run, get_progress, save_answer
from quiz import QUIZ_PRESETS, score_answer, start_quiz
from retrieval import load_corpus, retrieval_query, retrieve
from request_limits import RequestLimiter
from access import ACCESS_COOKIE, ACCESS_LIFETIME_SECONDS, AccessGate
from session_history import HistoryConflict, clear_conversations, get_conversation, list_conversations, save_conversation


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8000
MAX_BODY_BYTES = 256 * 1024
MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_RECORDED_TRANSCRIPT_CHARS = 6000
MAX_SPEECH_PCM_BYTES = 24000 * 2 * 300  # Mono 16-bit PCM, five minutes per request.
POST_QUOTAS = {
    "/api/login": "login",
    "/api/logout": "logout",
    "/api/answer": "tutor",
    "/api/agent/turn": "tutor",
    "/api/speech": "speech",
    "/api/transcribe": "recorded-stt",
    "/api/transcription/session": "live-session",
    "/api/quiz/start": "quiz-write",
    "/api/quiz/score": "quiz-write",
    "/api/history": "history-save",
    "/api/history/load": "history-read",
}
# All local browsers share these quotas. Cookie changes cannot reset a quota.
REQUEST_LIMITER = RequestLimiter({
    "tutor": 30, "speech": 60, "recorded-stt": 10, "live-session": 6,
    "quiz-write": 60, "progress-read": 60, "progress-delete": 6,
    "login": 6, "logout": 30,
    "history-save": 10, "history-read": 60, "history-delete": 6,
})
ACCESS_GATE = AccessGate(os.getenv("BOLPREP_ACCESS_PASSWORD", ""))
MAX_ACTIVE_TUTOR_OR_SPEECH_REQUESTS = 4
ACTIVE_TUTOR_OR_SPEECH_SLOTS = BoundedSemaphore(MAX_ACTIVE_TUTOR_OR_SPEECH_REQUESTS)
LONG_REQUEST_QUOTAS = {"tutor", "speech", "recorded-stt", "live-session"}
HTTP_IO_TIMEOUT_SECONDS = 30


class BolPrepHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(HTTP_IO_TIMEOUT_SECONDS)

    def handle(self) -> None:
        try:
            super().handle()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.close_connection = True

    def do_GET(self) -> None:
        if self.path == "/health":
            try:
                study_notes = len(load_corpus())
            except (ValueError, OSError):
                self._send_json(503, {
                    "ok": False, "code": "corpus-unavailable",
                    "error": "Checked study notes are unavailable. Check the local corpus and restart the server.",
                }, include_session_cookie=False)
                return
            model_configured = api_is_configured()
            mode = "model" if model_configured else "offline"
            self._send_json(
                200,
                {
                    "ok": True,
                    "mode": mode,
                    "model_name": os.getenv("OPENAI_MODEL", "gpt-6-astra") if model_configured else None,
                    "study_notes": study_notes,
                    "streaming_tts": model_configured,
                    "server_transcription": model_configured,
                    "live_transcription": model_configured,
                    "access_protected": ACCESS_GATE.enabled,
                },
                include_session_cookie=False,
            )
            return

        if self.path in {"/api/progress", "/api/history"}:
            if not self._require_access():
                return
            if not self._permit_api_request("history-read" if self.path == "/api/history" else "progress-read"):
                return
            self._ensure_browser_session()
            if self.path == "/api/history":
                self._handle_saved_history()
            else:
                try:
                    progress = get_progress(self.session_id)
                except (sqlite3.Error, OSError):
                    self._storage_unavailable()
                    return
                self._send_json(200, progress)
            return
        if self.path == "/" and not ACCESS_GATE.allowed(self._access_token()):
            self._redirect("/login")
            return
        if self.path == "/login" and ACCESS_GATE.allowed(self._access_token()):
            self._redirect("/")
            return
        routes = {
            "/": (WEB_ROOT / "index.html", "text/html; charset=utf-8"),
            "/app.js": (WEB_ROOT / "app.js", "text/javascript; charset=utf-8"),
            "/session-history.js": (WEB_ROOT / "session-history.js", "text/javascript; charset=utf-8"),
            "/live-stt.js": (WEB_ROOT / "live-stt.js", "text/javascript; charset=utf-8"),
            "/styles.css": (WEB_ROOT / "styles.css", "text/css; charset=utf-8"),
            "/login": (WEB_ROOT / "login.html", "text/html; charset=utf-8"),
            "/login.js": (WEB_ROOT / "login.js", "text/javascript; charset=utf-8"),
            "/access.js": (WEB_ROOT / "access.js", "text/javascript; charset=utf-8"),
        }
        route = routes.get(self.path)
        if route is None:
            self.send_error(404, "Not found")
            return
        if self.path == "/":
            self._ensure_browser_session()
        path, content_type = route
        try:
            payload = path.read_bytes()
        except OSError:
            self.send_error(500, "App file is unavailable")
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if self.path == "/":
            self._send_session_cookie_if_needed()
        self._finish_response(payload)

    def do_DELETE(self) -> None:
        if self.path not in {"/api/progress", "/api/history"}:
            self.send_error(404, "Not found")
            return
        if not self._require_access():
            return
        if not self._permit_api_request("history-delete" if self.path == "/api/history" else "progress-delete"):
            return
        self._ensure_browser_session()
        if self.path == "/api/history":
            self._handle_saved_history()
            return
        try:
            clear_progress(self.session_id)
        except (sqlite3.Error, OSError):
            self._storage_unavailable()
            return
        self._send_json(200, {"ok": True})

    def do_POST(self) -> None:
        quota = POST_QUOTAS.get(self.path)
        if quota is None:
            self.send_error(404, "Not found")
            return
        if self.path != "/api/login" and not self._require_access():
            return
        if not self._permit_api_request(quota):
            return
        needs_slot = quota in LONG_REQUEST_QUOTAS
        if needs_slot and not ACTIVE_TUTOR_OR_SPEECH_SLOTS.acquire(blocking=False):
            self._reject_api_request("The tutor is busy. Wait 2 seconds, then try again.", 2, "server-busy")
            return
        try:
            self._dispatch_post()
        finally:
            if needs_slot:
                ACTIVE_TUTOR_OR_SPEECH_SLOTS.release()

    def _dispatch_post(self) -> None:
        if self.path in {"/api/login", "/api/logout"}:
            body = self._read_json_body()
            if body is None:
                return
            self._handle_access(body)
            return
        self._ensure_browser_session()
        if self.path == "/api/transcribe":
            self._handle_transcription()
            return
        body = self._read_json_body()
        if body is None:
            return
        if self.path in {"/api/history", "/api/history/load"}:
            self._handle_saved_history(body)
            return
        if self.path == "/api/transcription/session":
            self._handle_transcription_session(body)
            return
        if self.path == "/api/speech":
            self._handle_speech(body)
            return
        if self.path == "/api/quiz/start":
            self._handle_quiz_start(body)
            return
        if self.path == "/api/quiz/score":
            self._handle_quiz_score(body)
            return
        if self.path == "/api/agent/turn":
            self._handle_agent_turn(body)
            return

        question = body.get("question")
        history = body.get("history", [])
        language = body.get("language", "en-IN")
        if not isinstance(question, str) or not question.strip() or len(question) > 1200:
            self._send_json(400, {"error": "Enter a question under 1,200 characters."})
            return
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English."})
            return
        try:
            cleaned_history = clean_history(history)
        except ValueError:
            self._send_json(400, {"error": "Conversation history is invalid."})
            return

        try:
            prior_questions = prior_queries(cleaned_history)
            documents = retrieve(retrieval_query(question, prior_questions))
            if not documents:
                answer = offline_answer([], language, question)
            elif api_is_configured():
                answer = ask_model(question.strip(), cleaned_history, documents, language)
            else:
                answer = offline_answer(documents, language, question)
        except Exception as exc:
            print(f"Tutor request failed: {type(exc).__name__}")
            self._send_json(502, {"error": "Tutor request failed. Check the server terminal and try again."})
            return
        sources = [
            {
                "title": document["source"]["title"],
                "url": document["source"]["url"],
                "section": document["source"]["section"],
            }
            for document in documents
        ]
        self._send_json(200, {"answer": answer, "sources": sources})

    def _handle_agent_turn(self, body: dict[str, Any]) -> None:
        question = body.get("question")
        history = body.get("history", [])
        language = body.get("language", "hi-IN")
        quiz_difficulty = body.get("quiz_difficulty", "standard")
        if not isinstance(quiz_difficulty, str) or quiz_difficulty not in QUIZ_PRESETS:
            self._send_json(400, {"error": "Choose basic, standard, or challenge quiz difficulty."})
            return
        if not isinstance(question, str) or not question.strip() or len(question) > 1200:
            self._send_json(400, {"error": "Enter a question under 1,200 characters."})
            return
        if not isinstance(history, list) or len(history) > 20:
            self._send_json(400, {"error": "Conversation history is invalid."})
            return
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English."})
            return
        try:
            cleaned_history = clean_history(history)
        except ValueError:
            self._send_json(400, {"error": "Conversation history is invalid."})
            return
        request_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        started = time.perf_counter()

        def turn_trace(outcome: str, result: dict[str, Any] | None = None) -> dict[str, Any]:
            result = result or {}
            mode = result.get("mode", "model" if api_is_configured() else "offline")
            return {
                "request_id": request_id,
                "started_at_utc": started_at,
                "outcome": outcome,
                "server_duration_ms": round((time.perf_counter() - started) * 1000, 2),
                "mode": mode,
                "configured_model": os.getenv("OPENAI_MODEL", "gpt-6-astra") if mode == "model" else None,
                "provider_reported_models": result.get("provider_reported_models", [] if mode == "offline" else None),
                "source_count": len(result.get("sources", [])),
                "tool_outcomes": [{"name": event["name"], "ok": event.get("ok") is True}
                                  for event in result.get("tool_events", [])],
                "usage": result.get("usage"),
                "model_response_count": result.get("model_response_count", 0 if mode == "offline" else None),
                "usage_response_count": result.get("usage_response_count", 0 if mode == "offline" else None),
            }

        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("X-Request-ID", request_id)
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self._send_session_cookie_if_needed()
        self.end_headers()
        try:
            result = run_agent_turn(
                question.strip(),
                cleaned_history,
                self.session_id,
                language,
                quiz_difficulty=quiz_difficulty,
                on_text_delta=lambda delta: self._write_ndjson({"type": "delta", "text": delta}),
                on_speech_mode=lambda progressive: self._write_ndjson(
                    {"type": "speech_mode", "progressive": progressive}
                ),
                on_sources=lambda sources: self._write_ndjson({"type": "retrieved_sources", "sources": sources}),
            )
            result["trace"] = turn_trace("completed", result)
            self._write_ndjson({"type": "complete", "payload": result})
            self._finish_chunked_response()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.close_connection = True
        except Exception as exc:
            print(f"Tutor agent request {request_id} failed: {type(exc).__name__}")
            try:
                self._write_ndjson({"type": "error", "error": "Tutor request failed. Check the server terminal and try again.",
                                   "trace": turn_trace("failed")})
                self._finish_chunked_response()
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
                self.close_connection = True

    def _write_ndjson(self, event: dict[str, Any]) -> None:
        encoded = (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")
        self.wfile.write(f"{len(encoded):X}\r\n".encode("ascii"))
        self.wfile.write(encoded)
        self.wfile.write(b"\r\n")
        self.wfile.flush()

    def _finish_chunked_response(self) -> None:
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def _handle_speech(self, body: dict[str, Any]) -> None:
        text = body.get("text")
        language = body.get("language")
        voice = body.get("voice")
        if not isinstance(text, str) or not text.strip() or len(text) > 4096:
            self._send_json(400, {"error": "Speech text must contain between 1 and 4,096 characters."})
            return
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English."})
            return
        allowed_voices = {"alloy", "ash", "ballad", "coral", "echo", "fable", "marin", "cedar", "nova", "onyx", "sage", "shimmer", "verse"}
        if not isinstance(voice, str) or voice not in allowed_voices:
            self._send_json(400, {"error": "Choose a supported streamed voice."})
            return
        if not api_is_configured():
            self._send_json(503, {"error": "Streamed speech needs an API key. Browser speech remains available."})
            return
        response_started = False
        try:
            from openai import OpenAI

            with OpenAI(timeout=60.0, max_retries=0) as client:
                instructions = (
                    "Speak clearly in Hindi with a conversational pace."
                    if language == "hi-IN"
                    else "Speak clearly in Indian English with a conversational pace."
                )
                with client.audio.speech.with_streaming_response.create(
                    model="gpt-4o-mini-tts",
                    voice=voice,
                    input=text.strip(),
                    instructions=instructions,
                    response_format="pcm",
                ) as response:
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/pcm")
                    self.send_header("X-Audio-Sample-Rate", "24000")
                    self.send_header("Transfer-Encoding", "chunked")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self._send_session_cookie_if_needed()
                    self.end_headers()
                    response_started = True
                    audio_bytes = 0
                    for chunk in response.iter_bytes(chunk_size=4096):
                        if not chunk:
                            continue
                        audio_bytes += len(chunk)
                        if audio_bytes > MAX_SPEECH_PCM_BYTES:
                            raise RuntimeError("Speech audio exceeded the per-request limit.")
                        self.wfile.write(f"{len(chunk):X}\r\n".encode("ascii"))
                        self.wfile.write(chunk)
                        self.wfile.write(b"\r\n")
                        self.wfile.flush()
                    self.wfile.write(b"0\r\n\r\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.close_connection = True
        except Exception as exc:
            print(f"Streamed speech request failed: {type(exc).__name__}")
            if response_started:
                self.close_connection = True
            else:
                self._send_json(502, {"error": "The speech provider could not return audio. Check the server terminal and try again."})

    def _handle_transcription_session(self, body: dict[str, Any]) -> None:
        # Browser-only, local endpoint: never expose the project API key.
        if self.headers.get("Origin") not in {"http://127.0.0.1:8000", "http://localhost:8000"}:
            self._send_json(403, {"error": "Start live transcription from the local tutor page."})
            return
        language = body.get("language")
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English."})
            return
        if not api_is_configured():
            self._send_json(503, {"error": "Live transcription needs an API key. You can type or use browser speech."})
            return
        try:
            from openai import OpenAI

            with OpenAI(timeout=30.0, max_retries=0) as client:
                secret = client.realtime.client_secrets.create(
                    expires_after={"anchor": "created_at", "seconds": 60},
                    session={
                        "type": "transcription",
                        "audio": {"input": {
                            "transcription": {
                                "model": "gpt-live-transcribe",
                                "languages": ["hi", "en"] if language == "hi-IN" else ["en"],
                                "delay": "low",
                            },
                            "turn_detection": None,
                        }},
                    },
                    extra_headers={"OpenAI-Safety-Identifier": hashlib.sha256(self.session_id.encode()).hexdigest()},
                )
            if not isinstance(secret.value, str) or not secret.value or not isinstance(secret.expires_at, int):
                raise ValueError("Invalid client secret response")
            self._send_json(200, {"client_secret": secret.value, "expires_at": secret.expires_at,
                                  "model": "gpt-live-transcribe"})
        except Exception as exc:
            # Exception text can contain provider response data; do not log tokens.
            print(f"Live transcription session failed: {type(exc).__name__}")
            self._send_json(502, {"error": "Live transcription could not connect. Try Record or type your question."})

    def _handle_transcription(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.close_connection = True
            self._send_json(400, {"error": "Invalid audio request length."})
            return
        if length <= 0:
            self._send_json(400, {"error": "Record a short question before requesting a transcript."})
            return
        if length > MAX_AUDIO_BYTES:
            self.close_connection = True
            self._send_json(413, {"error": "The recording is too large. Keep it under 5 MB."})
            return
        audio = self.rfile.read(length)
        if len(audio) != length:
            self.close_connection = True
            self._send_json(400, {"error": "The audio upload was incomplete. Try recording again."})
            return

        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        formats = {"audio/webm": "question.webm", "audio/mp4": "question.mp4"}
        filename = formats.get(content_type)
        if not filename:
            self._send_json(415, {"error": "Use a browser recording in WebM or MP4 format."})
            return
        language = self.headers.get("X-Speech-Language", "")
        language_code = {"hi-IN": "hi", "en-IN": "en"}.get(language)
        if not language_code:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English before recording."})
            return
        if not api_is_configured():
            self._send_json(503, {"error": "Server transcription needs an API key. Browser speech recognition remains available."})
            return

        try:
            from openai import OpenAI

            with OpenAI(timeout=60.0, max_retries=0) as client:
                response = client.audio.transcriptions.create(
                    model="gpt-transcribe",
                    file=(filename, audio, content_type),
                    language=language_code,
                )
                transcript = getattr(response, "text", "")
                if not isinstance(transcript, str) or not transcript.strip():
                    self._send_json(502, {"error": "The transcription provider returned no text. Try again or type your question."})
                    return
                transcript = transcript.strip()
                if len(transcript) > MAX_RECORDED_TRANSCRIPT_CHARS:
                    self._send_json(422, {"error": "The transcript is over 6,000 characters and cannot be shown. Record a shorter clip or type your question."})
                    return
                self._send_json(200, {"transcript": transcript})
        except Exception as exc:
            print(f"Transcription request failed: {type(exc).__name__}")
            self._send_json(502, {"error": "The transcription provider could not return text. Check the server terminal and try again."})

    def _read_json_body(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid request length."})
            return None
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Request is empty or too large."})
            return None
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request must contain valid JSON."})
            return None
        if not isinstance(body, dict):
            self._send_json(400, {"error": "Request body must be an object."})
            return None
        return body

    def _handle_saved_history(self, body: dict[str, Any] | None = None) -> None:
        try:
            if self.command == "GET":
                result = list_conversations(self.session_id)
            elif self.command == "DELETE":
                clear_conversations(self.session_id)
                result = {"ok": True}
            elif self.path == "/api/history/load":
                result = get_conversation(self.session_id, (body or {}).get("save_id"))
                if result is None:
                    self._send_json(404, {"error": "Saved conversation was not found for this browser."})
                    return
            else:
                result = save_conversation(self.session_id, body or {})
            self._send_json(200, result)
        except HistoryConflict as error:
            self._send_json(409, {"error": str(error)})
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
        except (sqlite3.Error, RuntimeError, OSError):
            self._send_json(503, {"error": "Saved conversation storage is unavailable. Try again later."})

    def _handle_quiz_start(self, body: dict[str, Any]) -> None:
        topic = body.get("topic", "fundamental rights")
        question_count = body.get("question_count")
        language = body.get("language", "hi-IN")
        difficulty = body.get("difficulty", "standard")
        try:
            quiz = start_quiz(topic, question_count, language, difficulty)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        quiz_id = str(uuid.uuid4())
        try:
            create_quiz_run(
                self.session_id,
                quiz_id,
                quiz["topic"],
                [question["id"] for question in quiz["questions"]],
            )
        except (sqlite3.Error, OSError):
            self._storage_unavailable()
            return
        quiz["quiz_id"] = quiz_id
        self._send_json(200, quiz)

    def _handle_quiz_score(self, body: dict[str, Any]) -> None:
        question_id = body.get("question_id")
        answer = body.get("answer")
        quiz_id = body.get("quiz_id")
        idempotency_key = body.get("idempotency_key")
        language = body.get("language", "en-IN")
        if (
            not isinstance(quiz_id, str)
            or not isinstance(question_id, str)
            or not isinstance(answer, str)
            or not isinstance(idempotency_key, str)
        ):
            self._send_json(400, {"error": "Quiz ID, question ID, answer, and retry key are required."})
            return
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English feedback."})
            return
        try:
            result = score_answer(question_id, answer, language)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        try:
            result = save_answer(self.session_id, quiz_id, question_id, idempotency_key, result)
        except ProgressConflict as exc:
            self._send_json(409, {"error": str(exc)})
            return
        except (sqlite3.Error, OSError):
            self._storage_unavailable()
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, result)

    def _access_token(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = cookie.get(ACCESS_COOKIE)
        return morsel.value if morsel else None

    def _require_access(self) -> bool:
        if ACCESS_GATE.allowed(self._access_token()):
            if ACCESS_GATE.enabled and self.command in {"POST", "DELETE"} and self.headers.get("Origin") not in {
                "http://127.0.0.1:8000", "http://localhost:8000"
            }:
                self.close_connection = True
                self._send_json(403, {"error": "Use the local tutor page.", "code": "unexpected-origin"},
                                include_session_cookie=False)
                return False
            return True
        self.close_connection = True
        self._send_json(401, {"error": "Sign in to continue.", "code": "login-required"}, include_session_cookie=False)
        return False

    def _redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self._finish_response(b"")

    def _handle_access(self, body: dict[str, Any]) -> None:
        if self.headers.get("Origin") not in {"http://127.0.0.1:8000", "http://localhost:8000"}:
            self._send_json(403, {"error": "Use the local sign-in page."}, include_session_cookie=False)
            return
        token = self._access_token()
        if self.path == "/api/logout":
            ACCESS_GATE.logout(token)
            self._send_json(200, {"ok": True}, include_session_cookie=False,
                            access_cookie=f"{ACCESS_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
            return
        password = body.get("password")
        if not isinstance(password, str) or not 1 <= len(password) <= 256:
            self._send_json(400, {"error": "Enter your demo password."}, include_session_cookie=False)
            return
        if not ACCESS_GATE.enabled:
            self._send_json(200, {"ok": True}, include_session_cookie=False)
            return
        new_token = ACCESS_GATE.login(password, token)
        if new_token is None:
            self._send_json(401, {"error": "That password was not accepted."}, include_session_cookie=False)
            return
        self._send_json(200, {"ok": True}, include_session_cookie=False,
                        access_cookie=f"{ACCESS_COOKIE}={new_token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={ACCESS_LIFETIME_SECONDS}")

    def _storage_unavailable(self) -> None:
        # End failed storage requests instead of reusing their connection.
        self.close_connection = True
        self._send_json(503, {
            "error": "Saved study data is unavailable. Try again later; check saved progress before retrying a score or deletion.",
            "code": "storage-unavailable",
        })

    def _ensure_browser_session(self) -> None:
        """Assign cookie identity without requiring a writable database."""
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            cookie = SimpleCookie()
        morsel = cookie.get("bolprep_session")
        session_id = None
        if morsel:
            try:
                session_id = str(uuid.UUID(morsel.value))
            except ValueError:
                session_id = None
        self.new_session_cookie = session_id is None
        self.session_id = session_id or str(uuid.uuid4())
        # Storage is opened only by progress/history/quiz operations.

    def _send_session_cookie_if_needed(self) -> None:
        if self.new_session_cookie:
            self.send_header(
                "Set-Cookie",
                f"bolprep_session={self.session_id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000",
            )

    def _permit_api_request(self, bucket: str) -> bool:
        retry_after = REQUEST_LIMITER.acquire(bucket)
        if not retry_after:
            return True
        self._reject_api_request(
            f"Too many requests. Wait {retry_after} seconds, then try again.", retry_after, "rate-limited"
        )
        return False

    def _reject_api_request(self, message: str, retry_after: int, code: str) -> None:
        # The body has not been consumed. Close this HTTP connection rather than
        # accidentally parsing leftover JSON/audio as another request.
        self.close_connection = True
        self._send_json(
            429,
            {"error": message, "code": code,
             "retry_after_seconds": retry_after},
            include_session_cookie=False,
            retry_after_seconds=retry_after,
        )

    def _send_json(
        self, status: int, payload: dict[str, Any], include_session_cookie: bool = True,
        retry_after_seconds: int | None = None,
        access_cookie: str | None = None,
    ) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if retry_after_seconds is not None:
            self.send_header("Retry-After", str(retry_after_seconds))
        if self.close_connection:
            self.send_header("Connection", "close")
        if access_cookie is not None:
            self.send_header("Set-Cookie", access_cookie)
        if include_session_cookie:
            self._send_session_cookie_if_needed()
        self._finish_response(encoded)

    def _finish_response(self, payload: bytes) -> None:
        """Finish writing unless the client disconnected before the response completed."""
        try:
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), BolPrepHandler)
    print(f"BolPrep is ready at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop the local server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping BolPrep server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
