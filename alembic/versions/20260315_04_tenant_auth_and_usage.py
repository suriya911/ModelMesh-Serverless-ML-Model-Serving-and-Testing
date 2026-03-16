"""Add tenant ownership and usage tracking.

Revision ID: 20260315_04
Revises: 20260314_03
Create Date: 2026-03-15
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260315_04"
down_revision = "20260314_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("comparison_jobs") as batch_op:
        batch_op.add_column(sa.Column("tenant_id", sa.String(length=64), nullable=False, server_default="demo"))
        batch_op.create_index("ix_comparison_jobs_tenant_id", ["tenant_id"], unique=False)

    op.create_table(
        "tenant_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("usage_date", sa.String(length=10), nullable=False),
        sa.Column("predictions_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comparisons_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploads_used", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "usage_date", name="uq_tenant_usage_day"),
    )
    op.create_index("ix_tenant_usage_tenant_id", "tenant_usage", ["tenant_id"], unique=False)
    op.create_index("ix_tenant_usage_usage_date", "tenant_usage", ["usage_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tenant_usage_usage_date", table_name="tenant_usage")
    op.drop_index("ix_tenant_usage_tenant_id", table_name="tenant_usage")
    op.drop_table("tenant_usage")

    with op.batch_alter_table("comparison_jobs") as batch_op:
        batch_op.drop_index("ix_comparison_jobs_tenant_id")
        batch_op.drop_column("tenant_id")
