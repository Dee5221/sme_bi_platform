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

    def __repr__(self) -> str:
        return (
            f"User(id={self.id}, business_id={self.business_id}, role_id={self.role_id}, "
            f"name={self.name!r}, email={self.email!r}, status={self.status!r})"
        )

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "business_id": self.business_id,
            "role_id": self.role_id,
            "name": self.name,
            "email": self.email,
            "status": self.status,
        }

        if hasattr(self, "created_at"):
            data["created_at"] = self.created_at
        if hasattr(self, "updated_at"):
            data["updated_at"] = self.updated_at

        return data

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        instance = cls()
        for field in ("business_id", "role_id", "name", "email", "password_hash", "status"):
            if field in data:
                setattr(instance, field, data[field])
        return instance

    business = relationship("Business", back_populates="users")
    role = relationship("Role", back_populates="users")
    sales = relationship("Sale", back_populates="user")
    expenses = relationship("Expense", back_populates="user")
    stock_movements = relationship("StockMovement", back_populates="user")