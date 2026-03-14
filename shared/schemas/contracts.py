from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    input: str = Field(min_length=1)
    model_id: Optional[str] = None
    routing_mode: Literal["auto", "pinned"] = "auto"
    tenant_id: Optional[str] = None
    request_id: Optional[str] = None


class PredictionResult(BaseModel):
    id: str
    prediction: str
    model: Literal["model_a", "model_b"]
    confidence: float
    latency_ms: int
    timestamp: str
    cached: bool


class SystemMetrics(BaseModel):
    requests: int
    avg_latency: int
    model_a_usage: int
    model_b_usage: int
    cache_hits: int
    cache_misses: int
    success_rate: float


class LogEntry(BaseModel):
    id: str
    prediction_id: str
    model: Literal["model_a", "model_b"]
    latency_ms: int
    timestamp: str
    status: Literal["success", "error"]
    input_hash: str
    cached: bool


class ConfusionMatrix(BaseModel):
    tp: int
    fp: int
    tn: int
    fn: int


class ModelMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    auc_pr: float
    log_loss: float
    mse: float
    mae: float
    r_squared: float
    specificity: float
    sensitivity: float
    confusion_matrix: ConfusionMatrix | dict[str, int]
    latency_avg_ms: int
    latency_p50_ms: int
    latency_p95_ms: int
    latency_p99_ms: int
    throughput_rps: int
    total_predictions: int
    error_rate: float


class DatasetInfo(BaseModel):
    total_samples: int
    features: int
    classes: list[str]
    format: str
    train_split: float
    test_split: float


class ComparisonResult(BaseModel):
    model_a: ModelMetrics
    model_b: ModelMetrics
    dataset_info: DatasetInfo
    timestamp: str


class ComparisonJobCreateRequest(BaseModel):
    data_size: int = Field(ge=100)
    features: int = Field(ge=1)
    format: str
    dataset_name: Optional[str] = None
    dataset_s3_key: Optional[str] = None
    kaggle_url: Optional[str] = None


class ComparisonJob(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    result: ComparisonResult | None = None
    dataset_name: Optional[str] = None
    dataset_s3_key: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class DatasetUploadRequest(BaseModel):
    file_name: str = Field(min_length=1)
    content_type: str = Field(min_length=1)


class DatasetUploadResponse(BaseModel):
    object_key: str
    upload_url: str
    bucket_name: str


class ModelRecord(BaseModel):
    model_id: str
    display_name: str
    provider: Literal["huggingface"]
    hf_repo_id: str
    task_type: str
    status: Literal["active", "inactive"]
