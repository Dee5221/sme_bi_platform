import sys
from pathlib import Path

# Add the backend directory to the Python path so the script can find the 'app' module
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.business import Business
from app.models.role import Role
from app.models.user import User
from app.core.security import get_password_hash

def seed_database():
    db: Session = SessionLocal()
    try:
        print("Starting database seeding...\n")

        # 1. Seed Roles
        roles_to_seed = ["Business Owner", "Manager", "Staff"]
        roles_map = {}
        
        for role_name in roles_to_seed:
            role = db.query(Role).filter(Role.role_name == role_name).first()
            if not role:
                role = Role(role_name=role_name)
                db.add(role)
                db.flush()  # Flush to get the auto-generated ID
                print(f"[CREATED] Role: {role_name}")
            else:
                print(f"[EXISTS] Role already exists: {role_name}")
            roles_map[role_name] = role.id
            
        # 2. Seed Business
        business = db.query(Business).first()
        if not business:
            business = Business(
                name="Lusaka Wholesale & Retail",
                type="Retail",
                contact="Kondwani Banda",
                address="Plot 1010, Great East Road, Lusaka",
                currency="ZMW"
            )
            db.add(business)
            db.flush()
            print(f"[CREATED] Business: {business.name}")
        else:
            print(f"[EXISTS] Business already exists: {business.name}")
            
        # 3. Seed Users
        users_to_seed = [
            {
                "name": "Kondwani Banda",
                "email": "owner@lusakawholesale.zm",
                "password": "OwnerPass123!",
                "role_name": "Business Owner"
            },
            {
                "name": "Mutale Tembo",
                "email": "manager@lusakawholesale.zm",
                "password": "ManagerPass123!",
                "role_name": "Manager"
            },
            {
                "name": "Chileshe Phiri",
                "email": "staff@lusakawholesale.zm",
                "password": "StaffPass123!",
                "role_name": "Staff"
            }
        ]
        
        for user_data in users_to_seed:
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing_user:
                new_user = User(
                    business_id=business.id,
                    role_id=roles_map[user_data["role_name"]],
                    name=user_data["name"],
                    email=user_data["email"],
                    password_hash=get_password_hash(user_data["password"]),
                    status="active"
                )
                db.add(new_user)
                print(f"[CREATED] User: {user_data['email']} (Role: {user_data['role_name']})")
            else:
                print(f"[EXISTS] User already exists: {user_data['email']}")
                
        # Commit all changes
        db.commit()
        print("\nDatabase seeded successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()