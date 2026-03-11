from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any

from shared.schemas.contracts import PredictionResult, SystemMetrics

from apps.api.services.db import (
    get_cached_prediction,
    get_runtime_metrics_row,
    session_scope,
    upsert_cached_prediction,
)

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency import guard
    Redis = None  # type: ignore[assignment]


class RuntimeStateStore:
    def __init__(self) -> None:
        self._redis = self._build_redis_client()

    def get_cached_prediction(self, cache_key: str) -> PredictionResult | None:
        payload: str | None = None
        if self._redis is not None:
            try:
                payload = self._redis.get(f"cache:{cache_key}")
            except Exception:
                payload = None

        if payload:
            return PredictionResult.model_validate_json(payload)

        with session_scope() as session:
            row = get_cached_prediction(session, cache_key)
            if row is None:
                return None
            return PredictionResult.model_validate_json(row.payload_json)

    def set_cached_prediction(self, cache_key: str, prediction: PredictionResult) -> None:
        payload = prediction.model_dump_json()
        if self._redis is not None:
            try:
                self._redis.set(f"cache:{cache_key}", payload)
            except Exception:
                pass

        with session_scope() as session:
            upsert_cached_prediction(session, cache_key, payload, datetime.now(UTC).replace(tzinfo=None))

    def record_prediction(self, model_id: str, latency_ms: int, cached: bool, success: bool = True) -> None:
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline()
                pipe.hincrby("metrics", "requests", 1)
                pipe.hincrby("metrics", "total_latency", max(latency_ms, 0))
                if model_id == "model_a":
                    pipe.hincrby("metrics", "model_a_usage", 1)
                elif model_id == "model_b":
                    pipe.hincrby("metrics", "model_b_usage", 1)
                if cached:
                    pipe.hincrby("metrics", "cache_hits", 1)
                else:
                    pipe.hincrby("metrics", "cache_misses", 1)
                if success:
                    pipe.hincrby("metrics", "success_count", 1)
                else:
                    pipe.hincrby("metrics", "error_count", 1)
                pipe.execute()
            except Exception:
                pass

        with session_scope() as session:
            row = get_runtime_metrics_row(session)
            row.requests += 1
            row.total_latency += max(latency_ms, 0)
            if model_id == "model_a":
                row.model_a_usage += 1
            elif model_id == "model_b":
                row.model_b_usage += 1
            if cached:
                row.cache_hits += 1
            else:
                row.cache_misses += 1
            if success:
                row.success_count += 1
            else:
                row.error_count += 1

    def get_metrics(self) -> SystemMetrics:
        redis_metrics = self._read_redis_metrics()
        if redis_metrics is not None:
            return redis_metrics

        with session_scope() as session:
            row = get_runtime_metrics_row(session)
            return self._to_system_metrics(
                {
                    "requests": row.requests,
                    "total_latency": row.total_latency,
                    "model_a_usage": row.model_a_usage,
                    "model_b_usage": row.model_b_usage,
                    "cache_hits": row.cache_hits,
                    "cache_misses": row.cache_misses,
                    "success_count": row.success_count,
                    "error_count": row.error_count,
                }
            )

    def _read_redis_metrics(self) -> SystemMetrics | None:
        if self._redis is None:
            return None
        try:
            raw = self._redis.hgetall("metrics")
        except Exception:
            return None
        if not raw:
            return None

        normalized: dict[str, int] = {}
        for key, value in raw.items():
            normalized[self._decode(key)] = int(self._decode(value))
        return self._to_system_metrics(normalized)

    @staticmethod
    def _decode(value: Any) -> str:
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return str(value)

    @staticmethod
    def _to_system_metrics(values: dict[str, int]) -> SystemMetrics:
        requests = values.get("requests", 0)
        total_latency = values.get("total_latency", 0)
        success_count = values.get("success_count", 0)
        error_count = values.get("error_count", 0)
        total_outcomes = success_count + error_count
        success_rate = 100.0 if total_outcomes == 0 else round((success_count / total_outcomes) * 100, 2)

        return SystemMetrics(
            requests=requests,
            avg_latency=round(total_latency / requests) if requests else 0,
            model_a_usage=values.get("model_a_usage", 0),
            model_b_usage=values.get("model_b_usage", 0),
            cache_hits=values.get("cache_hits", 0),
            cache_misses=values.get("cache_misses", 0),
            success_rate=success_rate,
        )

    @staticmethod
    def _build_redis_client() -> Redis | None:  # type: ignore[name-defined]
        redis_url = (os.getenv("REDIS_URL") or "").strip()
        if not redis_url or Redis is None:
            return None
        try:
            client = Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            return client
        except Exception:
            return None
