from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, UniqueConstraint, CheckConstraint
from app.models.base import Base, TimestampMixin

class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint('business_id', 'name', name='uq_category_business_name'),
        CheckConstraint("status IN ('active', 'inactive')", name='ck_category_status'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    business = relationship("Business", back_populates="categories")
    products = relationship("Product", back_populates="category")