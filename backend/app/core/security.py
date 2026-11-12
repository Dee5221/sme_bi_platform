import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.token_store import user_token_version

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 8 characters and include a letter and a number"
)
_SENSITIVE_META_KEYS = frozenset(
    {
        "password",
        "password_hash",
        "new_password",
        "current_password",
        "confirm_password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "cookie",
    }
)

# Constant-time dummy verify when the email does not exist.
_DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "TGnt3fvf2/v/P6e0NiZkTA$"
    "s+vMo2QV5SxYSaoe5W8BlA9Imdk5AbftlcN/OTwq8LM"
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def dummy_verify_password(plain_password: str) -> None:
    try:
        pwd_context.verify(plain_password, _DUMMY_PASSWORD_HASH)
    except Exception:
        return


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_policy(password: str) -> str:
    if not password or len(password) < 8 or len(password) > 128:
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return password


def _json_safe(value):
    from datetime import date, datetime as dt
    from decimal import Decimal

    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (dt, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return sanitize_audit_metadata(value) or {}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def sanitize_audit_metadata(metadata: dict | None) -> dict | None:
    if not metadata:
        return None
    cleaned: dict = {}
    for key, value in metadata.items():
        if str(key).lower() in _SENSITIVE_META_KEYS:
            continue
        cleaned[key] = _json_safe(value)
    return cleaned


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode: dict[str, Any] = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    sub = to_encode.get("sub")
    version = 0
    try:
        version = user_token_version(int(sub))
    except (TypeError, ValueError):
        version = 0
    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "jti": uuid4().hex,
            "typ": "access",
            "iss": settings.JWT_ISSUER,
            "ver": version,
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        issuer=settings.JWT_ISSUER,
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
    if payload.get("typ") not in (None, "access"):
        raise JWTError("Invalid token type")
    return payload
