from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Numeric, DateTime, CheckConstraint, UniqueConstraint
from datetime import datetime
from app.models.base import Base, TimestampMixin

class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint('product_id', name='uq_inventory_product'),
        CheckConstraint("quantity_on_hand >= 0", name='ck_inventory_quantity'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity_on_hand: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    product = relationship("Product", back_populates="inventory")

class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('IN', 'OUT', 'ADJUSTMENT')", name='ck_movement_type'),
        CheckConstraint("quantity >= 0", name='ck_movement_quantity'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reference: Mapped[str] = mapped_column(String(100), nullable=True) # e.g., Sale ID, PO ID
    reason: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    product = relationship("Product", back_populates="stock_movements")
    user = relationship("User", back_populates="stock_movements")