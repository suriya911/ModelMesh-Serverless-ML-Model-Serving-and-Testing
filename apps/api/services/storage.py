from __future__ import annotations

import os
import tempfile
from pathlib import Path
from uuid import uuid4

import boto3

from shared.schemas.contracts import DatasetUploadResponse


class DatasetStorageError(RuntimeError):
    pass


def dataset_bucket_name() -> str:
    bucket_name = (os.getenv("DATASET_BUCKET") or "").strip()
    if not bucket_name:
        raise DatasetStorageError("DATASET_BUCKET is not configured")
    return bucket_name


def create_dataset_upload(file_name: str, content_type: str) -> DatasetUploadResponse:
    bucket_name = dataset_bucket_name()

    suffix = Path(file_name).suffix.lower()
    safe_suffix = suffix if suffix else ".bin"
    object_key = f"datasets/{uuid4().hex}/{Path(file_name).stem}{safe_suffix}"

    client = boto3.client("s3", region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket_name,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )

    return DatasetUploadResponse(
        object_key=object_key,
        upload_url=upload_url,
        bucket_name=bucket_name,
    )


def ensure_dataset_object_exists(object_key: str) -> None:
    bucket_name = dataset_bucket_name()
    client = boto3.client("s3", region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    try:
        client.head_object(Bucket=bucket_name, Key=object_key)
    except Exception as exc:  # noqa: BLE001
        raise DatasetStorageError(f"dataset object not found in S3: {object_key}") from exc


def download_dataset_to_tempfile(object_key: str) -> Path:
    bucket_name = dataset_bucket_name()
    suffix = Path(object_key).suffix or ".bin"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = Path(temp_file.name)
    temp_file.close()

    client = boto3.client("s3", region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    try:
        client.download_file(bucket_name, object_key, str(temp_path))
        return temp_path
    except Exception as exc:  # noqa: BLE001
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise DatasetStorageError(f"failed to download dataset object from S3: {object_key}") from exc
