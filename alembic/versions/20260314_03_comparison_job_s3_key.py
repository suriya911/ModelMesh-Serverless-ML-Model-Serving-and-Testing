"""add comparison job s3 key

Revision ID: 20260314_03
Revises: 20260314_02
Create Date: 2026-03-14 12:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260314_03"
down_revision = "20260314_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("comparison_jobs", sa.Column("dataset_s3_key", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("comparison_jobs", "dataset_s3_key")
