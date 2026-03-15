from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from random import Random

from apps.api.services.db import ComparisonJobORM, get_comparison_job, list_comparison_jobs, session_scope
from apps.api.services.dataset_evaluation import DatasetEvaluationError, evaluate_dataset_file, get_model_label
from shared.schemas.contracts import ComparisonJob, ComparisonJobCreateRequest, ComparisonResult, DatasetInfo, ModelMetrics


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _to_job(row: ComparisonJobORM) -> ComparisonJob:
    return ComparisonJob(
        job_id=row.job_id,
        status=row.status,
        dataset_name=row.dataset_name,
        dataset_s3_key=row.dataset_s3_key,
        result=ComparisonResult.model_validate_json(row.result_json) if row.result_json else None,
        error_message=row.error_message,
        created_at=row.created_at.replace(tzinfo=UTC).isoformat(),
        updated_at=row.updated_at.replace(tzinfo=UTC).isoformat(),
    )


def create_job(job_id: str, request: ComparisonJobCreateRequest) -> ComparisonJob:
    now = datetime.now(UTC).replace(tzinfo=None)
    with session_scope() as session:
        row = ComparisonJobORM(
            job_id=job_id,
            status="queued",
            dataset_name=request.dataset_name,
            dataset_s3_key=request.dataset_s3_key,
            data_size=request.data_size,
            features=request.features,
            data_format=request.format,
            result_json=None,
            error_message=None,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
        return _to_job(row)


def start_job(job_id: str) -> None:
    with session_scope() as session:
        row = get_comparison_job(session, job_id)
        if row is None:
            raise KeyError(job_id)
        row.status = "running"
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)


def complete_job(job_id: str, result: ComparisonResult) -> None:
    with session_scope() as session:
        row = get_comparison_job(session, job_id)
        if row is None:
            raise KeyError(job_id)
        row.status = "completed"
        row.result_json = result.model_dump_json()
        row.error_message = None
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)


def fail_job(job_id: str, error_message: str) -> None:
    with session_scope() as session:
        row = get_comparison_job(session, job_id)
        if row is None:
            raise KeyError(job_id)
        row.status = "failed"
        row.error_message = error_message
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)


def fetch_job(job_id: str) -> ComparisonJob | None:
    with session_scope() as session:
        row = get_comparison_job(session, job_id)
        return _to_job(row) if row is not None else None


def fetch_jobs(limit: int = 20) -> list[ComparisonJob]:
    with session_scope() as session:
        return [_to_job(row) for row in list_comparison_jobs(session, limit=limit)]


def build_comparison_result(
    data_size: int,
    features: int,
    data_format: str,
    *,
    model_a_type: str = "logistic_regression",
    model_b_type: str = "random_forest",
    train_split: float = 0.8,
    manual_classes: list[str] | None = None,
) -> ComparisonResult:
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
            display_name=get_model_label(model_a_type if faster else model_b_type),
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

    classes = manual_classes or (["positive", "negative"] if features <= 5 else ["positive", "negative", "neutral"])

    return ComparisonResult(
        model_a=build_metrics(a_tp, a_fp, a_fn, a_tn, True),
        model_b=build_metrics(b_tp, b_fp, b_fn, b_tn, False),
        dataset_info=DatasetInfo(
            total_samples=data_size,
            features=features,
            classes=classes,
            format=data_format,
            train_split=train_split,
            test_split=round(1 - train_split, 2),
        ),
        timestamp=_timestamp(),
    )


def build_comparison_result_from_dataset(dataset_path: Path, request: ComparisonJobCreateRequest) -> ComparisonResult:
    try:
        return evaluate_dataset_file(
            dataset_path,
            model_a_type=request.model_a_type,
            model_b_type=request.model_b_type,
            train_split=request.train_split,
            metadata_mode=request.metadata_mode,
            manual_data_size=request.data_size,
            manual_features=request.features,
            manual_classes=request.manual_classes,
        )
    except DatasetEvaluationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise DatasetEvaluationError(str(exc)) from exc
