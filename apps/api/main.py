from __future__ import annotations

import os
from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from apps.api.services.comparison_jobs import (
    build_comparison_result,
    complete_job,
    create_job,
    fail_job,
    fetch_job,
    start_job,
)
from apps.api.services.db import run_migrations
from apps.api.services.huggingface_inference import (
    HuggingFaceInferenceClient,
    HuggingFaceInferenceError,
)
from apps.api.services.kaggle_ingest import KaggleIngestError, ingest_kaggle_dataset
from apps.api.services.model_registry import (
    get_model,
    list_models as list_registered_models,
    seed_models,
)
from apps.api.services.prediction_logs import create_log, list_logs as list_persisted_logs
from apps.api.services.queue import QueuePublishError, enqueue_comparison_job, queue_enabled
from apps.api.services.runtime_state import RuntimeStateStore
from apps.api.services.storage import DatasetStorageError, create_dataset_upload

from shared.schemas.contracts import (
    ComparisonJob,
    ComparisonJobCreateRequest,
    DatasetUploadRequest,
    DatasetUploadResponse,
    LogEntry,
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

_inference_client = HuggingFaceInferenceClient()
_runtime_state = RuntimeStateStore()


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _hash_input(value: str) -> str:
    hash_value = 0
    for char in value:
        hash_value = ((hash_value << 5) - hash_value) + ord(char)
        hash_value &= 0xFFFFFFFF
    return f"{hash_value:x}"


def _process_comparison_job(job_id: str, request: ComparisonJobCreateRequest) -> None:
    try:
        start_job(job_id)
        result = build_comparison_result(
            request.data_size,
            request.features,
            request.format,
            model_a_type=request.model_a_type,
            model_b_type=request.model_b_type,
            train_split=request.train_split,
            manual_classes=request.manual_classes,
        )
        complete_job(job_id, result)
    except Exception as exc:  # noqa: BLE001
        fail_job(job_id, str(exc))


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
    run_migrations()
    seed_models()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": _timestamp()}


@app.get("/v1/models", response_model=list[ModelRecord])
def list_models() -> list[ModelRecord]:
    return list_registered_models()


@app.post("/v1/uploads/datasets", response_model=DatasetUploadResponse)
def create_dataset_upload_url(request: DatasetUploadRequest) -> DatasetUploadResponse:
    try:
        return create_dataset_upload(request.file_name, request.content_type)
    except DatasetStorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/v1/predictions", response_model=PredictionResult)
def create_prediction(request: PredictionRequest) -> PredictionResult:
    input_hash = _hash_input(request.input)
    target_model = request.model_id or ("model_a" if int(input_hash[:1], 16) % 2 == 0 else "model_b")
    cache_key = f"{input_hash}:{target_model}"

    cached = _runtime_state.get_cached_prediction(cache_key)
    if cached:
        cached_result = cached.model_copy(
            update={
                "id": f"pred_{uuid4().hex[:10]}",
                "cached": True,
                "latency_ms": 3,
                "timestamp": _timestamp(),
            }
        )
        _runtime_state.record_prediction(target_model, latency_ms=3, cached=True, success=True)
        _append_log(cached_result, input_hash)
        return cached_result

    model_record = get_model(target_model)
    if model_record is None or model_record.status != "active":
        raise HTTPException(status_code=404, detail="Unknown model_id")

    started_at = perf_counter()
    try:
        hf_prediction = _inference_client.text_classification(model_record.hf_repo_id, request.input)
    except HuggingFaceInferenceError as exc:
        _runtime_state.record_prediction(target_model, latency_ms=0, cached=False, success=False)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    latency = max(1, round((perf_counter() - started_at) * 1000))

    result = PredictionResult(
        id=f"pred_{uuid4().hex[:10]}",
        prediction=hf_prediction.label,
        model=target_model,
        confidence=min(round(hf_prediction.score, 4), 0.9999),
        latency_ms=latency,
        timestamp=_timestamp(),
        cached=False,
    )
    _runtime_state.set_cached_prediction(cache_key, result)
    _runtime_state.record_prediction(target_model, latency_ms=latency, cached=False, success=True)
    _append_log(result, input_hash)
    return result


@app.get("/v1/system/metrics", response_model=SystemMetrics)
def get_metrics() -> SystemMetrics:
    return _runtime_state.get_metrics()


@app.get("/v1/system/logs", response_model=list[LogEntry])
def get_logs() -> list[LogEntry]:
    return list_persisted_logs(limit=20)


@app.post("/v1/comparisons", response_model=ComparisonJob)
def create_comparison(request: ComparisonJobCreateRequest, background_tasks: BackgroundTasks) -> ComparisonJob:
    effective_request = request
    if request.kaggle_url:
        try:
            kaggle_dataset = ingest_kaggle_dataset(request.kaggle_url)
        except KaggleIngestError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        effective_request = request.model_copy(
            update={
                "dataset_name": kaggle_dataset.dataset_name,
                "dataset_s3_key": kaggle_dataset.dataset_s3_key,
                "data_size": kaggle_dataset.data_size,
                "features": kaggle_dataset.features,
                "format": kaggle_dataset.data_format,
            }
        )

    job_id = f"cmp_{uuid4().hex[:10]}"
    job = create_job(job_id, effective_request)
    if queue_enabled():
        try:
            enqueue_comparison_job(job_id, effective_request)
        except QueuePublishError as exc:
            fail_job(job_id, str(exc))
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    else:
        background_tasks.add_task(_process_comparison_job, job_id, effective_request)
    return job


@app.get("/v1/comparisons/{job_id}", response_model=ComparisonJob)
def get_comparison(job_id: str) -> ComparisonJob:
    job = fetch_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Comparison job not found")
    return job
