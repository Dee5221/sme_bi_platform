#!/usr/bin/env python3
"""
DATA-01: Seed realistic SME retail dataset for development and testing.

Creates:
- 10 product categories
- 40 products with realistic pricing (ZMW)
- 40 customers (mix of retail/wholesale/business)
- 12 suppliers
- Opening inventory for all active products

Idempotent - safe to run multiple times without duplicates.
"""

import sys
import os
import random
from decimal import Decimal
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import (
    Business, Category, Product, Customer, Supplier,
    Inventory, User, StockMovement
)

# ============================================================================
# DATASET DEFINITIONS
# ============================================================================

CATEGORIES = [
    "Beef", "Chicken", "Pork", "Processed Meat", "Sausages",
    "Offals", "Frozen Products", "Groceries", "Beverages", "Dairy"
]

# Format: (name, sku, category_index, cost_price, selling_price, reorder_level)
# Prices in Zambian Kwacha (ZMW)
PRODUCTS = [
    # Beef (category 0)
    ("Beef Mince 500g", "BEEF-001", 0, Decimal("45.00"), Decimal("65.00"), Decimal("10.00")),
    ("Beef Steak 1kg", "BEEF-002", 0, Decimal("85.00"), Decimal("120.00"), Decimal("8.00")),
    ("Beef Ribs 1kg", "BEEF-003", 0, Decimal("60.00"), Decimal("85.00"), Decimal("12.00")),
    ("Beef Liver 500g", "BEEF-004", 0, Decimal("25.00"), Decimal("40.00"), Decimal("15.00")),

    # Chicken (category 1)
    ("Whole Chicken 1.5kg", "CHK-001", 1, Decimal("55.00"), Decimal("78.00"), Decimal("20.00")),
    ("Chicken Breast 1kg", "CHK-002", 1, Decimal("70.00"), Decimal("95.00"), Decimal("15.00")),
    ("Chicken Wings 1kg", "CHK-003", 1, Decimal("45.00"), Decimal("65.00"), Decimal("25.00")),
    ("Chicken Drumsticks 1kg", "CHK-004", 1, Decimal("50.00"), Decimal("72.00"), Decimal("18.00")),

    # Pork (category 2)
    ("Pork Chops 1kg", "PORK-001", 2, Decimal("65.00"), Decimal("90.00"), Decimal("10.00")),
    ("Pork Mince 500g", "PORK-002", 2, Decimal("40.00"), Decimal("58.00"), Decimal("12.00")),
    ("Pork Ribs 1kg", "PORK-003", 2, Decimal("70.00"), Decimal("98.00"), Decimal("8.00")),

    # Processed Meat (category 3)
    ("Bacon 250g", "PROC-001", 3, Decimal("35.00"), Decimal("52.00"), Decimal("20.00")),
    ("Ham Slices 200g", "PROC-002", 3, Decimal("30.00"), Decimal("45.00"), Decimal("25.00")),
    ("Salami 150g", "PROC-003", 3, Decimal("28.00"), Decimal("42.00"), Decimal("18.00")),

    # Sausages (category 4)
    ("Pork Sausages 500g", "SAUS-001", 4, Decimal("32.00"), Decimal("48.00"), Decimal("22.00")),
    ("Beef Sausages 500g", "SAUS-002", 4, Decimal("38.00"), Decimal("55.00"), Decimal("20.00")),
    ("Chicken Sausages 500g", "SAUS-003", 4, Decimal("30.00"), Decimal("45.00"), Decimal("25.00")),
    ("Vienna Sausages 400g", "SAUS-004", 4, Decimal("25.00"), Decimal("38.00"), Decimal("30.00")),

    # Offals (category 5)
    ("Tripe 500g", "OFF-001", 5, Decimal("18.00"), Decimal("30.00"), Decimal("15.00")),
    ("Chicken Feet 1kg", "OFF-002", 5, Decimal("15.00"), Decimal("25.00"), Decimal("20.00")),
    ("Beef Heart 500g", "OFF-003", 5, Decimal("22.00"), Decimal("35.00"), Decimal("12.00")),

    # Frozen Products (category 6)
    ("Frozen Chips 1kg", "FRZ-001", 6, Decimal("20.00"), Decimal("32.00"), Decimal("30.00")),
    ("Frozen Vegetables 500g", "FRZ-002", 6, Decimal("18.00"), Decimal("28.00"), Decimal("25.00")),
    ("Frozen Fish Fillets 500g", "FRZ-003", 6, Decimal("45.00"), Decimal("68.00"), Decimal("15.00")),
    ("Ice Cream 1L", "FRZ-004", 6, Decimal("35.00"), Decimal("55.00"), Decimal("20.00")),

    # Groceries (category 7)
    ("Rice 5kg", "GROC-001", 7, Decimal("45.00"), Decimal("65.00"), Decimal("25.00")),
    ("Maize Meal 10kg", "GROC-002", 7, Decimal("55.00"), Decimal("78.00"), Decimal("20.00")),
    ("Cooking Oil 2L", "GROC-003", 7, Decimal("38.00"), Decimal("55.00"), Decimal("30.00")),
    ("Sugar 2kg", "GROC-004", 7, Decimal("22.00"), Decimal("32.00"), Decimal("35.00")),
    ("Salt 1kg", "GROC-005", 7, Decimal("8.00"), Decimal("15.00"), Decimal("40.00")),

    # Beverages (category 8)
    ("Maheu 1L", "BEV-001", 8, Decimal("12.00"), Decimal("18.00"), Decimal("40.00")),
    ("Coca-Cola 2L", "BEV-002", 8, Decimal("15.00"), Decimal("22.00"), Decimal("35.00")),
    ("Fanta 2L", "BEV-003", 8, Decimal("15.00"), Decimal("22.00"), Decimal("35.00")),
    ("Water 1.5L 6-pack", "BEV-004", 8, Decimal("18.00"), Decimal("28.00"), Decimal("30.00")),
    ("Juice 1L", "BEV-005", 8, Decimal("20.00"), Decimal("30.00"), Decimal("25.00")),

    # Dairy (category 9)
    ("Fresh Milk 1L", "DAIRY-001", 9, Decimal("14.00"), Decimal("22.00"), Decimal("30.00")),
    ("Long Life Milk 1L", "DAIRY-002", 9, Decimal("16.00"), Decimal("24.00"), Decimal("28.00")),
    ("Yoghurt 500ml", "DAIRY-003", 9, Decimal("18.00"), Decimal("28.00"), Decimal("25.00")),
    ("Cheese 200g", "DAIRY-004", 9, Decimal("25.00"), Decimal("38.00"), Decimal("20.00")),
    ("Butter 250g", "DAIRY-005", 9, Decimal("22.00"), Decimal("35.00"), Decimal("22.00")),
]

