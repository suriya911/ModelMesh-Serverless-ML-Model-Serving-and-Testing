from __future__ import annotations

import csv
import io
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import boto3
from kaggle.api.kaggle_api_extended import KaggleApi

from apps.api.services.storage import DatasetStorageError, dataset_bucket_name


class KaggleIngestError(RuntimeError):
    pass


SUPPORTED_SUFFIXES = {".csv", ".tsv", ".json"}


@dataclass
class KaggleDatasetMetadata:
    dataset_name: str
    dataset_s3_key: str
    data_size: int
    features: int
    data_format: str


def kaggle_configured() -> bool:
    return bool((os.getenv("KAGGLE_USERNAME") or "").strip() and (os.getenv("KAGGLE_KEY") or "").strip())


def _parse_kaggle_url(kaggle_url: str) -> tuple[str, str]:
    parsed = urlparse(kaggle_url.strip())
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc not in {"www.kaggle.com", "kaggle.com"}:
        raise KaggleIngestError("Only kaggle.com dataset or competition URLs are supported")
    if len(parts) >= 3 and parts[0] == "datasets":
        return "dataset", "/".join(parts[1:3])
    if len(parts) >= 2 and parts[0] in {"c", "competitions"}:
        return "competition", parts[1]
    raise KaggleIngestError("Unsupported Kaggle URL format")


def _kaggle_client() -> KaggleApi:
    if not kaggle_configured():
        raise KaggleIngestError("KAGGLE_USERNAME and KAGGLE_KEY must be configured on the backend")
    api = KaggleApi()
    api.authenticate()
    return api


def _pick_dataset_file(directory: Path) -> Path:
    candidates = [
        path
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES and "__MACOSX" not in path.parts
    ]
    if not candidates:
        raise KaggleIngestError("No supported CSV, TSV, or JSON file was found in the Kaggle download")
    candidates.sort(key=lambda path: (path.suffix.lower() != ".csv", path.stat().st_size * -1))
    return candidates[0]


def _infer_tabular_metadata(file_path: Path) -> tuple[int, int, str]:
    suffix = file_path.suffix.lower()
    if suffix == ".json":
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list) or not payload:
            raise KaggleIngestError("JSON dataset must be a non-empty array of objects")
        first = payload[0]
        if not isinstance(first, dict):
            raise KaggleIngestError("JSON dataset rows must be objects")
        return len(payload), len(first), "json"

    delimiter = "\t" if suffix == ".tsv" else ","
    with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        try:
            header = next(reader)
        except StopIteration as exc:
            raise KaggleIngestError("Dataset file is empty") from exc
        row_count = 0
        for row in reader:
            if any(cell.strip() for cell in row):
                row_count += 1
    features = max(1, len(header))
    return max(100, row_count), features, "tsv" if suffix == ".tsv" else "csv"


def _upload_file_to_s3(file_path: Path) -> str:
    bucket = dataset_bucket_name()
    object_key = f"kaggle/{uuid4().hex}/{file_path.name}"
    client = boto3.client("s3", region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    extra_args = {"ContentType": "text/csv"}
    if file_path.suffix.lower() == ".json":
        extra_args["ContentType"] = "application/json"
    elif file_path.suffix.lower() == ".tsv":
        extra_args["ContentType"] = "text/tab-separated-values"
    try:
        client.upload_file(str(file_path), bucket, object_key, ExtraArgs=extra_args)
    except Exception as exc:  # noqa: BLE001
        raise DatasetStorageError(f"Failed to upload Kaggle dataset to S3: {file_path.name}") from exc
    return object_key


def ingest_kaggle_dataset(kaggle_url: str) -> KaggleDatasetMetadata:
    resource_type, resource_id = _parse_kaggle_url(kaggle_url)
    api = _kaggle_client()

    with tempfile.TemporaryDirectory(prefix="modelmesh-kaggle-") as temp_dir:
        temp_path = Path(temp_dir)
        if resource_type == "dataset":
            owner, slug = resource_id.split("/", maxsplit=1)
            api.dataset_download_files(f"{owner}/{slug}", path=str(temp_path), unzip=True, quiet=True)
            dataset_name = slug
        else:
            api.competition_download_files(resource_id, path=str(temp_path), quiet=True)
            for zip_path in temp_path.glob("*.zip"):
                import zipfile
                with zipfile.ZipFile(zip_path) as archive:
                    archive.extractall(temp_path / zip_path.stem)
                zip_path.unlink()
            dataset_name = resource_id

        dataset_file = _pick_dataset_file(temp_path)
        data_size, features, data_format = _infer_tabular_metadata(dataset_file)
        dataset_s3_key = _upload_file_to_s3(dataset_file)

        return KaggleDatasetMetadata(
            dataset_name=dataset_name,
            dataset_s3_key=dataset_s3_key,
            data_size=data_size,
            features=features,
            data_format=data_format,
        )
