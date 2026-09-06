from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["Categories"])

@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Category).filter(Category.business_id == current_user.business_id).all()

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category_in: CategoryCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    # Check for duplicate name within the same business
    existing = db.query(Category).filter(
        Category.business_id == current_user.business_id,
        Category.name == category_in.name
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category name already exists for this business")
        
    new_category = Category(business_id=current_user.business_id, **category_in.model_dump())
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int, 
    category_in: CategoryUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    category = db.query(Category).filter(Category.id == category_id, Category.business_id == current_user.business_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    for field, value in category_in.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
        
    db.commit()
    db.refresh(category)
    return category