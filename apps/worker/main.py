from __future__ import annotations

import json
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any

import boto3

from apps.api.services.comparison_jobs import (
    build_comparison_result,
    build_comparison_result_from_dataset,
    complete_job,
    fail_job,
    start_job,
)
from apps.api.services.db import run_migrations
from apps.api.services.dataset_evaluation import DatasetEvaluationError
from apps.api.services.storage import DatasetStorageError, download_dataset_to_tempfile, ensure_dataset_object_exists
from shared.schemas.contracts import ComparisonJobCreateRequest


RUNNING = True


def _handle_signal(signum: int, frame: Any) -> None:  # noqa: ARG001
    global RUNNING
    RUNNING = False


def _queue_url() -> str:
    queue_url = (os.getenv("COMPARISON_QUEUE_URL") or "").strip()
    if not queue_url:
        raise RuntimeError("COMPARISON_QUEUE_URL is not configured")
    return queue_url


def _region_name() -> str | None:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")


def process_message(message: dict[str, Any]) -> None:
    body = json.loads(message["Body"])
    job_id = body["job_id"]
    request = ComparisonJobCreateRequest(
        data_size=int(body["data_size"]),
        features=int(body["features"]),
        format=str(body["format"]),
        dataset_name=body.get("dataset_name"),
        dataset_s3_key=body.get("dataset_s3_key"),
        model_a_type=str(body.get("model_a_type") or "logistic_regression"),
        model_b_type=str(body.get("model_b_type") or "random_forest"),
        train_split=float(body.get("train_split") or 0.8),
        metadata_mode=str(body.get("metadata_mode") or "auto"),
        manual_classes=body.get("manual_classes"),
    )
    try:
        start_job(job_id)
        dataset_s3_key = request.dataset_s3_key
        if dataset_s3_key:
            ensure_dataset_object_exists(dataset_s3_key)
            temp_path = download_dataset_to_tempfile(dataset_s3_key)
            try:
                result = build_comparison_result_from_dataset(temp_path, request)
            finally:
                Path(temp_path).unlink(missing_ok=True)
        else:
            result = build_comparison_result(
                data_size=request.data_size,
                features=request.features,
                data_format=request.format,
                model_a_type=request.model_a_type,
                model_b_type=request.model_b_type,
                train_split=request.train_split,
                manual_classes=request.manual_classes,
            )
        complete_job(job_id, result)
    except DatasetStorageError as exc:
        fail_job(job_id, str(exc))
    except DatasetEvaluationError as exc:
        fail_job(job_id, str(exc))
    except Exception as exc:  # noqa: BLE001
        fail_job(job_id, str(exc))


def main() -> int:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    run_migrations()
    client = boto3.client("sqs", region_name=_region_name())
    queue_url = _queue_url()

    while RUNNING:
        response = client.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=20,
            VisibilityTimeout=120,
        )
        messages = response.get("Messages", [])
        if not messages:
            time.sleep(1)
            continue

        for message in messages:
            process_message(message)
            client.delete_message(
                QueueUrl=queue_url,
                ReceiptHandle=message["ReceiptHandle"],
            )

    return 0


if __name__ == "__main__":
    sys.exit(main())
