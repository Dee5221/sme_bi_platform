#!/usr/bin/env python3
"""
DATA-02: Historical Business Data & Transaction Seeding (REFINED)

Generates 6 months of realistic historical business activity in 2026:
- April 2, 2026 → October 2, 2026
- Focus on everyday products: Beef, Beverages, Chicken
- Stock replenishment events
- 50-100 expense records
- Maintains inventory consistency

Uses existing models and business logic. Idempotent and deterministic.
"""

import sys
import os
import random
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Dict
from collections import defaultdict

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import SessionLocal
from app.models import (
    Business, User, Product, Customer, Supplier, Category,
    Sale, SaleItem, Inventory, StockMovement, Expense
)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Fixed seed for deterministic generation
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

# Historical period: 6 months in 2026
# April 2, 2026 → October 2, 2026
START_DATE = datetime(2026, 4, 2, 0, 0, 0)
END_DATE = datetime(2026, 10, 2, 23, 59, 59)

# Category indices (alphabetically sorted from DATA-01):
# 0=Beef, 1=Beverages, 2=Chicken, 3=Dairy, 4=Frozen Products,
# 5=Groceries, 6=Offals, 7=Pork, 8=Processed Meat, 9=Sausages
#
# Demand multipliers - BOOSTED for everyday products:
# Beef, Beverages, Chicken = highest (everyday staples)
DEMAND_PATTERNS = {
    0: 2.0,   # Beef - VERY HIGH (everyday protein)
    1: 2.2,   # Beverages - VERY HIGH (everyday drink, high frequency)
    2: 2.0,   # Chicken - VERY HIGH (everyday protein)
    3: 1.3,   # Dairy - HIGH (everyday)
    4: 0.9,   # Frozen Products - MEDIUM
    5: 1.5,   # Groceries - HIGH (everyday staples)
    6: 0.3,   # Offals - LOW (specialty)
    7: 0.8,   # Pork - MEDIUM
    8: 0.7,   # Processed Meat - MEDIUM
    9: 1.0,   # Sausages - MEDIUM-HIGH
}

# Payment methods (must match backend)
PAYMENT_METHODS = ["Cash", "Card", "Mobile Money"]

# Expense categories
EXPENSE_CATEGORIES = [
    "Utilities",
    "Transport",
    "Maintenance",
    "Supplies",
    "Rent",
    "Communications",
    "Marketing",
    "Insurance",
    "Miscellaneous"
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_business_and_users(db: Session):
    """Get the business and its users."""
    business = db.query(Business).first()
    if not business:
        raise Exception("No business found. Run seed_demo_data.py first.")
    
    users = db.query(User).filter(User.business_id == business.id).all()
    if not users:
        raise Exception("No users found for business.")
    
    return business, users


def get_products_by_category(db: Session, business_id: int) -> Dict[int, List[Product]]:
    """Get products grouped by category."""
    products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == "active"
    ).all()
    
    by_category = {}
    for product in products:
        cat_id = product.category_id
        if cat_id not in by_category:
            by_category[cat_id] = []
        by_category[cat_id].append(product)
    
    return by_category


def get_customers(db: Session, business_id: int) -> List[Customer]:
    """Get all customers for the business."""
    return db.query(Customer).filter(Customer.business_id == business_id).all()


def get_suppliers(db: Session, business_id: int) -> List[Supplier]:
    """Get all suppliers for the business."""
    return db.query(Supplier).filter(Supplier.business_id == business_id).all()


def get_category_map(db: Session, business_id: int) -> Dict[int, int]:
    """Map category_id to category_index (0-9) alphabetically."""
    categories = db.query(Category).filter(Category.business_id == business_id).all()
    # Sort by name to get consistent alphabetical ordering
    categories.sort(key=lambda c: c.name)
    return {cat.id: idx for idx, cat in enumerate(categories)}


def generate_business_hours_date(base_date: datetime) -> datetime:
    """Generate a datetime within business hours (8am-8pm)."""
    hour = random.randint(8, 20)
    minute = random.randint(0, 59)
    return base_date.replace(hour=hour, minute=minute, second=0, microsecond=0)


def should_generate_sale_on_date(date: datetime) -> bool:
    """Determine if sales should occur on this date."""
    # Weekdays have higher probability
    if date.weekday() < 5:  # Monday-Friday
        return random.random() < 0.90  # Increased for everyday products
    else:  # Weekend
        return random.random() < 0.70  # Increased for everyday products


