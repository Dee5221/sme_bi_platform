from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Numeric, UniqueConstraint, CheckConstraint
from app.models.base import Base, TimestampMixin

class Product(Base, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint('business_id', 'sku', name='uq_product_business_sku'),
        CheckConstraint("cost_price >= 0", name='ck_product_cost_price'),
        CheckConstraint("selling_price >= 0", name='ck_product_selling_price'),
        CheckConstraint("reorder_level >= 0", name='ck_product_reorder_level'),
        CheckConstraint("status IN ('active', 'inactive')", name='ck_product_status'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    
    sku: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    cost_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    selling_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reorder_level: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    business = relationship("Business", back_populates="products")
    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", uselist=False)
    sale_items = relationship("SaleItem", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product")