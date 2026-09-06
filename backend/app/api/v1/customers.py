from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get("/", response_model=list[CustomerResponse])
def list_customers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Customer).filter(Customer.business_id == current_user.business_id).all()

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate, 
    db: Session = Depends(get_db), 
    # Staff CAN create customers per the permission matrix
    current_user: User = Depends(require_role(["Business Owner", "Manager", "Staff"]))
):
    new_customer = Customer(business_id=current_user.business_id, **customer_in.model_dump())
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int, 
    customer_in: CustomerUpdate, 
    db: Session = Depends(get_db), 
    # Staff CANNOT update customers
    current_user: User = Depends(require_role(["Business Owner", "Manager"]))
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.business_id == current_user.business_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    for field, value in customer_in.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
        
    db.commit()
    db.refresh(customer)
    return customer