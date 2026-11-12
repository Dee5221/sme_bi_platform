from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.sale import SaleCreateRequest


def _as_decimal(value) -> Decimal:
    return Decimal(str(value))


def create_completed_sale(
    db: Session,
    current_user: User,
    sale_in: SaleCreateRequest,
    customer_id: int | None,
) -> Sale:
    """Create a completed sale, snapshot line prices, and deduct inventory in one transaction."""
    quantities: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for item_in in sale_in.items:
        quantities[item_in.product_id] += _as_decimal(item_in.quantity)

    products_by_id: dict[int, Product] = {}
    for product_id in sorted(quantities.keys()):
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.business_id == current_user.business_id,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if product.status != "active":
            raise HTTPException(
                status_code=400,
                detail=f"{product.name} is not available for sale",
            )
        products_by_id[product_id] = product

        inventory = (
            db.query(Inventory)
            .filter(Inventory.product_id == product_id)
            .with_for_update()
            .first()
        )
        on_hand = _as_decimal(inventory.quantity_on_hand) if inventory else Decimal("0")
        needed = quantities[product_id]
        if inventory is None or on_hand < needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}",
            )

    total_amount = Decimal("0")
    sale_items_data = []
    for item_in in sale_in.items:
        product = products_by_id[item_in.product_id]
        quantity = _as_decimal(item_in.quantity)
        unit_price = _as_decimal(product.selling_price)
        subtotal = unit_price * quantity
        total_amount += subtotal
        sale_items_data.append(
            {
                "product": product,
                "quantity": quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "product_name": product.name,
                "sku": product.sku,
                "unit_cost": _as_decimal(product.cost_price) if product.cost_price is not None else None,
            }
        )

    db_sale = Sale(
        business_id=current_user.business_id,
        user_id=current_user.id,
        customer_id=customer_id,
        sale_datetime=datetime.now(),
        total_amount=total_amount,
        payment_method=sale_in.payment_method,
        status="completed",
    )
    db.add(db_sale)
    db.flush()

    for item_data in sale_items_data:
        db.add(
            SaleItem(
                sale=db_sale,
                product_id=item_data["product"].id,
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                subtotal=item_data["subtotal"],
                product_name=item_data["product_name"],
                sku=item_data["sku"],
                unit_cost=item_data["unit_cost"],
            )
        )

    for product_id, needed in quantities.items():
        inventory = (
            db.query(Inventory)
            .filter(Inventory.product_id == product_id)
            .with_for_update()
            .first()
        )
        inventory.quantity_on_hand = _as_decimal(inventory.quantity_on_hand) - needed
        inventory.updated_at = func.now()
        db.add(
            StockMovement(
                product_id=product_id,
                user_id=current_user.id,
                movement_type="OUT",
                quantity=needed,
                reference=f"SALE-{db_sale.id}",
                reason="POS sale",
            )
        )

    db.commit()
    db.refresh(db_sale)
    return db_sale
