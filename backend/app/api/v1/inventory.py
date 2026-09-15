from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field # Fixed typo: 'field' -> 'Field'

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.product import Product
from app.models.inventory import Inventory, StockMovement
from app.models.category import Category
from app.schemas.inventory import (
    InventoryResponse, 
    StockMovementResponse, 
    StockOperationRequest, 
    StockAdjustmentRequest
)

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

def get_stock_status(qty: Decimal, reorder_level: Decimal) -> str:
    if qty == 0:
        return "out_of_stock"
    elif qty <= reorder_level:
        return "low_stock"
    return "sufficient"

@router.get("/", response_model=list[InventoryResponse])
def list_inventory(
    low_stock_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        Product.id.label("product_id"),
        Product.name.label("product_name"),
        Product.sku,
        Category.name.label("category_name"),
        func.coalesce(Inventory.quantity_on_hand, 0).label("quantity_on_hand"),
        Product.reorder_level,
        Inventory.updated_at
    ).join(Category, Product.category_id == Category.id)\
     .outerjoin(Inventory, Product.id == Inventory.product_id)\
     .filter(Product.business_id == current_user.business_id, Product.status == 'active')

    if low_stock_only:
        query = query.filter(
            (Inventory.quantity_on_hand == None) | 
            (Inventory.quantity_on_hand <= Product.reorder_level)
        )

    results = query.all()
    
    response = []
    for row in results:
        # Safely handle None from outer join
        qty = Decimal(row.quantity_on_hand) if row.quantity_on_hand is not None else Decimal("0.00")
        response.append(InventoryResponse(
            product_id=row.product_id,
            product_name=row.product_name,
            sku=row.sku,
            category_name=row.category_name,
            quantity_on_hand=qty,
            reorder_level=row.reorder_level,
            stock_status=get_stock_status(qty, row.reorder_level),
            updated_at=row.updated_at
        ))
    return response

@router.get("/{product_id}", response_model=InventoryResponse)
def get_product_inventory(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).first()
    qty = inventory.quantity_on_hand if inventory else Decimal("0.00")
    updated_at = inventory.updated_at if inventory else None
    
    return InventoryResponse(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        category_name=product.category.name,
        quantity_on_hand=qty,
        reorder_level=product.reorder_level,
        stock_status=get_stock_status(qty, product.reorder_level),
        updated_at=updated_at
    )

@router.get("/{product_id}/movements", response_model=list[StockMovementResponse])
def get_stock_movements(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    movements = db.query(
        StockMovement.id,
        StockMovement.product_id,
        Product.name.label("product_name"),
        Product.sku,
        StockMovement.user_id,
        User.name.label("user_name"),
        StockMovement.movement_type,
        StockMovement.quantity,
        StockMovement.reference,
        StockMovement.reason,
        StockMovement.created_at
    ).join(Product, StockMovement.product_id == Product.id)\
     .join(User, StockMovement.user_id == User.id)\
     .filter(StockMovement.product_id == product_id, Product.business_id == current_user.business_id)\
     .order_by(StockMovement.created_at.desc()).all()
    
    return movements

# ==============================================================================
# NEW: Global movements endpoint for the frontend movement history page
# ==============================================================================
@router.get("/movements", response_model=list[StockMovementResponse])
def get_all_movements(
    product_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        StockMovement.id,
        StockMovement.product_id,
        Product.name.label("product_name"),
        Product.sku,
        StockMovement.user_id,
        User.name.label("user_name"),
        StockMovement.movement_type,
        StockMovement.quantity,
        StockMovement.reference,
        StockMovement.reason,
        StockMovement.created_at
    ).join(Product, StockMovement.product_id == Product.id)\
     .join(User, StockMovement.user_id == User.id)\
     .filter(Product.business_id == current_user.business_id)
     
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
        
    return query.order_by(StockMovement.created_at.desc()).all()

# ==============================================================================
# NEW: Threshold update endpoint to map frontend's lowStockThreshold to backend's Product.reorder_level
# ==============================================================================
class ThresholdUpdateRequest(BaseModel):
    lowStockThreshold: Decimal = Field(..., ge=0)

@router.put("/{product_id}/threshold")
@router.patch("/{product_id}/threshold")
def update_threshold(
    product_id: int,
    payload: ThresholdUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    product.reorder_level = payload.lowStockThreshold
    db.commit()
    db.refresh(product)
    return {"message": "Threshold updated", "reorder_level": float(product.reorder_level)}

# ==============================================================================
# Existing Stock Operations (Unchanged, but verified)
# ==============================================================================

@router.post("/{product_id}/stock-in", response_model=InventoryResponse)
def stock_in(
    product_id: int,
    operation: StockOperationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).with_for_update().first()
    
    if not inventory:
        inventory = Inventory(product_id=product_id, quantity_on_hand=Decimal("0.00"))
        db.add(inventory)
        
    inventory.quantity_on_hand += operation.quantity
    inventory.updated_at = func.now()
    
    movement = StockMovement(
        product_id=product_id,
        user_id=current_user.id,
        movement_type="IN",
        quantity=operation.quantity,
        reference=operation.reference,
        reason=operation.reason
    )
    db.add(movement)
    db.commit()
    db.refresh(inventory)
    
    return InventoryResponse(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        category_name=product.category.name,
        quantity_on_hand=inventory.quantity_on_hand,
        reorder_level=product.reorder_level,
        stock_status=get_stock_status(inventory.quantity_on_hand, product.reorder_level),
        updated_at=inventory.updated_at
    )

@router.post("/{product_id}/stock-out", response_model=InventoryResponse)
def stock_out(
    product_id: int,
    operation: StockOperationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).with_for_update().first()
    
    if not inventory or inventory.quantity_on_hand < operation.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
        
    inventory.quantity_on_hand -= operation.quantity
    inventory.updated_at = func.now()
    
    movement = StockMovement(
        product_id=product_id,
        user_id=current_user.id,
        movement_type="OUT",
        quantity=operation.quantity,
        reference=operation.reference,
        reason=operation.reason
    )
    db.add(movement)
    db.commit()
    db.refresh(inventory)
    
    return InventoryResponse(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        category_name=product.category.name,
        quantity_on_hand=inventory.quantity_on_hand,
        reorder_level=product.reorder_level,
        stock_status=get_stock_status(inventory.quantity_on_hand, product.reorder_level),
        updated_at=inventory.updated_at
    )

@router.post("/{product_id}/adjust", response_model=InventoryResponse)
def stock_adjust(
    product_id: int,
    operation: StockAdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.business_id == current_user.business_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).with_for_update().first()
    
    if not inventory:
        inventory = Inventory(product_id=product_id, quantity_on_hand=Decimal("0.00"))
        db.add(inventory)
        
    current_qty = inventory.quantity_on_hand
    delta = operation.new_quantity - current_qty
    
    if delta != 0:
        movement = StockMovement(
            product_id=product_id,
            user_id=current_user.id,
            movement_type="ADJUSTMENT",
            quantity=abs(delta),
            reference="ADJUSTMENT",
            reason=operation.reason or f"Adjusted from {current_qty} to {operation.new_quantity}"
        )
        db.add(movement)
        inventory.quantity_on_hand = operation.new_quantity
        inventory.updated_at = func.now()
        db.commit()
        db.refresh(inventory)
    
    return InventoryResponse(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        category_name=product.category.name,
        quantity_on_hand=inventory.quantity_on_hand,
        reorder_level=product.reorder_level,
        stock_status=get_stock_status(inventory.quantity_on_hand, product.reorder_level),
        updated_at=inventory.updated_at
    )