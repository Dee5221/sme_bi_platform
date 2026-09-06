from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, UniqueConstraint, CheckConstraint
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint('business_id', 'email', name='uq_user_business_email'),
        CheckConstraint("status IN ('active', 'inactive', 'suspended')", name='ck_user_status'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    business = relationship("Business", back_populates="users")
    role = relationship("Role", back_populates="users")
    sales = relationship("Sale", back_populates="user")
    expenses = relationship("Expense", back_populates="user")
    stock_movements = relationship("StockMovement", back_populates="user")