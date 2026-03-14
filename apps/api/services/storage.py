from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import boto3

from shared.schemas.contracts import DatasetUploadResponse


class DatasetStorageError(RuntimeError):
    pass


def create_dataset_upload(file_name: str, content_type: str) -> DatasetUploadResponse:
    bucket_name = (os.getenv("DATASET_BUCKET") or "").strip()
    if not bucket_name:
      raise DatasetStorageError("DATASET_BUCKET is not configured")

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