# Format: (name, phone, email, address, type)
CUSTOMERS = [
    # Retail customers (25)
    ("Mary Banda", "+260971234001", "mary.banda@email.com", "Plot 123, Lusaka", "retail"),
    ("John Phiri", "+260971234002", "john.phiri@email.com", "Plot 456, Lusaka", "retail"),
    ("Grace Mwale", "+260971234003", "grace.mwale@email.com", "Plot 789, Lusaka", "retail"),
    ("Peter Chanda", "+260971234004", "peter.chanda@email.com", "Plot 101, Lusaka", "retail"),
    ("Susan Tembo", "+260971234005", "susan.tembo@email.com", "Plot 202, Lusaka", "retail"),
    ("David Mulenga", "+260971234006", "david.mulenga@email.com", "Plot 303, Lusaka", "retail"),
    ("Esther Ng'andu", "+260971234007", "esther.ngandu@email.com", "Plot 404, Lusaka", "retail"),
    ("Michael Zulu", "+260971234008", "michael.zulu@email.com", "Plot 505, Lusaka", "retail"),
    ("Ruth Mwanza", "+260971234009", "ruth.mwanza@email.com", "Plot 606, Lusaka", "retail"),
    ("James Kapila", "+260971234010", "james.kapila@email.com", "Plot 707, Lusaka", "retail"),
    ("Agnes Musonda", "+260971234021", "agnes.musonda@email.com", "Plot 808, Lusaka", "retail"),
    ("Brian Sinkamba", "+260971234022", "brian.sinkamba@email.com", "Plot 909, Lusaka", "retail"),
    ("Catherine Mumba", "+260971234023", "catherine.mumba@email.com", "Plot 111, Lusaka", "retail"),
    ("Daniel Chilufya", "+260971234024", "daniel.chilufya@email.com", "Plot 222, Lusaka", "retail"),
    ("Emily Mwansa", "+260971234025", "emily.mwansa@email.com", "Plot 333, Lusaka", "retail"),
    ("Frank Lubinda", "+260971234026", "frank.lubinda@email.com", "Plot 444, Lusaka", "retail"),
    ("Helen Nkonde", "+260971234027", "helen.nkonde@email.com", "Plot 555, Lusaka", "retail"),
    ("Isaac Mutale", "+260971234028", "isaac.mutale@email.com", "Plot 666, Lusaka", "retail"),
    ("Joyce Sakala", "+260971234029", "joyce.sakala@email.com", "Plot 777, Lusaka", "retail"),
    ("Kennedy Bwalya", "+260971234030", "kennedy.bwalya@email.com", "Plot 888, Lusaka", "retail"),
    ("Linda Moyo", "+260971234036", "linda.moyo@email.com", "Plot 999, Lusaka", "retail"),
    ("Martin Soko", "+260971234037", "martin.soko@email.com", "Plot 121, Lusaka", "retail"),
    ("Nancy Mwape", "+260971234038", "nancy.mwape@email.com", "Plot 232, Lusaka", "retail"),
    ("Oscar Lungu", "+260971234039", "oscar.lungu@email.com", "Plot 343, Lusaka", "retail"),
    ("Patricia Hampa", "+260971234040", "patricia.hampa@email.com", "Plot 454, Lusaka", "retail"),

    # Wholesale customers (7)
    ("K&M Trading Ltd", "+260971234011", "km.trading@business.com", "Market Plaza, Lusaka", "wholesale"),
    ("Fresh Foods Distributors", "+260971234012", "fresh.foods@business.com", "Industrial Area, Lusaka", "wholesale"),
    ("City Meat Wholesalers", "+260971234013", "city.meat@business.com", "Wholesale Park, Lusaka", "wholesale"),
    ("Provision Store Ltd", "+260971234014", "provision.store@business.com", "Town Centre, Lusaka", "wholesale"),
    ("Mega Mart Zambia", "+260971234015", "megamart@business.com", "Mega Mall, Lusaka", "wholesale"),
    ("Northern Supplies Ltd", "+260971234031", "northern.supplies@business.com", "Ndola", "wholesale"),
    ("Copperbelt Distributors", "+260971234032", "copperbelt.dist@business.com", "Kitwe", "wholesale"),

    # Business customers (8)
    ("Zambezi Restaurant", "+260971234016", "zambezi.rest@business.com", "River Road, Lusaka", "business"),
    ("Lusaka Hotel", "+260971234017", "purchasing@lusakahotel.com", "Great East Road, Lusaka", "business"),
    ("City Cafe", "+260971234018", "citycafe@business.com", "Cairo Road, Lusaka", "business"),
    ("Golden Grill Restaurant", "+260971234019", "golden.grill@business.com", "Arcades, Lusaka", "business"),
    ("Sunset Lodge", "+260971234020", "sunset.lodge@business.com", "Leopards Hill Road, Lusaka", "business"),
    ("University Canteen", "+260971234033", "canteen@university.edu.zm", "University Campus, Lusaka", "business"),
    ("Hospital Kitchen", "+260971234034", "kitchen@hospital.org.zm", "Hospital Road, Lusaka", "business"),
    ("Corporate Catering Services", "+260971234035", "corp.catering@business.com", "Business Park, Lusaka", "business"),
]

