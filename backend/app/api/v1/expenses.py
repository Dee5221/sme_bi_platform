from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@router.get("/", response_model=List[ExpenseResponse])
def list_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Expense)
        .filter(Expense.business_id == current_user.business_id)
        .order_by(Expense.date.desc())
        .all()
    )


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"])),
):
    db_expense = Expense(
        business_id=current_user.business_id,
        user_id=current_user.id,
        **expense_in.model_dump()
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_in: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"])),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.business_id == current_user.business_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    for key, value in expense_in.model_dump(exclude_unset=True).items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Business Owner", "Manager"])),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.business_id == current_user.business_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db.delete(expense)
    db.commit()
    return