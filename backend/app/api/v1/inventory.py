from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime

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
    # Query joins Product, Category, and Inventory to get a complete view
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
        qty = Decimal(row.quantity_on_hand)
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
        
    movements = db.query(StockMovement).filter(
        StockMovement.product_id == product_id
    ).order_by(StockMovement.created_at.desc()).all()
    
    return movements

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
        
    # Lock the inventory row for update to prevent race conditions
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
            quantity=abs(delta), # Store absolute value as per DB constraint
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