def get_sales_count_for_date(date: datetime) -> int:
    """Determine how many sales to generate on this date."""
    # Higher base counts since we're focusing on everyday products
    if date.weekday() < 5:
        base = random.randint(3, 7)  # Increased from 2-5
    else:
        base = random.randint(2, 5)  # Increased from 1-3
    
    # Add some seasonal variation (slight uptick toward end of period)
    days_from_start = (date - START_DATE).days
    seasonal_factor = 1.0 + 0.15 * (days_from_start / 183.0)
    
    return max(2, int(base * seasonal_factor))


def select_products_for_sale(products_by_category: Dict[int, List[Product]], 
                             category_map: Dict[int, int]) -> List[tuple]:
    """Select 1-6 products for a sale with realistic quantities.
    
    Heavily weighted toward everyday products (Beef, Beverages, Chicken).
    """
    # More items per sale since everyday products are frequently bought together
    num_products = random.choices(
        [1, 2, 3, 4, 5, 6], 
        weights=[0.15, 0.30, 0.30, 0.15, 0.07, 0.03]
    )[0]
    
    selected = []
    available_categories = list(products_by_category.keys())
    
    for _ in range(num_products):
        # Weight category selection heavily by demand (everyday products dominate)
        weights = [DEMAND_PATTERNS.get(category_map.get(cat_id, 0), 0.5) 
                  for cat_id in available_categories]
        
        if not any(weights):
            break
        
        cat_id = random.choices(available_categories, weights=weights)[0]
        products = products_by_category[cat_id]
        
        if products:
            product = random.choice(products)
            
            # Everyday products (Beef, Beverages, Chicken) tend to have higher quantities
            cat_idx = category_map.get(cat_id, 0)
            if cat_idx in [0, 1, 2]:  # Beef, Beverages, Chicken
                quantity = random.choices(
                    [1, 2, 3, 4, 5, 6],
                    weights=[0.20, 0.30, 0.25, 0.15, 0.07, 0.03]
                )[0]
            else:
                quantity = random.choices(
                    [1, 2, 3, 4, 5],
                    weights=[0.40, 0.30, 0.15, 0.10, 0.05]
                )[0]
            
            selected.append((product, quantity))
    
    return selected


def check_and_replenish_inventory(db: Session, product: Product, quantity: Decimal,
                                  suppliers: List[Supplier], user_id: int,
                                  sale_date: datetime) -> bool:
    """Check if inventory is sufficient, replenish if needed."""
    inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
    
    if not inventory:
        return False
    
    current_stock = inventory.quantity_on_hand
    
    # If stock is insufficient, create a replenishment
    if current_stock < quantity:
        # For everyday products, replenish more aggressively
        replenish_qty = max(quantity * 3, Decimal("30.00"))
        
        # Create stock IN movement
        movement = StockMovement(
            product_id=product.id,
            user_id=user_id,
            movement_type="IN",
            quantity=replenish_qty,
            reference=f"RESTOCK-{sale_date.strftime('%Y%m%d')}",
            reason="Historical replenishment"
        )
        db.add(movement)
        
        # Update inventory
        inventory.quantity_on_hand += replenish_qty
        inventory.updated_at = sale_date
        
        db.flush()
    
    return True


def check_already_seeded(db: Session, business_id: int) -> bool:
    """Check if historical data has already been seeded."""
    # Look for sales with our reference pattern
    marker_sale = db.query(Sale).filter(
        Sale.business_id == business_id,
        Sale.sale_datetime.between(START_DATE, END_DATE)
    ).first()
    
    return marker_sale is not None


# ============================================================================
# SEEDING FUNCTIONS
# ============================================================================

