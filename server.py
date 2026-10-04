"""Local-only HTTP server for the BolPrep browser prototype."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from bolprep import ask_model, offline_answer


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8000
MAX_BODY_BYTES = 64 * 1024


class BolPrepHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        routes = {
            "/": (WEB_ROOT / "index.html", "text/html; charset=utf-8"),
            "/app.js": (WEB_ROOT / "app.js", "text/javascript; charset=utf-8"),
            "/styles.css": (WEB_ROOT / "styles.css", "text/css; charset=utf-8"),
        }
        if self.path == "/health":
            from bolprep import api_is_configured

            mode = "model" if api_is_configured() else "offline"
            self._send_json(200, {"ok": True, "mode": mode})
            return
        route = routes.get(self.path)
        if route is None:
            self.send_error(404, "Not found")
            return
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
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        if self.path != "/api/answer":
            self.send_error(404, "Not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid request length."})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Request is empty or too large."})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request must contain valid JSON."})
            return
        if not isinstance(body, dict):
            self._send_json(400, {"error": "Request body must be an object."})
            return

        question = body.get("question")
        history = body.get("history", [])
        if not isinstance(question, str) or not question.strip() or len(question) > 1200:
            self._send_json(400, {"error": "Enter a question under 1,200 characters."})
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
            from bolprep import api_is_configured

            answer = (
                ask_model(question.strip(), cleaned_history)
                if api_is_configured()
                else offline_answer(question.strip())
            )
        except Exception as exc:
            print(f"Tutor request failed: {exc}")
            self._send_json(502, {"error": "Tutor request failed. Check the server terminal and try again."})
            return
        self._send_json(200, {"answer": answer})

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

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