# Format: (name, contact_person, phone, email, address)
SUPPLIERS = [
    ("Zambia Meat Packers Ltd", "Mr. Thompson", "+260971235001", "sales@zambiameat.co.zm", "Industrial Area, Lusaka"),
    ("Fresh Poultry Farms", "Mrs. Banda", "+260971235002", "orders@freshpoultry.co.zm", "Farm Road, Lusaka"),
    ("Copperbelt Meat Processors", "Mr. Chilufya", "+260971235003", "copperbelt.meat@co.zm", "Ndola"),
    ("National Grocers Distributors", "Mrs. Mwale", "+260971235004", "national.groc@co.zm", "Market Plaza, Lusaka"),
    ("Zambezi Beverages Ltd", "Mr. Phiri", "+260971235005", "zambezi.bev@co.zm", "Brewery Road, Lusaka"),
    ("Dairy Products Zambia", "Mrs. Tembo", "+260971235006", "dairy.zambia@co.zm", "Dairy Farm, Lusaka"),
    ("Frozen Foods International", "Mr. Mulenga", "+260971235007", "frozen.intl@co.zm", "Cold Storage, Lusaka"),
    ("Packaging Solutions Ltd", "Mrs. Ng'andu", "+260971235008", "packaging.sol@co.zm", "Industrial Area, Lusaka"),
    ("Cleaning Supplies Zambia", "Mr. Zulu", "+260971235009", "cleaning.zm@co.zm", "Chemical Road, Lusaka"),
    ("Office Supplies Direct", "Mrs. Mwanza", "+260971235010", "office.direct@co.zm", "Business Park, Lusaka"),
    ("Transport & Logistics Ltd", "Mr. Kapila", "+260971235011", "transport.log@co.zm", "Transport Hub, Lusaka"),
    ("Quality Assurance Services", "Mrs. Musonda", "+260971235012", "qa.services@co.zm", "Lab Road, Lusaka"),
]

