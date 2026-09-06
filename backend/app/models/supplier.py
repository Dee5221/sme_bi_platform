from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, CheckConstraint
from app.models.base import Base, TimestampMixin

class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name='ck_supplier_status'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(150), nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    business = relationship("Business", back_populates="suppliers")
    products = relationship("Product", back_populates="supplier")