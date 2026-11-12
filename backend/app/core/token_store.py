"""Process-local token revocation. Logout revokes one JWT; password reset/deactivation revokes all."""
from __future__ import annotations

from threading import Lock
from time import time

_lock = Lock()
_revoked_jti: dict[str, float] = {}
_user_versions: dict[int, int] = {}


def _prune_unlocked(now: float) -> None:
    expired = [jti for jti, exp in _revoked_jti.items() if exp < now]
    for jti in expired:
        _revoked_jti.pop(jti, None)


def user_token_version(user_id: int) -> int:
    return _user_versions.get(int(user_id), 0)


def bump_user_token_version(user_id: int) -> int:
    with _lock:
        next_version = _user_versions.get(int(user_id), 0) + 1
        _user_versions[int(user_id)] = next_version
        return next_version


def revoke_jti(jti: str, expires_at: float | None = None) -> None:
    if not jti:
        return
    with _lock:
        now = time()
        _prune_unlocked(now)
        _revoked_jti[jti] = float(expires_at) if expires_at else now + 3600


def is_token_revoked(jti: str | None, user_id: int | None, version: int | None) -> bool:
    with _lock:
        now = time()
        _prune_unlocked(now)
        if jti and jti in _revoked_jti:
            return True
        if user_id is None:
            return False
        current = _user_versions.get(int(user_id), 0)
        token_version = 0 if version is None else int(version)
        return token_version != current