# ============================================================================
# SEEDING FUNCTIONS
# ============================================================================

def seed_categories(db: Session, business_id: int) -> list:
    """Create categories if they don't exist."""
    categories = []
    for name in CATEGORIES:
        existing = db.query(Category).filter(
            Category.business_id == business_id,
            Category.name == name
        ).first()

        if existing:
            categories.append(existing)
        else:
            category = Category(
                business_id=business_id,
                name=name,
                status="active"
            )
            db.add(category)
            categories.append(category)

    db.flush()
    return categories


def seed_suppliers(db: Session, business_id: int) -> list:
    """Create suppliers if they don't exist."""
    suppliers = []
    for name, contact, phone, email, address in SUPPLIERS:
        existing = db.query(Supplier).filter(
            Supplier.business_id == business_id,
            Supplier.name == name
        ).first()

        if existing:
            suppliers.append(existing)
        else:
            supplier = Supplier(
                business_id=business_id,
                name=name,
                contact=contact,
                phone=phone,
                email=email,
                address=address,
                status="active"
            )
            db.add(supplier)
            suppliers.append(supplier)

    db.flush()
    return suppliers


def seed_products(db: Session, business_id: int, categories: list, suppliers: list) -> list:
    """Create products if they don't exist."""
    products = []

    # Map product categories to suppliers
    supplier_map = {
        0: 0, 1: 1, 2: 2, 3: 2, 4: 2, 5: 2,  # Meat categories
        6: 6,   # Frozen -> Frozen Foods
        7: 3,   # Groceries -> National Grocers
        8: 4,   # Beverages -> Zambezi Beverages
        9: 5    # Dairy -> Dairy Products
    }

    for name, sku, cat_idx, cost, sell, reorder in PRODUCTS:
        existing = db.query(Product).filter(
            Product.business_id == business_id,
            Product.sku == sku
        ).first()

        if existing:
            products.append(existing)
        else:
            supplier_idx = supplier_map.get(cat_idx, 0)
            supplier = suppliers[supplier_idx] if supplier_idx < len(suppliers) else None

            product = Product(
                business_id=business_id,
                category_id=categories[cat_idx].id,
                supplier_id=supplier.id if supplier else None,
                sku=sku,
                name=name,
                cost_price=cost,
                selling_price=sell,
                reorder_level=reorder,
                status="active"
            )
            db.add(product)
            products.append(product)

    db.flush()
    return products


