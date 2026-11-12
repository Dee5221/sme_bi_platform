from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import has_any_permission, has_permission
from app.core.security import decode_access_token
from app.core.token_store import is_token_revoked
from app.models.user import User
from app.services.audit import record_audit

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

FORBIDDEN_DETAIL = "Not authorized to access this resource"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def extract_token_from_request(request: Request, bearer: str | None = None) -> str | None:
    if bearer:
        request.state.auth_source = "bearer"
        return bearer
    cookie = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie:
        request.state.auth_source = "cookie"
        return cookie
    request.state.auth_source = None
    return None


def _enforce_cookie_csrf(request: Request) -> None:
    if getattr(request.state, "auth_source", None) != "cookie":
        return
    if request.method.upper() in _SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin in settings.cors_origin_list:
        return
    if origin is None and not settings.is_production:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid request origin",
    )


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw = extract_token_from_request(request, token)
    if not raw:
        raise _credentials_exception()
    _enforce_cookie_csrf(request)
    try:
        payload = decode_access_token(raw)
        sub = payload.get("sub")
        if sub is None:
            raise _credentials_exception()
        try:
            user_id = int(sub)
        except (ValueError, TypeError):
            raise _credentials_exception()
        if is_token_revoked(payload.get("jti"), user_id, payload.get("ver")):
            raise _credentials_exception()

        user = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == user_id)
            .first()
        )
        if user is None:
            raise _credentials_exception()
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account",
            )
        request.state.token_jti = payload.get("jti")
        request.state.token_exp = payload.get("exp")
        return user
    except JWTError:
        raise _credentials_exception()


def _log_denied(db: Session, request: Request, current_user: User, permission: str) -> None:
    record_audit(
        db,
        action="authz.denied",
        target_entity="http",
        result="denied",
        business_id=current_user.business_id,
        actor_user_id=current_user.id,
        metadata={
            "permission": permission,
            "method": request.method,
            "path": request.url.path,
        },
        commit=True,
    )


def require_permission(permission: str):
    """Deny unless the authenticated user has the given permission."""

    async def permission_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not has_permission(current_user, permission):
            _log_denied(db, request, current_user, permission)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_DETAIL,
            )
        return current_user

    return permission_checker


def require_any_permission(*permissions: str):
    """Deny unless the authenticated user has at least one listed permission."""

    async def permission_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not has_any_permission(current_user, permissions):
            _log_denied(db, request, current_user, ",".join(permissions))
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_DETAIL,
            )
        return current_user

    return permission_checker


def require_role(allowed_roles: list[str]):
    """Legacy role-name check. New endpoints should use require_permission."""
    from app.core.permissions import canonical_role_name, get_user_role_name

    allowed = {canonical_role_name(name) for name in allowed_roles}

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        role_name = get_user_role_name(current_user)
        if role_name not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_DETAIL,
            )
        return current_user

    return role_checker
