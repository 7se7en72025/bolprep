"""Optional shared-password access for the localhost demo; no learner accounts."""

from __future__ import annotations

import hashlib
import secrets
import time
from threading import Lock


ACCESS_COOKIE = "bolprep_access"
ACCESS_LIFETIME_SECONDS = 8 * 60 * 60
MAX_ACCESS_SESSIONS = 128


class AccessGate:
    def __init__(self, password: str) -> None:
        self.enabled = bool(password)
        if self.enabled and not 16 <= len(password) <= 256:
            raise ValueError("BOLPREP_ACCESS_PASSWORD must be 16-256 characters, or empty to disable login.")
        self._salt = secrets.token_bytes(16)
        self._password_hash = self._digest(password) if self.enabled else b""
        self._sessions: dict[str, float] = {}
        self._lock = Lock()

    def _digest(self, password: str) -> bytes:
        return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), self._salt, 200_000)

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def allowed(self, token: str | None) -> bool:
        if not self.enabled:
            return True
        if not token or len(token) != 43:
            return False
        with self._lock:
            token_hash = self._token_hash(token)
            expiry = self._sessions.get(token_hash, 0)
            if expiry <= time.monotonic():
                self._sessions.pop(token_hash, None)
                return False
            return True

    def login(self, password: str, previous_token: str | None = None) -> str | None:
        if not self.enabled:
            return None
        try:
            digest = self._digest(password)
        except UnicodeError:
            return None
        if not secrets.compare_digest(digest, self._password_hash):
            return None
        token = secrets.token_urlsafe(32)
        with self._lock:
            now = time.monotonic()
            self._sessions = {key: expiry for key, expiry in self._sessions.items() if expiry > now}
            if previous_token:
                self._sessions.pop(self._token_hash(previous_token), None)
            if len(self._sessions) >= MAX_ACCESS_SESSIONS:
                oldest = min(self._sessions, key=self._sessions.get)
                self._sessions.pop(oldest)
            self._sessions[self._token_hash(token)] = now + ACCESS_LIFETIME_SECONDS
        return token

    def logout(self, token: str | None) -> None:
        if token:
            with self._lock:
                self._sessions.pop(self._token_hash(token), None)