def seed_inventory(db: Session, products: list, user_id: int):
    """Create inventory records with varied stock levels."""
    for product in products:
        existing = db.query(Inventory).filter(Inventory.product_id == product.id).first()

        if existing:
            continue

        # Vary stock levels for realistic distribution
        rand = random.random()
        if rand < 0.2:  # 20% high stock
            quantity = Decimal(str(random.randint(50, 100)))
        elif rand < 0.5:  # 30% medium stock
            quantity = Decimal(str(random.randint(25, 49)))
        elif rand < 0.8:  # 30% low stock
            quantity = Decimal(str(random.randint(10, 24)))
        else:  # 20% near reorder level
            quantity = product.reorder_level + Decimal(str(random.randint(0, 5)))

        inventory = Inventory(
            product_id=product.id,
            quantity_on_hand=quantity,
            updated_at=datetime.now()
        )
        db.add(inventory)

        movement = StockMovement(
            product_id=product.id,
            user_id=user_id,
            movement_type="IN",
            quantity=quantity,
            reference="INITIAL-SEED",
            reason="Initial inventory seeding"
        )
        db.add(movement)


def seed_customers(db: Session, business_id: int):
    """Create customers if they don't exist."""
    for name, phone, email, address, cust_type in CUSTOMERS:
        existing = db.query(Customer).filter(
            Customer.business_id == business_id,
            Customer.name == name
        ).first()

        if existing:
            continue

        customer = Customer(
            business_id=business_id,
            name=name,
            phone=phone,
            email=email,
            address=address,
            type=cust_type
        )
        db.add(customer)


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("DATA-01: Seeding SME Retail Dataset")
    print("=" * 70)

    db = SessionLocal()

    try:
        # Find the existing business
        business = db.query(Business).first()

        if not business:
            print("\n❌ Error: No business found!")
            print("Please run seed_db.py first to create the business and users.")
            return

        print(f"\n✓ Using business: {business.name} (ID: {business.id})")

        # Find a user for stock movements
        user = db.query(User).filter(User.business_id == business.id).first()
        if not user:
            print("\n❌ Error: No user found for this business!")
            return

        print(f"✓ Using user: {user.name} (ID: {user.id})")

        # Seed data
        print("\n--- Seeding categories ---")
        categories = seed_categories(db, business.id)
        print(f"✓ Created/verified {len(categories)} categories")

        print("\n--- Seeding suppliers ---")
        suppliers = seed_suppliers(db, business.id)
        print(f"✓ Created/verified {len(suppliers)} suppliers")

        print("\n--- Seeding products ---")
        products = seed_products(db, business.id, categories, suppliers)
        print(f"✓ Created/verified {len(products)} products")

        print("\n--- Seeding inventory ---")
        seed_inventory(db, products, user.id)
        print(f"✓ Created inventory for {len(products)} products")

        print("\n--- Seeding customers ---")
        seed_customers(db, business.id)
        print(f"✓ Created/verified {len(CUSTOMERS)} customers")

        db.commit()

        print("\n" + "=" * 70)
        print("✓ Seeding completed successfully!")
        print("=" * 70)

        # Print summary
        print("\nFinal dataset:")
        print(f"  Categories: {len(categories)}")
        print(f"  Products:   {len(products)}")
        print(f"  Customers:  {len(CUSTOMERS)}")
        print(f"  Suppliers:  {len(suppliers)}")
        print(f"  Inventory:  {len(products)} records")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()