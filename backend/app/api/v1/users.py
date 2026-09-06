from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.security import get_password_hash
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner"]))
):
    # Ensure email is unique within the business
    existing_user = db.query(User).filter(
        User.business_id == current_user.business_id, 
        User.email == user_in.email
    ).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered in this business")
        
    role = db.query(Role).filter(Role.id == user_in.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    new_user = User(
        business_id=current_user.business_id,
        role_id=user_in.role_id,
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user