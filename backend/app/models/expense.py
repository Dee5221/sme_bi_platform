from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Numeric, Date, CheckConstraint
from datetime import date
from app.models.base import Base, TimestampMixin

class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount >= 0", name='ck_expense_amount'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)

    business = relationship("Business", back_populates="expenses")
    user = relationship("User", back_populates="expenses")