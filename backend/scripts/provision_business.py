#!/usr/bin/env python3
"""
Controlled Business Provisioning Script

Creates the initial Business and Business Owner for a fresh deployment.
This is a one-time, manual operation — NOT a public registration endpoint.

Usage:
    cd backend
    python scripts/provision_business.py

The script will prompt for required information interactively.
Alternatively, set environment variables:
    BUSINESS_NAME, BUSINESS_EMAIL,
    OWNER_FIRST_NAME, OWNER_LAST_NAME, OWNER_EMAIL, OWNER_PASSWORD
"""

import os
import sys
import getpass

# Ensure the backend root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.exc import IntegrityError
from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.business import Business
from app.models.user import User
from app.core.security import hash_password


def prompt(label: str, default: str | None = None, secret: bool = False) -> str:
    """Prompt the user for input, with optional default and secret masking."""
    suffix = f" [{default}]" if default else ""
    while True:
        if secret:
            value = getpass.getpass(f"{label}{suffix}: ")
        else:
            value = input(f"{label}{suffix}: ").strip()
        if not value and default:
            return default
        if value:
            return value
        print("  ⚠ This field is required.")


def main() -> int:
    print("=" * 60)
    print("SME Intelligence Platform — Initial Business Provisioning")
    print("=" * 60)
    print()

    # Gather configuration from env vars or interactive prompts
    business_name = os.environ.get("BUSINESS_NAME") or prompt("Business name")
    business_email = os.environ.get("BUSINESS_EMAIL") or prompt(
        "Business email (optional)", default=""
    )
    owner_first = os.environ.get("OWNER_FIRST_NAME") or prompt("Owner first name")
    owner_last = os.environ.get("OWNER_LAST_NAME") or prompt("Owner last name")
    owner_email = os.environ.get("OWNER_EMAIL") or prompt("Owner email")
    owner_password = os.environ.get("OWNER_PASSWORD") or prompt(
        "Owner password", secret=True
    )

    if len(owner_password) < 8:
        print("❌ Password must be at least 8 characters.")
        return 1

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Idempotency: check for existing business
        business = db.query(Business).filter(Business.name == business_name).first()
        if business:
            print(f"\n✓ Business '{business_name}' already exists (id={business.id}).")
        else:
            business = Business(
                name=business_name,
                email=business_email or None,
            )
            db.add(business)
            db.flush()
            print(f"\n✓ Created business '{business_name}' (id={business.id}).")

        # Idempotency: check for existing owner
        owner = (
            db.query(User)
            .filter(User.business_id == business.id, User.email == owner_email)
            .first()
        )
        if owner:
            print(f"✓ Owner '{owner_email}' already exists (id={owner.id}).")
            print("\nNothing to do. Provisioning complete.")
            return 0

        # Create the Business Owner
        owner = User(
            business_id=business.id,
            email=owner_email,
            first_name=owner_first,
            last_name=owner_last,
            hashed_password=hash_password(owner_password),
            role="Business Owner",
            status="active",
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)

        print(f"✓ Created Business Owner '{owner_email}' (id={owner.id}).")
        print(f"  Role: Business Owner")
        print(f"  Business ID: {business.id}")
        print("\n✅ Provisioning complete.")
        print(f"\nYou can now log in at /login with:")
        print(f"  Email:    {owner_email}")
        print(f"  Password: <the password you entered>")
        return 0

    except IntegrityError as e:
        db.rollback()
        print(f"\n❌ Integrity error (possible duplicate): {e.orig}")
        return 1
    except Exception as e:
        db.rollback()
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())