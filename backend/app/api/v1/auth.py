from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import extract_token_from_request
from app.core.permissions import get_user_role_name, permissions_for_user
from app.core.rate_limit import assert_login_allowed, clear_login_failures, record_login_failure
from app.core.security import create_access_token, decode_access_token, dummy_verify_password, verify_password
from app.core.token_store import revoke_jti
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import MeResponse, RoleResponse
from app.services.audit import record_audit
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _login_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{email.lower()}"


def _ip_key(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


def _bearer_from_header(request: Request) -> str | None:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        return token or None
    return None


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    request_http: Request,
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    key = _login_key(request_http, request.email)
    ip_key = _ip_key(request_http)
    assert_login_allowed(key, ip_key=ip_key)

    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.email == request.email)
        .first()
    )

    if not user or not verify_password(request.password, user.password_hash):
        if not user:
            dummy_verify_password(request.password)
        record_login_failure(key, ip_key=ip_key)
        if user:
            record_audit(
                db,
                action="auth.login",
                target_entity="user",
                result="denied",
                business_id=user.business_id,
                actor_user_id=user.id,
                target_id=str(user.id),
                metadata={"email": user.email, "reason": "invalid_credentials"},
                commit=True,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != "active":
        record_login_failure(key, ip_key=ip_key)
        record_audit(
            db,
            action="auth.login",
            target_entity="user",
            result="denied",
            business_id=user.business_id,
            actor_user_id=user.id,
            target_id=str(user.id),
            metadata={"email": user.email, "reason": "inactive"},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clear_login_failures(key)
    record_audit(
        db,
        action="auth.login",
        target_entity="user",
        result="success",
        business_id=user.business_id,
        actor_user_id=user.id,
        target_id=str(user.id),
        metadata={"email": user.email},
        commit=True,
    )
    access_token = create_access_token(data={"sub": str(user.id)})
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = extract_token_from_request(request, _bearer_from_header(request))
    if token:
        try:
            payload = decode_access_token(token)
            exp = payload.get("exp")
            exp_ts = float(exp) if isinstance(exp, (int, float)) else None
            if isinstance(exp, datetime):
                aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
                exp_ts = aware.timestamp()
            revoke_jti(str(payload.get("jti") or ""), exp_ts)
            sub = payload.get("sub")
            user = None
            if sub is not None:
                try:
                    user = db.query(User).filter(User.id == int(sub)).first()
                except (TypeError, ValueError):
                    user = None
            if user:
                record_audit(
                    db,
                    action="auth.logout",
                    target_entity="user",
                    result="success",
                    business_id=user.business_id,
                    actor_user_id=user.id,
                    target_id=str(user.id),
                    metadata={"email": user.email},
                    commit=True,
                )
        except JWTError:
            pass
    clear_auth_cookie(response)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    role = current_user.role
    return MeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=RoleResponse.model_validate(role) if role else RoleResponse(id=0, role_name=""),
        status=current_user.status,
        business_id=current_user.business_id,
        permissions=permissions_for_user(current_user),
        role_name=get_user_role_name(current_user),
    )
