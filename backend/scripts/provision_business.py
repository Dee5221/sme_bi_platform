#!/usr/bin/env python3
"""
Create the first business and Business Owner on a migrated database.

This is a one-time maintenance operation, not a public registration endpoint.
It is allowed in production. Demo seed scripts are not.

Usage:
    cd backend
    python scripts/provision_business.py

Environment variables (used when set; otherwise the script prompts):
    BUSINESS_NAME, BUSINESS_TYPE, BUSINESS_CONTACT, BUSINESS_ADDRESS,
    BUSINESS_EMAIL, BUSINESS_PHONE,
    OWNER_FIRST_NAME, OWNER_LAST_NAME, OWNER_EMAIL, OWNER_PASSWORD

Run `alembic upgrade head` before this script. It does not create tables.
"""
from __future__ import annotations

import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.database import SessionLocal
from app.core.permissions import ROLE_ORDER
from app.core.security import get_password_hash, validate_password_policy
from app.models.business import Business
from app.models.role import Role
from app.models.user import User

OWNER_ROLE_NAME = "Business Owner"


def prompt(label: str, default: str | None = None, secret: bool = False) -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        if secret:
            value = getpass.getpass(f"{label}{suffix}: ")
        else:
            value = input(f"{label}{suffix}: ").strip()
        if not value and default is not None:
            return default
        if value:
            return value
        print("  This field is required.")


def ensure_roles(db) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for role_name in ROLE_ORDER:
        role = db.query(Role).filter(Role.role_name == role_name).first()
        if not role:
            role = Role(role_name=role_name)
            db.add(role)
            db.flush()
            print(f"Created role '{role_name}' (id={role.id}).")
        roles[role_name] = role
    return roles


def main() -> int:
    print("=" * 60)
    print("SME Intelligence Platform — Initial Business Provisioning")
    print("=" * 60)
    print()

    business_name = os.environ.get("BUSINESS_NAME") or prompt("Business name")
    business_type = os.environ.get("BUSINESS_TYPE") or prompt("Business type", default="Retail")
    business_contact = os.environ.get("BUSINESS_CONTACT") or prompt("Business contact name")
    business_address = os.environ.get("BUSINESS_ADDRESS") or prompt("Business address")
    business_email = os.environ.get("BUSINESS_EMAIL") or prompt("Business email (optional)", default="")
    business_phone = os.environ.get("BUSINESS_PHONE") or prompt("Business phone (optional)", default="")
    owner_first = os.environ.get("OWNER_FIRST_NAME") or prompt("Owner first name")
    owner_last = os.environ.get("OWNER_LAST_NAME") or prompt("Owner last name")
    owner_email = (os.environ.get("OWNER_EMAIL") or prompt("Owner email")).strip().lower()
    owner_password = os.environ.get("OWNER_PASSWORD") or prompt("Owner password", secret=True)

    try:
        validate_password_policy(owner_password)
    except ValueError as exc:
        print(f"Password does not meet policy: {exc}")
        return 1

    owner_name = " ".join(part for part in (owner_first.strip(), owner_last.strip()) if part)
    if not owner_name:
        print("Owner name is required.")
        return 1

    db = SessionLocal()
    try:
        roles = ensure_roles(db)
        owner_role = roles[OWNER_ROLE_NAME]

        business = db.query(Business).filter(Business.name == business_name).first()
        if business:
            print(f"\nBusiness '{business_name}' already exists (id={business.id}).")
        else:
            business = Business(
                name=business_name,
                type=business_type,
                contact=business_contact,
                address=business_address,
                currency="ZMW",
                email=business_email or None,
                phone=business_phone or None,
                report_header=business_name,
                receipt_footer="Thank you for your business.",
            )
            db.add(business)
            db.flush()
            print(f"\nCreated business '{business_name}' (id={business.id}).")

        existing_email = db.query(User).filter(User.email == owner_email).first()
        if existing_email and existing_email.business_id != business.id:
            db.rollback()
            print(
                f"Email '{owner_email}' is already used in another business "
                f"(id={existing_email.business_id}). Choose a different owner email."
            )
            return 1

        owner = (
            db.query(User)
            .filter(User.business_id == business.id, User.email == owner_email)
            .first()
        )
        if owner:
            db.commit()
            print(f"Owner '{owner_email}' already exists (id={owner.id}).")
            print("Nothing to do. Provisioning complete.")
            return 0

        owner = User(
            business_id=business.id,
            role_id=owner_role.id,
            name=owner_name,
            email=owner_email,
            password_hash=get_password_hash(owner_password),
            status="active",
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)

        print(f"Created Business Owner '{owner_email}' (id={owner.id}).")
        print(f"  Name: {owner.name}")
        print(f"  Role: {OWNER_ROLE_NAME}")
        print(f"  Business ID: {business.id}")
        print("\nProvisioning complete. Sign in at /login with the owner email.")
        return 0

    except OperationalError as exc:
        db.rollback()
        print(
            "\nDatabase is not ready. Run `alembic upgrade head` from backend/, "
            "then retry this script."
        )
        print(f"Details: {exc}")
        return 1
    except IntegrityError as exc:
        db.rollback()
        print(f"\nIntegrity error (possible duplicate): {exc.orig}")
        return 1
    except Exception as exc:
        db.rollback()
        print(f"\nUnexpected error: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