def seed_historical_sales(db: Session, business_id: int, users: List[User],
                         products_by_category: Dict[int, List[Product]],
                         customers: List[Customer],
                         category_map: Dict[int, int],
                         suppliers: List[Supplier]) -> tuple:
    """Generate historical sales transactions."""
    sales_created = 0
    items_created = 0
    
    # Track category sales for reporting (dynamically handles any number of categories)
    category_sales = defaultdict(int)
    
    # Generate sales day by day
    current_date = START_DATE
    
    while current_date <= END_DATE:
        if should_generate_sale_on_date(current_date):
            num_sales = get_sales_count_for_date(current_date)
            
            for _ in range(num_sales):
                # Generate sale datetime
                sale_datetime = generate_business_hours_date(current_date)
                
                # Select random user
                user = random.choice(users)
                
                # Select customer (70% walk-in, 30% identified)
                customer = None
                if random.random() < 0.30 and customers:
                    customer = random.choice(customers)
                
                # Select payment method (Cash dominant for everyday retail)
                payment_method = random.choices(
                    PAYMENT_METHODS,
                    weights=[0.60, 0.25, 0.15]  # Cash-heavy
                )[0]
                
                # Select products
                selected_products = select_products_for_sale(products_by_category, category_map)
                
                if not selected_products:
                    continue
                
                # Calculate total and check inventory
                total_amount = Decimal("0.00")
                sale_items_data = []
                
                for product, quantity in selected_products:
                    # Check and replenish inventory if needed
                    if not check_and_replenish_inventory(
                        db, product, Decimal(str(quantity)), suppliers, user.id, sale_datetime
                    ):
                        continue
                    
                    # Create sale item
                    unit_price = product.selling_price
                    subtotal = (unit_price * quantity).quantize(Decimal("0.01"))
                    
                    sale_items_data.append({
                        "product_id": product.id,
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "subtotal": subtotal,
                        "category_id": product.category_id
                    })
                    
                    total_amount += subtotal
                    
                    # Deduct inventory
                    inventory = db.query(Inventory).filter(
                        Inventory.product_id == product.id
                    ).first()
                    inventory.quantity_on_hand -= Decimal(str(quantity))
                    inventory.updated_at = sale_datetime
                    
                    # Create stock OUT movement
                    movement = StockMovement(
                        product_id=product.id,
                        user_id=user.id,
                        movement_type="OUT",
                        quantity=Decimal(str(quantity)),
                        reference=f"SALE-HIST",
                        reason=f"Historical sale"
                    )
                    db.add(movement)
                    
                    # Track category
                    cat_idx = category_map.get(product.category_id, -1)
                    if cat_idx >= 0:
                        category_sales[cat_idx] += 1
                
                if not sale_items_data:
                    continue
                
                # Create sale
                sale = Sale(
                    business_id=business_id,
                    user_id=user.id,
                    customer_id=customer.id if customer else None,
                    sale_datetime=sale_datetime,
                    total_amount=total_amount,
                    payment_method=payment_method,
                    status="completed"
                )
                db.add(sale)
                db.flush()  # Get sale ID
                
                # Create sale items
                for item_data in sale_items_data:
                    sale_item = SaleItem(
                        sale_id=sale.id,
                        product_id=item_data["product_id"],
                        quantity=Decimal(str(item_data["quantity"])),
                        unit_price=item_data["unit_price"],
                        subtotal=item_data["subtotal"]
                    )
                    db.add(sale_item)
                    items_created += 1
                
                sales_created += 1
        
        current_date += timedelta(days=1)
    
    # Print category breakdown (dynamic)
    print("\n  Sales by category:")
    idx_to_name = {v: k for k, v in category_map.items()}
    
    sorted_cats = sorted(category_sales.items(), key=lambda x: x[1], reverse=True)
    for idx, count in sorted_cats:
        if count > 0:
            cat_name = idx_to_name.get(idx, f"Category {idx}")
            print(f"    {cat_name}: {count} items sold")
    
    return sales_created, items_created


def seed_historical_expenses(db: Session, business_id: int, users: List[User]) -> int:
    """Generate historical expense records."""
    expenses_created = 0
    
    # Distribute expenses across the period
    current_date = START_DATE
    
    while current_date <= END_DATE:
        # Generate 0-2 expenses per week
        if current_date.weekday() == 0:  # Monday
            num_expenses = random.choices([0, 1, 2], weights=[0.3, 0.5, 0.2])[0]
            
            for _ in range(num_expenses):
                expense_date = generate_business_hours_date(
                    current_date + timedelta(days=random.randint(0, 6))
                )
                
                user = random.choice(users)
                category = random.choice(EXPENSE_CATEGORIES)
                
                # Generate realistic amounts based on category
                if category == "Rent":
                    amount = Decimal(str(random.randint(2000, 5000)))
                elif category in ["Utilities", "Insurance"]:
                    amount = Decimal(str(random.randint(500, 1500)))
                else:
                    amount = Decimal(str(random.randint(100, 800)))
                
                expense = Expense(
                    business_id=business_id,
                    user_id=user.id,
                    category=category,
                    description=f"{category} expense",
                    amount=amount,
                    date=expense_date.date(),
                    payment_method=random.choice(PAYMENT_METHODS),
                    notes="Historical expense record"
                )
                db.add(expense)
                expenses_created += 1
        
        current_date += timedelta(days=1)
    
    return expenses_created


# ============================================================================
# VALIDATION
# ============================================================================

