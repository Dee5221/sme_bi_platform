from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import FORBIDDEN_DETAIL, require_permission
from app.core.permissions import has_permission
from app.models.category import Category
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.audit import audit_actor

router = APIRouter(prefix="/api/products", tags=["Products"])


def _serialize_product(product: Product, user: User) -> ProductResponse:
    payload = ProductResponse.model_validate(product)
    if not has_permission(user, "products.costs.view"):
        return payload.model_copy(update={"cost_price": None})
    return payload


def _category_for_business(db: Session, category_id: int, business_id: int) -> Category:
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.business_id == business_id,
    ).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category")
    return category


def _supplier_for_business(db: Session, supplier_id: int, business_id: int) -> Supplier:
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.business_id == business_id,
    ).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="Invalid supplier")
    return supplier


@router.get("/", response_model=list[ProductResponse], response_model_exclude_none=True)
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.view")),
):
    products = db.query(Product).filter(Product.business_id == current_user.business_id).all()
    return [_serialize_product(product, current_user) for product in products]


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    existing_sku = db.query(Product).filter(
        Product.business_id == current_user.business_id,
        Product.sku == product_in.sku,
    ).first()
    if existing_sku:
        raise HTTPException(status_code=409, detail="SKU already exists for this business")

    _category_for_business(db, product_in.category_id, current_user.business_id)
    if product_in.supplier_id:
        _supplier_for_business(db, product_in.supplier_id, current_user.business_id)

    if not has_permission(current_user, "products.prices.manage"):
        # Manager may create a product but Owner controls later price changes.
        pass

    new_product = Product(business_id=current_user.business_id, **product_in.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return _serialize_product(new_product, current_user)


@router.patch("/{product_id}", response_model=ProductResponse, response_model_exclude_none=True)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.business_id == current_user.business_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = product_in.model_dump(exclude_unset=True)

    if "selling_price" in updates and not has_permission(current_user, "products.prices.manage"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN_DETAIL)

    price_changes = {}
    if "selling_price" in updates and str(updates["selling_price"]) != str(product.selling_price):
        price_changes["selling_price"] = {"from": product.selling_price, "to": updates["selling_price"]}
    if "cost_price" in updates and str(updates["cost_price"]) != str(product.cost_price):
        price_changes["cost_price"] = {"from": product.cost_price, "to": updates["cost_price"]}

    if "category_id" in updates:
        _category_for_business(db, updates["category_id"], current_user.business_id)

    if "supplier_id" in updates and updates["supplier_id"] is not None:
        _supplier_for_business(db, updates["supplier_id"], current_user.business_id)

    if "sku" in updates and updates["sku"] != product.sku:
        clash = db.query(Product).filter(
            Product.business_id == current_user.business_id,
            Product.sku == updates["sku"],
            Product.id != product.id,
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="SKU already exists for this business")

    for field, value in updates.items():
        setattr(product, field, value)

    if price_changes:
        audit_actor(
            db,
            current_user,
            action="product.price_change",
            entity="product",
            target_id=product.id,
            metadata={"sku": product.sku, "name": product.name, "changes": price_changes},
        )

    db.commit()
    db.refresh(product)
    return _serialize_product(product, current_user)
