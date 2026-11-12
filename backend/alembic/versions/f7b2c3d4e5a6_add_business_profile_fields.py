"""add business email phone report header and receipt footer

Revision ID: f7b2c3d4e5a6
Revises: e8a1c2b3d4f5
Create Date: 2026-11-05 17:49:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7b2c3d4e5a6"
down_revision: Union[str, None] = "e8a1c2b3d4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("email", sa.String(length=150), nullable=True))
    op.add_column("businesses", sa.Column("phone", sa.String(length=50), nullable=True))
    op.add_column("businesses", sa.Column("report_header", sa.String(length=150), nullable=True))
    op.add_column("businesses", sa.Column("receipt_footer", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("businesses", "receipt_footer")
    op.drop_column("businesses", "report_header")
    op.drop_column("businesses", "phone")
    op.drop_column("businesses", "email")
