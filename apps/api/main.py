from __future__ import annotations

import os
from datetime import UTC, datetime
from random import Random
from time import perf_counter
from typing import Dict, List
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from apps.api.services.db import init_db
from apps.api.services.huggingface_inference import (
    HuggingFaceInferenceClient,
    HuggingFaceInferenceError,
)
from apps.api.services.model_registry import (
    get_model,
    list_models as list_registered_models,
    seed_models,
)
from apps.api.services.prediction_logs import create_log, list_logs as list_persisted_logs

from shared.schemas.contracts import (
    ComparisonJob,
    ComparisonJobCreateRequest,
    ComparisonResult,
    DatasetInfo,
    LogEntry,
    ModelMetrics,
    ModelRecord,
    PredictionRequest,
    PredictionResult,
    SystemMetrics,
)

load_dotenv()


def _allowed_origins() -> list[str]:
    raw = (os.getenv("ALLOWED_ORIGINS") or "*").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="ModelMesh API",
    version="0.1.0",
    description="Phase 0 scaffold for ModelMesh backend contracts.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: Dict[str, PredictionResult] = {}
_comparisons: Dict[str, ComparisonJob] = {}
_metrics = SystemMetrics(
    requests=0,
    avg_latency=0,
    model_a_usage=0,
    model_b_usage=0,
    cache_hits=0,
    cache_misses=0,
    success_rate=100.0,
)
_total_latency = 0
_inference_client = HuggingFaceInferenceClient()


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _hash_input(value: str) -> str:
    hash_value = 0
    for char in value:
        hash_value = ((hash_value << 5) - hash_value) + ord(char)
        hash_value &= 0xFFFFFFFF
    return f"{hash_value:x}"


def _build_comparison_result(data_size: int, features: int, data_format: str) -> ComparisonResult:
    seed = data_size * 7 + features * 13
    rng = Random(seed)

    a_tp = round(data_size * 0.3 * (0.85 + rng.random() * 0.1))
    a_fp = round(data_size * 0.3 * (0.05 + rng.random() * 0.08))
    a_fn = round(data_size * 0.3 * (0.08 + rng.random() * 0.07))
    a_tn = round(data_size * 0.3) - a_fp

    b_tp = round(data_size * 0.3 * (0.88 + rng.random() * 0.08))
    b_fp = round(data_size * 0.3 * (0.07 + rng.random() * 0.1))
    b_fn = round(data_size * 0.3 * (0.04 + rng.random() * 0.06))
    b_tn = round(data_size * 0.3) - b_fp

    def build_metrics(tp: int, fp: int, fn: int, tn: int, faster: bool) -> ModelMetrics:
        precision = tp / (tp + fp) if tp + fp else 0
        recall = tp / (tp + fn) if tp + fn else 0
        accuracy = (tp + tn) / (tp + fp + fn + tn) if tp + fp + fn + tn else 0
        specificity = tn / (tn + fp) if tn + fp else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if precision + recall else 0

        if faster:
            latency_avg = round(85 + rng.random() * 40)
            throughput = round(120 + rng.random() * 80)
        else:
            latency_avg = round(110 + rng.random() * 60)
            throughput = round(80 + rng.random() * 60)

        return ModelMetrics(
            accuracy=round(accuracy, 4),
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1_score, 4),
            auc_roc=round(0.88 + rng.random() * 0.08, 4) if faster else round(0.91 + rng.random() * 0.06, 4),
            auc_pr=round(0.84 + rng.random() * 0.1, 4) if faster else round(0.87 + rng.random() * 0.08, 4),
            log_loss=round(0.28 + rng.random() * 0.15, 4) if faster else round(0.22 + rng.random() * 0.12, 4),
            mse=round(0.08 + rng.random() * 0.06, 4) if faster else round(0.06 + rng.random() * 0.05, 4),
            mae=round(0.05 + rng.random() * 0.04, 4) if faster else round(0.04 + rng.random() * 0.03, 4),
            r_squared=round(0.82 + rng.random() * 0.1, 4) if faster else round(0.85 + rng.random() * 0.08, 4),
            specificity=round(specificity, 4),
            sensitivity=round(recall, 4),
            confusion_matrix={"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            latency_avg_ms=latency_avg,
            latency_p50_ms=max(1, latency_avg - 15),
            latency_p95_ms=latency_avg + (65 if faster else 90),
            latency_p99_ms=latency_avg + (135 if faster else 190),
            throughput_rps=throughput,
            total_predictions=data_size,
            error_rate=round(0.5 + rng.random() * 1.5, 2) if faster else round(0.8 + rng.random() * 2.0, 2),
        )

    classes = ["positive", "negative"] if features <= 5 else ["positive", "negative", "neutral"]

    return ComparisonResult(
        model_a=build_metrics(a_tp, a_fp, a_fn, a_tn, True),
        model_b=build_metrics(b_tp, b_fp, b_fn, b_tn, False),
        dataset_info=DatasetInfo(
            total_samples=data_size,
            features=features,
            classes=classes,
            format=data_format,
            train_split=0.8,
            test_split=0.2,
        ),
        timestamp=_timestamp(),
    )


