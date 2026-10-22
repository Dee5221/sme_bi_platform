from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

# Defines the token URL for Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception

        # Handle sub being either an integer ID or an email string
        try:
            user_id = int(sub)
            user = db.query(User).filter(User.id == user_id).first()
        except (ValueError, TypeError):
            # sub is a string (likely email)
            user = db.query(User).filter(User.email == sub).first()

        if user is None:
            raise credentials_exception
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account"
            )
        return user

    except JWTError:
        raise credentials_exception
def require_role(allowed_roles: list[str]):
    """Dependency to enforce role-based access control."""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role.role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resource"
            )
        return current_user
    return role_checker