from __future__ import annotations

from datetime import datetime

from apps.api.services.db import PredictionLogORM, query_logs, session_scope
from shared.schemas.contracts import LogEntry


def create_log(entry: LogEntry) -> None:
    with session_scope() as session:
        session.add(
            PredictionLogORM(
                id=entry.id,
                prediction_id=entry.prediction_id,
                model=entry.model,
                latency_ms=entry.latency_ms,
                timestamp=datetime.fromisoformat(entry.timestamp),
                status=entry.status,
                input_hash=entry.input_hash,
                cached=entry.cached,
            )
        )


def list_logs(limit: int = 20) -> list[LogEntry]:
    with session_scope() as session:
        return [
            LogEntry(
                id=row.id,
                prediction_id=row.prediction_id,
                model=row.model,
                latency_ms=row.latency_ms,
                timestamp=row.timestamp.isoformat(),
                status=row.status,
                input_hash=row.input_hash,
                cached=row.cached,
            )
            for row in query_logs(session, limit=limit)
        ]
