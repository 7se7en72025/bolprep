"""Thread-safe request quotas for the single-process local server."""

from __future__ import annotations

import math
import time
from collections import deque
from threading import Lock


class RequestLimiter:
    """Count accepted attempts in a rolling window, including failed requests."""

    def __init__(self, limits: dict[str, int], window_seconds: float = 60.0) -> None:
        if not math.isfinite(window_seconds) or window_seconds <= 0:
            raise ValueError("The request window must be positive and finite.")
        if any(not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0 for limit in limits.values()):
            raise ValueError("Request limits must be positive integers.")
        self.limits = dict(limits)
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = {name: deque() for name in limits}
        self._lock = Lock()

    def acquire(self, bucket: str) -> int:
        """Return zero if admitted, or the rounded-up seconds until a slot opens."""
        with self._lock:
            # Read time inside the lock so concurrent admissions remain ordered.
            now = time.monotonic()
            requests = self._requests[bucket]
            while requests and requests[0] <= now - self.window_seconds:
                requests.popleft()
            if len(requests) >= self.limits[bucket]:
                return max(1, math.ceil(requests[0] + self.window_seconds - now))
            requests.append(now)
            return 0
