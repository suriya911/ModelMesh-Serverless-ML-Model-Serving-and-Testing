from __future__ import annotations

import json
import os
from typing import Any

import boto3

from shared.schemas.contracts import ComparisonJobCreateRequest


class QueuePublishError(RuntimeError):
    pass


def queue_enabled() -> bool:
    return bool((os.getenv("COMPARISON_QUEUE_URL") or "").strip())


def enqueue_comparison_job(job_id: str, request: ComparisonJobCreateRequest) -> None:
    queue_url = (os.getenv("COMPARISON_QUEUE_URL") or "").strip()
    if not queue_url:
        raise QueuePublishError("COMPARISON_QUEUE_URL is not configured")

    client = boto3.client("sqs", region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    payload: dict[str, Any] = {
        "job_id": job_id,
        "data_size": request.data_size,
        "features": request.features,
        "format": request.format,
        "dataset_name": request.dataset_name,
        "dataset_s3_key": request.dataset_s3_key,
    }

    response = client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps(payload),
    )
    if not response.get("MessageId"):
        raise QueuePublishError("SQS did not return a MessageId")