def _append_log(result: PredictionResult, input_hash: str) -> None:
    create_log(
        LogEntry(
            id=f"log_{uuid4().hex[:10]}",
            prediction_id=result.id,
            model=result.model,
            latency_ms=result.latency_ms,
            timestamp=result.timestamp,
            status="success",
            input_hash=input_hash,
            cached=result.cached,
        )
    )


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_models()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": _timestamp()}


@app.get("/v1/models", response_model=list[ModelRecord])
def list_models() -> list[ModelRecord]:
    return list_registered_models()


@app.post("/v1/predictions", response_model=PredictionResult)
def create_prediction(request: PredictionRequest) -> PredictionResult:
    global _total_latency

    input_hash = _hash_input(request.input)
    target_model = request.model_id or ("model_a" if int(input_hash[:1], 16) % 2 == 0 else "model_b")
    cache_key = f"{input_hash}:{target_model}"

    if cached := _cache.get(cache_key):
        cached_result = cached.model_copy(
            update={
                "id": f"pred_{uuid4().hex[:10]}",
                "cached": True,
                "latency_ms": 3,
                "timestamp": _timestamp(),
            }
        )
        _metrics.cache_hits += 1
        _metrics.requests += 1
        _append_log(cached_result, input_hash)
        return cached_result

    model_record = get_model(target_model)
    if model_record is None or model_record.status != "active":
        raise HTTPException(status_code=404, detail="Unknown model_id")

    started_at = perf_counter()
    try:
        hf_prediction = _inference_client.text_classification(model_record.hf_repo_id, request.input)
    except HuggingFaceInferenceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    latency = max(1, round((perf_counter() - started_at) * 1000))

    if target_model == "model_a":
        _metrics.model_a_usage += 1
    else:
        _metrics.model_b_usage += 1

    result = PredictionResult(
        id=f"pred_{uuid4().hex[:10]}",
        prediction=hf_prediction.label,
        model=target_model,
        confidence=min(round(hf_prediction.score, 4), 0.9999),
        latency_ms=latency,
        timestamp=_timestamp(),
        cached=False,
    )
    _cache[cache_key] = result
    _metrics.cache_misses += 1
    _metrics.requests += 1
    _total_latency += latency
    usage_total = _metrics.model_a_usage + _metrics.model_b_usage
    _metrics.avg_latency = round(_total_latency / usage_total) if usage_total else 0
    _metrics.success_rate = 99.5
    _append_log(result, input_hash)
    return result


@app.get("/v1/system/metrics", response_model=SystemMetrics)
def get_metrics() -> SystemMetrics:
    return _metrics


@app.get("/v1/system/logs", response_model=list[LogEntry])
def get_logs() -> list[LogEntry]:
    return list_persisted_logs(limit=20)


@app.post("/v1/comparisons", response_model=ComparisonJob)
def create_comparison(request: ComparisonJobCreateRequest) -> ComparisonJob:
    job_id = f"cmp_{uuid4().hex[:10]}"
    result = _build_comparison_result(request.data_size, request.features, request.format)
    job = ComparisonJob(
        job_id=job_id,
        status="completed",
        result=result,
        created_at=_timestamp(),
        updated_at=_timestamp(),
    )
    _comparisons[job_id] = job
    return job


@app.get("/v1/comparisons/{job_id}", response_model=ComparisonJob)
def get_comparison(job_id: str) -> ComparisonJob:
    if job_id not in _comparisons:
        raise HTTPException(status_code=404, detail="Comparison job not found")
    return _comparisons[job_id]
