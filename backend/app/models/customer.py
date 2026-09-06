from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey
from app.models.base import Base, TimestampMixin

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(150), nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=True) # e.g., 'retail', 'wholesale'

    business = relationship("Business", back_populates="customers")
    sales = relationship("Sale", back_populates="customer")