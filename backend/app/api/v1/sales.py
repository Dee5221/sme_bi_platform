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
from app.schemas.sale import (
    SaleCreateRequest,
    SaleResponse,
    SaleListResponse,
    SaleItemResponse
)

router = APIRouter(prefix="/api/sales", tags=["Sales"])

@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_in: SaleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new sale with items."""
    
    # 1. Calculate total amount
    total_amount = Decimal('0')
    sale_items_data = []
    
    for item_in in sale_in.items:
        # Fetch product
        product = db.query(Product).filter(
            Product.id == item_in.product_id,
            Product.business_id == current_user.business_id
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {item_in.product_id} not found"
            )
        
        # Calculate subtotal
        unit_price = product.selling_price
        quantity = item_in.quantity
        subtotal = unit_price * quantity
        total_amount += subtotal
        
        sale_items_data.append({
            'product': product,
            'quantity': quantity,
            'unit_price': unit_price,
            'subtotal': subtotal
        })
    
    # 2. Create the sale
    db_sale = Sale(
        business_id=current_user.business_id,
        user_id=current_user.id,
        customer_id=sale_in.customer_id,
        sale_datetime=datetime.now(),
        total_amount=total_amount,
        payment_method=sale_in.payment_method,
        status='completed'
    )
    db.add(db_sale)
    
    # 3. Create sale items
    for item_data in sale_items_data:
        db_sale_item = SaleItem(
            sale=db_sale,  # Link to the sale
            product_id=item_data['product'].id,
            quantity=item_data['quantity'],
            unit_price=item_data['unit_price'],
            subtotal=item_data['subtotal']
        )
        db.add(db_sale_item)
    
    # 4. COMMIT FIRST to generate IDs
    db.commit()
    
    # 5. REFRESH to load the generated IDs
    db.refresh(db_sale)
    for db_sale_item in db_sale.items:
        db.refresh(db_sale_item)
    
    # 6. NOW build the response (IDs are available)
    sale_items_response = []
    for sale_item in db_sale.items:
        product = sale_item.product
        sale_items_response.append(SaleItemResponse(
            id=sale_item.id,  # Now this will have a value
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            quantity=sale_item.quantity,
            unit_price=sale_item.unit_price,
            subtotal=sale_item.subtotal
        ))
    
    # Build the final response
    customer_name = None
    if db_sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == db_sale.customer_id).first()
        if customer:
            customer_name = customer.name
    
    return SaleResponse(
        id=db_sale.id,
        business_id=db_sale.business_id,
        user_id=db_sale.user_id,
        user_name=current_user.name,
        customer_id=db_sale.customer_id,
        customer_name=customer_name,
        sale_datetime=db_sale.sale_datetime,
        total_amount=db_sale.total_amount,
        payment_method=db_sale.payment_method,
        status=db_sale.status,
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