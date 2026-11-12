"""Simple in-memory login rate limiter. Not shared across processes."""
from __future__ import annotations

from time import time

from fastapi import HTTPException, status

WINDOW_SECONDS = 15 * 60
MAX_ATTEMPTS = 5
IP_MAX_ATTEMPTS = 30

_attempts: dict[str, list[float]] = {}


def _prune(key: str, now: float) -> list[float]:
    stamps = [stamp for stamp in _attempts.get(key, []) if now - stamp < WINDOW_SECONDS]
    _attempts[key] = stamps
    return stamps


def assert_login_allowed(key: str, ip_key: str | None = None) -> None:
    now = time()
    stamps = _prune(key, now)
    if len(stamps) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )
    if ip_key:
        ip_stamps = _prune(ip_key, now)
        if len(ip_stamps) >= IP_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later.",
            )


def record_login_failure(key: str, ip_key: str | None = None) -> None:
    now = time()
    stamps = _prune(key, now)
    stamps.append(now)
    _attempts[key] = stamps
    if ip_key:
        ip_stamps = _prune(ip_key, now)
        ip_stamps.append(now)
        _attempts[ip_key] = ip_stamps


def clear_login_failures(key: str) -> None:
    _attempts.pop(key, None)