def validate_data(db: Session, business_id: int):
    """Validate the seeded data."""
    print("\n" + "=" * 70)
    print("VALIDATION")
    print("=" * 70)
    
    # Check for negative inventory
    negative_inventory = db.query(Inventory).filter(
        Inventory.quantity_on_hand < 0
    ).count()
    
    if negative_inventory > 0:
        print(f"❌ WARNING: {negative_inventory} products have negative inventory!")
    else:
        print("✓ No negative inventory")
    
    # Check sales totals match items
    sales = db.query(Sale).filter(Sale.business_id == business_id).all()
    mismatched = 0
    
    for sale in sales:
        items_total = sum(item.subtotal for item in sale.items)
        if abs(sale.total_amount - items_total) > Decimal("0.01"):
            mismatched += 1
    
    if mismatched > 0:
        print(f"❌ WARNING: {mismatched} sales have mismatched totals!")
    else:
        print("✓ All sale totals match their items")
    
    # Check stock movements
    out_movements = db.query(StockMovement).filter(
        StockMovement.movement_type == "OUT"
    ).count()
    
    in_movements = db.query(StockMovement).filter(
        StockMovement.movement_type == "IN"
    ).count()
    
    print(f"✓ Stock movements: {in_movements} IN, {out_movements} OUT")


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("DATA-02: Historical Business Data & Transaction Seeding (2026)")
    print(f"Period: {START_DATE.date()} → {END_DATE.date()}")
    print("Focus: Beef, Beverages, Chicken (everyday products)")
    print("=" * 70)
    
    db = SessionLocal()
    
    try:
        # Get business and users
        business, users = get_business_and_users(db)
        print(f"\n✓ Using business: {business.name} (ID: {business.id})")
        print(f"✓ Found {len(users)} users")
        
        # Check if already seeded
        if check_already_seeded(db, business.id):
            print("\n⚠ Historical data already exists. Skipping to prevent duplicates.")
            print("  To re-seed, clear historical data first.")
            return
        
        # Get master data
        products_by_category = get_products_by_category(db, business.id)
        customers = get_customers(db, business.id)
        suppliers = get_suppliers(db, business.id)
        category_map = get_category_map(db, business.id)
        
        print(f"✓ Found {sum(len(p) for p in products_by_category.values())} products")
        print(f"✓ Found {len(customers)} customers")
        print(f"✓ Found {len(suppliers)} suppliers")
        
        # Show category mapping for transparency
        print("\n  Category mapping (alphabetical):")
        categories = db.query(Category).filter(Category.business_id == business.id).all()
        categories.sort(key=lambda c: c.name)
        for idx, cat in enumerate(categories):
            print(f"    {idx}: {cat.name}")
        
        # Count existing data
        print("\n--- Existing data before seeding ---")
        existing_sales = db.query(Sale).filter(Sale.business_id == business.id).count()
        existing_items = db.query(SaleItem).join(Sale).filter(Sale.business_id == business.id).count()
        existing_expenses = db.query(Expense).filter(Expense.business_id == business.id).count()
        existing_movements = db.query(StockMovement).count()
        
        print(f"  Sales: {existing_sales}")
        print(f"  Sale Items: {existing_items}")
        print(f"  Expenses: {existing_expenses}")
        print(f"  Stock Movements: {existing_movements}")
        
        # Seed historical sales
        print(f"\n--- Generating historical sales ---")
        sales_created, items_created = seed_historical_sales(
            db, business.id, users, products_by_category, customers,
            category_map, suppliers
        )
        print(f"\n✓ Created {sales_created} sales with {items_created} items")
        
        # Seed historical expenses
        print("\n--- Generating historical expenses ---")
        expenses_created = seed_historical_expenses(db, business.id, users)
        print(f"✓ Created {expenses_created} expenses")
        
        # Commit all changes
        db.commit()
        
        print("\n" + "=" * 70)
        print("✓ Historical data seeding completed successfully!")
        print("=" * 70)
        
        # Final counts
        print("\n--- Final data counts ---")
        final_sales = db.query(Sale).filter(Sale.business_id == business.id).count()
        final_items = db.query(SaleItem).join(Sale).filter(Sale.business_id == business.id).count()
        final_expenses = db.query(Expense).filter(Expense.business_id == business.id).count()
        final_movements = db.query(StockMovement).count()
        
        print(f"  Sales: {final_sales} (new: {final_sales - existing_sales})")
        print(f"  Sale Items: {final_items} (new: {final_items - existing_items})")
        print(f"  Expenses: {final_expenses} (new: {final_expenses - existing_expenses})")
        print(f"  Stock Movements: {final_movements} (new: {final_movements - existing_movements})")
        
        # Validate
        validate_data(db, business.id)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()