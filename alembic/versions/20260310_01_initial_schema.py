"""initial schema

Revision ID: 20260310_01
Revises:
Create Date: 2026-03-10 22:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260310_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "models",
        sa.Column("model_id", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("hf_repo_id", sa.String(length=255), nullable=False),
        sa.Column("task_type", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("model_id"),
    )

    op.create_table(
        "prediction_logs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("prediction_id", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("input_hash", sa.String(length=128), nullable=False),
        sa.Column("cached", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prediction_logs_prediction_id", "prediction_logs", ["prediction_id"], unique=False)
    op.create_index("ix_prediction_logs_model", "prediction_logs", ["model"], unique=False)
    op.create_index("ix_prediction_logs_timestamp", "prediction_logs", ["timestamp"], unique=False)

    op.create_table(
        "prediction_cache",
        sa.Column("cache_key", sa.String(length=200), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("cache_key"),
    )
    op.create_index("ix_prediction_cache_updated_at", "prediction_cache", ["updated_at"], unique=False)

    op.create_table(
        "runtime_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("requests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_latency", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_a_usage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_b_usage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_hits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_misses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("runtime_metrics")
    op.drop_index("ix_prediction_cache_updated_at", table_name="prediction_cache")
    op.drop_table("prediction_cache")
    op.drop_index("ix_prediction_logs_timestamp", table_name="prediction_logs")
    op.drop_index("ix_prediction_logs_model", table_name="prediction_logs")
    op.drop_index("ix_prediction_logs_prediction_id", table_name="prediction_logs")
    op.drop_table("prediction_logs")
    op.drop_table("models")
