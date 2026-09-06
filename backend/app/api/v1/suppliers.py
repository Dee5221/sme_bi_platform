from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

@router.get("/", response_model=list[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Supplier).filter(Supplier.business_id == current_user.business_id).all()

@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_in: SupplierCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    new_supplier = Supplier(business_id=current_user.business_id, **supplier_in.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier

@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int, 
    supplier_in: SupplierUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.business_id == current_user.business_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    for field, value in supplier_in.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
        
    db.commit()
    db.refresh(supplier)
    return supplier