from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import FORBIDDEN_DETAIL, require_permission
from app.core.idempotency import abandon_idempotent, begin_idempotent, complete_idempotent
from app.core.permissions import has_permission
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.sale import (
    SaleCreateRequest,
    SaleItemResponse,
    SaleListResponse,
    SaleResponse,
)
from app.services.audit import audit_actor
from app.services.sales import create_completed_sale

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def _customer_for_business(db: Session, customer_id: int, business_id: int) -> Customer:
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == business_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def _user_in_business(db: Session, user_id: int, business_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id, User.business_id == business_id).first()


def _can_view_sale(user: User, sale: Sale) -> bool:
    if has_permission(user, "sales.view_all"):
        return True
    if has_permission(user, "sales.view_own") and sale.user_id == user.id:
        return True
    return False


def _sale_response(db: Session, sale: Sale, actor: User) -> SaleResponse:
    cashier = _user_in_business(db, sale.user_id, actor.business_id)
    customer_name = None
    if sale.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == sale.customer_id,
            Customer.business_id == actor.business_id,
        ).first()
        customer_name = customer.name if customer else None

    include_cost = has_permission(actor, "products.costs.view")
    items_response = []
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
    for item in items:
        product = db.query(Product).filter(
            Product.id == item.product_id,
            Product.business_id == actor.business_id,
        ).first()
        items_response.append(
            SaleItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product_name or (product.name if product else "Unknown"),
                sku=item.sku or (product.sku if product else "N/A"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
                unit_cost=item.unit_cost if include_cost else None,
            )
        )

    return SaleResponse(
        id=sale.id,
        business_id=sale.business_id,
        user_id=sale.user_id,
        user_name=cashier.name if cashier else "Unknown",
        customer_id=sale.customer_id,
        customer_name=customer_name,
        sale_datetime=sale.sale_datetime,
        total_amount=sale.total_amount,
        payment_method=sale.payment_method,
        status=sale.status,
        items=items_response,
    )


def _idempotency_key(request: Request, current_user: User) -> str | None:
    raw = (request.headers.get("Idempotency-Key") or "").strip()
    if not raw:
        return None
    return f"{current_user.business_id}:{current_user.id}:{raw[:128]}"


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
def create_sale(
    sale_in: SaleCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.create")),
):
    scoped_key = _idempotency_key(request, current_user)
    replay_id = begin_idempotent(scoped_key)
    if replay_id is not None:
        sale = db.query(Sale).filter(
            Sale.id == replay_id,
            Sale.business_id == current_user.business_id,
        ).first()
        if sale:
            return _sale_response(db, sale, current_user)
        abandon_idempotent(scoped_key)

    customer_id = None
    if sale_in.customer_id is not None:
        customer = _customer_for_business(db, sale_in.customer_id, current_user.business_id)
        customer_id = customer.id

    try:
        db_sale = create_completed_sale(db, current_user, sale_in, customer_id)
        audit_actor(
            db,
            current_user,
            action="sale.create",
            entity="sale",
            target_id=db_sale.id,
            metadata={
                "total_amount": db_sale.total_amount,
                "payment_method": db_sale.payment_method,
                "item_count": len(sale_in.items),
            },
            commit=True,
        )
        complete_idempotent(scoped_key, db_sale.id)
        return _sale_response(db, db_sale, current_user)
    except Exception:
        abandon_idempotent(scoped_key)
        raise


@router.get("/", response_model=list[SaleListResponse])
def list_sales(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.view_own")),
):
    query = db.query(Sale).filter(Sale.business_id == current_user.business_id)

    if has_permission(current_user, "sales.view_all"):
        if user_id is not None:
            query = query.filter(Sale.user_id == user_id)
    else:
        if user_id is not None and user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN_DETAIL)
        query = query.filter(Sale.user_id == current_user.id)

    if start_date:
        query = query.filter(Sale.sale_datetime >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Sale.sale_datetime <= datetime.combine(end_date, datetime.max.time()))
    if status_filter:
        query = query.filter(Sale.status == status_filter)

    sales = query.order_by(Sale.sale_datetime.desc()).all()
    response = []
    for sale in sales:
        cashier = _user_in_business(db, sale.user_id, current_user.business_id)
        customer_name = None
        if sale.customer_id:
            customer = db.query(Customer).filter(
                Customer.id == sale.customer_id,
                Customer.business_id == current_user.business_id,
            ).first()
            customer_name = customer.name if customer else None
        item_count = db.query(func.count(SaleItem.id)).filter(SaleItem.sale_id == sale.id).scalar()
        response.append(
            SaleListResponse(
                id=sale.id,
                sale_datetime=sale.sale_datetime,
                total_amount=sale.total_amount,
                payment_method=sale.payment_method,
                status=sale.status,
                user_name=cashier.name if cashier else "Unknown",
                customer_name=customer_name,
                item_count=item_count,
            )
        )
    return response


@router.get("/{sale_id}", response_model=SaleResponse, response_model_exclude_none=True)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.view_own")),
):
    sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.business_id == current_user.business_id,
    ).first()
    if not sale or not _can_view_sale(current_user, sale):
        raise HTTPException(status_code=404, detail="Sale not found")
    return _sale_response(db, sale, current_user)
