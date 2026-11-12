"""Short-lived in-memory idempotency keys for POS checkout."""
from __future__ import annotations

from threading import Lock
from time import time

from fastapi import HTTPException, status

PENDING_TTL_SECONDS = 60
DONE_TTL_SECONDS = 10 * 60

_lock = Lock()
_store: dict[str, tuple[str, int | None, float]] = {}


def _prune_unlocked(now: float) -> None:
    expired = [key for key, (_kind, _sale_id, exp) in _store.items() if exp < now]
    for key in expired:
        _store.pop(key, None)


def begin_idempotent(key: str | None) -> int | None:
    """Mark a key in-flight. Returns a previous sale id when the key already completed."""
    if not key:
        return None
    now = time()
    with _lock:
        _prune_unlocked(now)
        existing = _store.get(key)
        if existing is None:
            _store[key] = ("pending", None, now + PENDING_TTL_SECONDS)
            return None
        kind, sale_id, _exp = existing
        if kind == "done" and sale_id is not None:
            return sale_id
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sale is already being processed",
        )


def complete_idempotent(key: str | None, sale_id: int) -> None:
    if not key:
        return
    with _lock:
        _store[key] = ("done", sale_id, time() + DONE_TTL_SECONDS)


def abandon_idempotent(key: str | None) -> None:
    if not key:
        return
    with _lock:
        current = _store.get(key)
        if current and current[0] == "pending":
            _store.pop(key, None)
