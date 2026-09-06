from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.supplier import Supplier
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.get("/", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Product).filter(Product.business_id == current_user.business_id).all()

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    # 1. Validate SKU uniqueness within business
    existing_sku = db.query(Product).filter(
        Product.business_id == current_user.business_id, Product.sku == product_in.sku
    ).first()
    if existing_sku:
        raise HTTPException(status_code=409, detail="SKU already exists for this business")
        
    # 2. Validate category belongs to this business
    category = db.query(Category).filter(Category.id == product_in.category_id, Category.business_id == current_user.business_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category_id for this business")
        
    # 3. Validate supplier (if provided) belongs to this business
    if product_in.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == product_in.supplier_id, Supplier.business_id == current_user.business_id).first()
        if not supplier:
            raise HTTPException(status_code=400, detail="Invalid supplier_id for this business")

    new_product = Product(business_id=current_user.business_id, **product_in.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, 
    product_in: ProductUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == current_user.business_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Validate category change if present
    if product_in.category_id is not None and product_in.category_id != product.category_id:
        category = db.query(Category).filter(Category.id == product_in.category_id, Category.business_id == current_user.business_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id for this business")

    for field, value in product_in.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
        
    db.commit()
    db.refresh(product)
    return product