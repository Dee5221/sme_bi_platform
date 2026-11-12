"""snapshot sale item name sku and unit cost

Revision ID: c4f91e2a8b70
Revises: d3d68065b033
Create Date: 2026-11-05 17:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f91e2a8b70"
down_revision: Union[str, None] = "d3d68065b033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sale_items", sa.Column("product_name", sa.String(length=150), nullable=True))
    op.add_column("sale_items", sa.Column("sku", sa.String(length=50), nullable=True))
    op.add_column("sale_items", sa.Column("unit_cost", sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column("sale_items", "unit_cost")
    op.drop_column("sale_items", "sku")
    op.drop_column("sale_items", "product_name")
