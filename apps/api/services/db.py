from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Boolean, DateTime, Integer, Text, String, create_engine, inspect, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./modelmesh.db")


connect_args = {"check_same_thread": False} if _database_url().startswith("sqlite") else {}
engine = create_engine(_database_url(), future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


class ModelRecordORM(Base):
    __tablename__ = "models"

    model_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    hf_repo_id: Mapped[str] = mapped_column(String(255), nullable=False)
    task_type: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)


class PredictionLogORM(Base):
    __tablename__ = "prediction_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prediction_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    cached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class PredictionCacheORM(Base):
    __tablename__ = "prediction_cache"

    cache_key: Mapped[str] = mapped_column(String(200), primary_key=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)


class RuntimeMetricsORM(Base):
    __tablename__ = "runtime_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_latency: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_a_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_b_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_misses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ComparisonJobORM(Base):
    __tablename__ = "comparison_jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    dataset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dataset_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    data_size: Mapped[int] = mapped_column(Integer, nullable=False)
    features: Mapped[int] = mapped_column(Integer, nullable=False)
    data_format: Mapped[str] = mapped_column(String(32), nullable=False)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def run_migrations() -> None:
    alembic_ini = Path(__file__).resolve().parents[3] / "alembic.ini"
    config = Config(str(alembic_ini))
    config.set_main_option("sqlalchemy.url", _database_url())
    db_inspector = inspect(engine)
    tables = set(db_inspector.get_table_names())
    has_alembic_version = "alembic_version" in tables
    has_legacy_schema = bool({"models", "prediction_logs"} & tables)
    has_version_row = False
    if has_alembic_version:
        with engine.connect() as connection:
            result = connection.exec_driver_sql("SELECT version_num FROM alembic_version LIMIT 1")
            has_version_row = result.first() is not None

    if (not has_alembic_version or not has_version_row) and has_legacy_schema:
        init_db()
        command.stamp(config, "head")
        return

    command.upgrade(config, "head")


@contextmanager
def session_scope() -> Session:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def model_exists(session: Session, model_id: str) -> bool:
    return session.get(ModelRecordORM, model_id) is not None


def query_models(session: Session) -> list[ModelRecordORM]:
    return list(session.scalars(select(ModelRecordORM).order_by(ModelRecordORM.model_id)))


def query_logs(session: Session, limit: int = 20) -> list[PredictionLogORM]:
    stmt = select(PredictionLogORM).order_by(PredictionLogORM.timestamp.desc()).limit(limit)
    return list(session.scalars(stmt))


def get_cached_prediction(session: Session, cache_key: str) -> PredictionCacheORM | None:
    return session.get(PredictionCacheORM, cache_key)


def upsert_cached_prediction(session: Session, cache_key: str, payload_json: str, updated_at: datetime) -> None:
    row = session.get(PredictionCacheORM, cache_key)
    if row is None:
        session.add(PredictionCacheORM(cache_key=cache_key, payload_json=payload_json, updated_at=updated_at))
        return
    row.payload_json = payload_json
    row.updated_at = updated_at


def get_runtime_metrics_row(session: Session) -> RuntimeMetricsORM:
    row = session.get(RuntimeMetricsORM, 1)
    if row is None:
        row = RuntimeMetricsORM(id=1)
        session.add(row)
        session.flush()
    return row


def get_comparison_job(session: Session, job_id: str) -> ComparisonJobORM | None:
    return session.get(ComparisonJobORM, job_id)


def list_comparison_jobs(session: Session, limit: int = 20) -> list[ComparisonJobORM]:
    stmt = select(ComparisonJobORM).order_by(ComparisonJobORM.created_at.desc()).limit(limit)
    return list(session.scalars(stmt))
