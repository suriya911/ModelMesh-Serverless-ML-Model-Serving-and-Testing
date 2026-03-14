"""add comparison jobs table

Revision ID: 20260314_02
Revises: 20260310_01
Create Date: 2026-03-14 12:20:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260314_02"
down_revision = "20260310_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comparison_jobs",
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("dataset_name", sa.String(length=255), nullable=True),
        sa.Column("data_size", sa.Integer(), nullable=False),
        sa.Column("features", sa.Integer(), nullable=False),
        sa.Column("data_format", sa.String(length=32), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("job_id"),
    )
    op.create_index("ix_comparison_jobs_status", "comparison_jobs", ["status"], unique=False)
    op.create_index("ix_comparison_jobs_created_at", "comparison_jobs", ["created_at"], unique=False)
    op.create_index("ix_comparison_jobs_updated_at", "comparison_jobs", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_comparison_jobs_updated_at", table_name="comparison_jobs")
    op.drop_index("ix_comparison_jobs_created_at", table_name="comparison_jobs")
    op.drop_index("ix_comparison_jobs_status", table_name="comparison_jobs")
    op.drop_table("comparison_jobs")
