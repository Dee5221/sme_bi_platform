from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String
from app.models.base import Base, TimestampMixin

class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    contact: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")

    # Relationships
    users = relationship("User", back_populates="business")
    categories = relationship("Category", back_populates="business")
    products = relationship("Product", back_populates="business")
    customers = relationship("Customer", back_populates="business")
    suppliers = relationship("Supplier", back_populates="business")
    sales = relationship("Sale", back_populates="business")
    expenses = relationship("Expense", back_populates="business")