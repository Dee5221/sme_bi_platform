from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime, date
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.inventory import Inventory, StockMovement
from app.schemas.sale import SaleCreateRequest, SaleResponse, SaleListResponse

router = APIRouter(prefix="/api/sales", tags=["Sales"])

@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_in: SaleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager", "Staff"]))
):
    """
    Create a new sale transaction atomically.
    This is the critical transaction that:
    1. Validates all products and stock
    2. Creates sale header and items
    3. Reduces inventory
    4. Records stock movements
    All in one atomic database transaction.
    """
    
    # Validate customer if provided
    if sale_in.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == sale_in.customer_id,
            Customer.business_id == current_user.business_id
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check for duplicate products in the request and aggregate quantities
    product_quantities = {}
    for item in sale_in.items:
        if item.product_id in product_quantities:
            product_quantities[item.product_id] += item.quantity
        else:
            product_quantities[item.product_id] = item.quantity
    
    # Validate all products and check stock availability
    products_data = []
    total_amount = Decimal("0.00")
    
    for product_id, quantity in product_quantities.items():
        # Lock the product row to prevent concurrent modifications
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.business_id == current_user.business_id,
            Product.status == 'active'
        ).with_for_update().first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found or inactive")
        
        # Lock the inventory row
        inventory = db.query(Inventory).filter(
            Inventory.product_id == product_id
        ).with_for_update().first()
        
        current_stock = inventory.quantity_on_hand if inventory else Decimal("0.00")
        
        if current_stock < quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for product '{product.name}'. Available: {current_stock}, Requested: {quantity}"
            )
        
        # Calculate subtotal using authoritative price
        unit_price = product.selling_price
        subtotal = (quantity * unit_price).quantize(Decimal("0.01"))
        total_amount += subtotal
        
        products_data.append({
            "product": product,
            "quantity": quantity,
            "unit_price": unit_price,
            "subtotal": subtotal
        })
    
    # Create the sale header
    new_sale = Sale(
        business_id=current_user.business_id,
        user_id=current_user.id,
        customer_id=sale_in.customer_id,
        sale_datetime=datetime.utcnow(),
        total_amount=total_amount,
        payment_method=sale_in.payment_method,
        status="completed"
    )
    db.add(new_sale)
    db.flush()  # Get the sale ID
    
    # Create sale items and update inventory
    sale_items_response = []
    for data in products_data:
        product = data["product"]
        quantity = data["quantity"]
        unit_price = data["unit_price"]
        subtotal = data["subtotal"]
        
        # Create sale item
        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal
        )
        db.add(sale_item)
        
        # Update inventory
        inventory = db.query(Inventory).filter(
            Inventory.product_id == product.id
        ).with_for_update().first()
        
        if not inventory:
            inventory = Inventory(product_id=product.id, quantity_on_hand=Decimal("0.00"))
            db.add(inventory)
        
        inventory.quantity_on_hand -= quantity
        inventory.updated_at = func.now()
        
        # Record stock movement
        movement = StockMovement(
            product_id=product.id,
            user_id=current_user.id,
            movement_type="OUT",
            quantity=quantity,
            reference=f"SALE-{new_sale.id}",
            reason=f"Sale transaction #{new_sale.id}"
        )
        db.add(movement)
        
        sale_items_response.append(SaleItemResponse(
            id=sale_item.id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal
        ))
    
    # Commit the entire transaction atomically
    db.commit()
    db.refresh(new_sale)
    
    # Build response
    customer_name = None
    if sale_in.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale_in.customer_id).first()
        customer_name = customer.name if customer else None
    
    return SaleResponse(
        id=new_sale.id,
        business_id=new_sale.business_id,
        user_id=new_sale.user_id,
        user_name=current_user.name,
        customer_id=new_sale.customer_id,
        customer_name=customer_name,
        sale_datetime=new_sale.sale_datetime,
        total_amount=new_sale.total_amount,
        payment_method=new_sale.payment_method,
        status=new_sale.status,
        items=sale_items_response
    )

@router.get("/", response_model=list[SaleListResponse])
def list_sales(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List sales with optional filtering."""
    query = db.query(Sale).filter(Sale.business_id == current_user.business_id)
    
    if start_date:
        query = query.filter(Sale.sale_datetime >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Sale.sale_datetime <= datetime.combine(end_date, datetime.max.time()))
    if status_filter:
        query = query.filter(Sale.status == status_filter)
    if user_id:
        query = query.filter(Sale.user_id == user_id)
    
    sales = query.order_by(Sale.sale_datetime.desc()).all()
    
    response = []
    for sale in sales:
        user = db.query(User).filter(User.id == sale.user_id).first()
        customer_name = None
        if sale.customer_id:
            customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
            customer_name = customer.name if customer else None
        
        item_count = db.query(func.count(SaleItem.id)).filter(SaleItem.sale_id == sale.id).scalar()
        
        response.append(SaleListResponse(
            id=sale.id,
            sale_datetime=sale.sale_datetime,
            total_amount=sale.total_amount,
            payment_method=sale.payment_method,
            status=sale.status,
            user_name=user.name if user else "Unknown",
            customer_name=customer_name,
            item_count=item_count
        ))
    
    return response

@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific sale."""
    sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.business_id == current_user.business_id
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Get user and customer info
    user = db.query(User).filter(User.id == sale.user_id).first()
    customer_name = None
    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        customer_name = customer.name if customer else None
    
    # Get sale items with product info
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
    items_response = []
    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        items_response.append(SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=product.name if product else "Unknown",
            sku=product.sku if product else "N/A",
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal
        ))
    
    return SaleResponse(
        id=sale.id,
        business_id=sale.business_id,
        user_id=sale.user_id,
        user_name=user.name if user else "Unknown",
        customer_id=sale.customer_id,
        customer_name=customer_name,
        sale_datetime=sale.sale_datetime,
        total_amount=sale.total_amount,
        payment_method=sale.payment_method,
        status=sale.status,
        items=items_response
    )