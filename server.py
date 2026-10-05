"""Local-only HTTP server for the BolPrep browser prototype."""

from __future__ import annotations

import json
import uuid
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from bolprep import api_is_configured, ask_model, offline_answer
from agent import run_agent_turn
from progress import ProgressConflict, clear_progress, create_quiz_run, ensure_session, get_progress, save_answer
from quiz import score_answer, start_quiz
from retrieval import load_corpus, retrieve


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8000
MAX_BODY_BYTES = 256 * 1024
MAX_AUDIO_BYTES = 5 * 1024 * 1024


class BolPrepHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        if self.path == "/health":
            mode = "model" if api_is_configured() else "offline"
            self._send_json(
                200,
                {
                    "ok": True,
                    "mode": mode,
                    "study_notes": len(load_corpus()),
                    "streaming_tts": api_is_configured(),
                    "server_transcription": api_is_configured(),
                },
                include_session_cookie=False,
            )
            return

        if self.path == "/api/progress":
            self._ensure_browser_session()
            self._send_json(200, get_progress(self.session_id))
            return
        routes = {
            "/": (WEB_ROOT / "index.html", "text/html; charset=utf-8"),
            "/app.js": (WEB_ROOT / "app.js", "text/javascript; charset=utf-8"),
            "/styles.css": (WEB_ROOT / "styles.css", "text/css; charset=utf-8"),
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
        if self.path == "/":
            self._send_session_cookie_if_needed()
        self._finish_response(payload)

    def do_DELETE(self) -> None:
        self._ensure_browser_session()
        if self.path != "/api/progress":
            self.send_error(404, "Not found")
            return
        clear_progress(self.session_id)
        ensure_session(self.session_id)
        self._send_json(200, {"ok": True})

    def do_POST(self) -> None:
        self._ensure_browser_session()
        if self.path not in {"/api/answer", "/api/agent/turn", "/api/quiz/start", "/api/quiz/score", "/api/speech", "/api/transcribe"}:
            self.send_error(404, "Not found")
            return
        if self.path == "/api/transcribe":
            self._handle_transcription()
            return
        body = self._read_json_body()
        if body is None:
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
        if not isinstance(history, list) or len(history) > 20:
            self._send_json(400, {"error": "Conversation history is invalid."})
            return
        cleaned_history: list[dict[str, str]] = []
        for item in history:
            if (
                not isinstance(item, dict)
                or item.get("role") not in {"user", "assistant"}
                or not isinstance(item.get("content"), str)
                or len(item["content"]) > 3000
            ):
                self._send_json(400, {"error": "Conversation history is invalid."})
                return
            cleaned_history.append({"role": item["role"], "content": item["content"]})

        try:
            prior_questions = [item["content"] for item in cleaned_history if item["role"] == "user"][-4:]
            documents = retrieve(" ".join([*prior_questions, question.strip()]))
            if not documents:
                answer = offline_answer([], language, question)
            elif api_is_configured():
                answer = ask_model(question.strip(), cleaned_history, documents)
            else:
                answer = offline_answer(documents, language, question)
        except Exception as exc:
            print(f"Tutor request failed: {exc}")
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
        if not isinstance(question, str) or not question.strip() or len(question) > 1200:
            self._send_json(400, {"error": "Enter a question under 1,200 characters."})
            return
        if not isinstance(history, list) or len(history) > 20:
            self._send_json(400, {"error": "Conversation history is invalid."})
            return
        if not isinstance(language, str) or language not in {"hi-IN", "en-IN"}:
            self._send_json(400, {"error": "Choose Hindi/Hinglish or English."})
            return
        cleaned_history: list[dict[str, str]] = []
        for item in history:
            if (
                not isinstance(item, dict)
                or item.get("role") not in {"user", "assistant"}
                or not isinstance(item.get("content"), str)
                or len(item["content"]) > 3000
            ):
                self._send_json(400, {"error": "Conversation history is invalid."})
                return
            cleaned_history.append({"role": item["role"], "content": item["content"]})
        try:
            result = run_agent_turn(question.strip(), cleaned_history, self.session_id, language)
        except Exception as exc:
            print(f"Tutor agent request failed: {exc}")
            self._send_json(502, {"error": "Tutor request failed. Check the server terminal and try again."})
            return
        self._send_json(200, result)

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

            client = OpenAI(timeout=60.0, max_retries=0)
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
                for chunk in response.iter_bytes(chunk_size=4096):
                    if not chunk:
                        continue
                    self.wfile.write(f"{len(chunk):X}\r\n".encode("ascii"))
                    self.wfile.write(chunk)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.close_connection = True
        except Exception as exc:
            print(f"Streamed speech request failed: {exc}")
            if response_started:
                self.close_connection = True
            else:
                self._send_json(502, {"error": "The speech provider could not return audio. Check the server terminal and try again."})

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

            client = OpenAI(timeout=60.0, max_retries=0)
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
            if len(transcript) > 1200:
                self._send_json(422, {"error": "The transcript is over 1,200 characters. Please shorten it or type a shorter question."})
                return
            self._send_json(200, {"transcript": transcript})
        except Exception as exc:
            print(f"Transcription request failed: {exc}")
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

    def _handle_quiz_start(self, body: dict[str, Any]) -> None:
        topic = body.get("topic", "fundamental rights")
        question_count = body.get("question_count", 3)
        language = body.get("language", "hi-IN")
        try:
            quiz = start_quiz(topic, question_count, language)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        quiz_id = str(uuid.uuid4())
        create_quiz_run(
            self.session_id,
            quiz_id,
            quiz["topic"],
            [question["id"] for question in quiz["questions"]],
        )
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
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, result)

    def _ensure_browser_session(self) -> None:
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
        ensure_session(self.session_id)

    def _send_session_cookie_if_needed(self) -> None:
        if self.new_session_cookie:
            self.send_header(
                "Set-Cookie",
                f"bolprep_session={self.session_id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000",
            )

    def _send_json(
        self, status: int, payload: dict[str, Any], include_session_cookie: bool = True
    ) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
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
