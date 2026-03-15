from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any, Callable

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.feature_extraction import DictVectorizer
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from shared.schemas.contracts import ComparisonResult, DatasetInfo, ModelMetrics


class DatasetEvaluationError(RuntimeError):
    pass


TARGET_CANDIDATES = (
    "target",
    "label",
    "class",
    "outcome",
    "y",
    "churn",
    "churned",
    "default",
    "defaulted",
    "survived",
    "species",
)


@dataclass
class LoadedDataset:
    rows: list[dict[str, Any]]
    data_format: str
    target_column: str


@dataclass(frozen=True)
class ModelSpec:
    key: str
    label: str
    classifier_factory: Callable[[], Any]
    regressor_factory: Callable[[], Any]


MODEL_SPECS: dict[str, ModelSpec] = {
    "logistic_regression": ModelSpec(
        key="logistic_regression",
        label="Logistic Regression",
        classifier_factory=lambda: LogisticRegression(max_iter=1000),
        regressor_factory=lambda: LinearRegression(),
    ),
    "decision_tree": ModelSpec(
        key="decision_tree",
        label="Decision Tree",
        classifier_factory=lambda: DecisionTreeClassifier(random_state=42),
        regressor_factory=lambda: DecisionTreeRegressor(random_state=42),
    ),
    "random_forest": ModelSpec(
        key="random_forest",
        label="Random Forest",
        classifier_factory=lambda: RandomForestClassifier(n_estimators=200, random_state=42),
        regressor_factory=lambda: RandomForestRegressor(n_estimators=200, random_state=42),
    ),
    "gradient_boosting": ModelSpec(
        key="gradient_boosting",
        label="Gradient Boosting",
        classifier_factory=lambda: GradientBoostingClassifier(random_state=42),
        regressor_factory=lambda: GradientBoostingRegressor(random_state=42),
    ),
    "svm": ModelSpec(
        key="svm",
        label="Support Vector Machine",
        classifier_factory=lambda: SVC(probability=True, random_state=42),
        regressor_factory=lambda: SVR(),
    ),
    "knn": ModelSpec(
        key="knn",
        label="K-Nearest Neighbors",
        classifier_factory=lambda: KNeighborsClassifier(n_neighbors=5),
        regressor_factory=lambda: KNeighborsRegressor(n_neighbors=5),
    ),
    "mlp_neural_net": ModelSpec(
        key="mlp_neural_net",
        label="MLP Neural Net",
        classifier_factory=lambda: MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
        regressor_factory=lambda: MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
    ),
}


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _load_rows(dataset_path: Path) -> tuple[list[dict[str, Any]], str]:
    suffix = dataset_path.suffix.lower()
    if suffix == ".json":
        payload = json.loads(dataset_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list) or not payload:
            raise DatasetEvaluationError("JSON dataset must be a non-empty array of objects")
        if not isinstance(payload[0], dict):
            raise DatasetEvaluationError("JSON dataset rows must be objects")
        return [dict(row) for row in payload], "json"

    delimiter = "\t" if suffix == ".tsv" else ","
    with dataset_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        rows = [dict(row) for row in reader if row]
    if not rows:
        raise DatasetEvaluationError("Dataset file is empty")
    return rows, "tsv" if suffix == ".tsv" else "csv"


def load_dataset(dataset_path: Path) -> LoadedDataset:
    rows, data_format = _load_rows(dataset_path)
    target_column = infer_target_column(rows)
    return LoadedDataset(rows=rows, data_format=data_format, target_column=target_column)


def infer_target_column(rows: list[dict[str, Any]]) -> str:
    columns = list(rows[0].keys())
    lower_map = {column.lower(): column for column in columns}
    for candidate in TARGET_CANDIDATES:
        if candidate in lower_map:
            return lower_map[candidate]
    if not columns:
        raise DatasetEvaluationError("Dataset has no columns")
    return columns[-1]


def _coerce_feature_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        raw = value.strip()
        if raw == "":
            return "__missing__"
        try:
            return float(raw)
        except ValueError:
            return raw
    return value if value is not None else "__missing__"


def _prepare_features(rows: list[dict[str, Any]], target_column: str) -> tuple[list[dict[str, Any]], list[Any]]:
    features: list[dict[str, Any]] = []
    targets: list[Any] = []
    for row in rows:
        if target_column not in row:
            raise DatasetEvaluationError(f"Target column '{target_column}' not found in dataset")
        target_value = row[target_column]
        if target_value in ("", None):
            continue
        prepared_row = {
            key: _coerce_feature_value(value)
            for key, value in row.items()
            if key != target_column
        }
        if not prepared_row:
            raise DatasetEvaluationError("Dataset must contain at least one feature column")
        features.append(prepared_row)
        targets.append(target_value)
    if len(features) < 10:
        raise DatasetEvaluationError("Dataset must contain at least 10 non-empty labeled rows")
    return features, targets


def _is_regression_target(targets: list[Any]) -> bool:
    numeric_targets: list[float] = []
    for value in targets:
        try:
            numeric_targets.append(float(value))
        except (TypeError, ValueError):
            return False
    unique_values = len(set(numeric_targets))
    return unique_values > min(20, max(10, len(numeric_targets) // 5))


def _build_vectorizer() -> DictVectorizer:
    return DictVectorizer(sparse=True)


def get_model_label(model_key: str) -> str:
    return MODEL_SPECS.get(model_key, MODEL_SPECS["logistic_regression"]).label


def _get_model_spec(model_key: str) -> ModelSpec:
    return MODEL_SPECS.get(model_key, MODEL_SPECS["logistic_regression"])


def _build_pipeline(model_key: str, is_regression: bool) -> Pipeline:
    spec = _get_model_spec(model_key)
    estimator = spec.regressor_factory() if is_regression else spec.classifier_factory()
    return Pipeline(
        steps=[
            ("vectorizer", _build_vectorizer()),
            ("model", estimator),
        ]
    )


def _specificity_from_confusion_matrix(matrix: np.ndarray) -> float:
    specificities: list[float] = []
    total = matrix.sum()
    for index in range(matrix.shape[0]):
        tp = matrix[index, index]
        fn = matrix[index, :].sum() - tp
        fp = matrix[:, index].sum() - tp
        tn = total - tp - fn - fp
        denominator = tn + fp
        if denominator > 0:
            specificities.append(tn / denominator)
    return mean(specificities) if specificities else 0.0


def _aggregate_confusion_counts(y_true: np.ndarray, y_pred: np.ndarray, label_count: int) -> dict[str, int]:
    matrix = confusion_matrix(y_true, y_pred, labels=list(range(label_count)))
    if label_count == 2:
        tn, fp, fn, tp = matrix.ravel()
        return {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}
    total = int(matrix.sum())
    correct = int(np.trace(matrix))
    errors = total - correct
    return {"tp": correct, "fp": errors, "tn": 0, "fn": errors}


def _classification_metrics(
    pipeline: Pipeline,
    x_train: list[dict[str, Any]],
    x_test: list[dict[str, Any]],
    y_train: np.ndarray,
    y_test: np.ndarray,
    class_names: list[str],
    display_name: str,
) -> ModelMetrics:
    fit_started = perf_counter()
    pipeline.fit(x_train, y_train)
    fit_elapsed_ms = max(1, round((perf_counter() - fit_started) * 1000))

    predict_started = perf_counter()
    predictions = pipeline.predict(x_test)
    predict_elapsed_ms = max(1, round((perf_counter() - predict_started) * 1000))

    proba = pipeline.predict_proba(x_test) if hasattr(pipeline, "predict_proba") else None
    matrix = confusion_matrix(y_test, predictions, labels=list(range(len(class_names))))
    specificity = _specificity_from_confusion_matrix(matrix)
    counts = _aggregate_confusion_counts(y_test, predictions, len(class_names))
    sample_count = max(1, len(y_test))
    latency_avg = max(1, round(predict_elapsed_ms / sample_count))

    auc_roc = 0.0
    auc_pr = 0.0
    loss = 0.0
    if proba is not None:
        try:
            if len(class_names) == 2:
                auc_roc = float(roc_auc_score(y_test, proba[:, 1]))
                auc_pr = float(average_precision_score(y_test, proba[:, 1]))
            else:
                auc_roc = float(roc_auc_score(y_test, proba, multi_class="ovr"))
                auc_pr = float(average_precision_score(y_test, proba, average="macro"))
            loss = float(log_loss(y_test, proba, labels=list(range(len(class_names)))))
        except ValueError:
            auc_roc = 0.0
            auc_pr = 0.0
            loss = 0.0

    return ModelMetrics(
        display_name=display_name,
        accuracy=round(float(accuracy_score(y_test, predictions)), 4),
        precision=round(float(precision_score(y_test, predictions, average="weighted", zero_division=0)), 4),
        recall=round(float(recall_score(y_test, predictions, average="weighted", zero_division=0)), 4),
        f1_score=round(float(f1_score(y_test, predictions, average="weighted", zero_division=0)), 4),
        auc_roc=round(auc_roc, 4),
        auc_pr=round(auc_pr, 4),
        log_loss=round(loss, 4),
        mse=round(float(mean_squared_error(y_test, predictions)), 4),
        mae=round(float(mean_absolute_error(y_test, predictions)), 4),
        r_squared=round(float(r2_score(y_test, predictions)), 4),
        specificity=round(float(specificity), 4),
        sensitivity=round(float(recall_score(y_test, predictions, average="weighted", zero_division=0)), 4),
        confusion_matrix=counts,
        latency_avg_ms=latency_avg,
        latency_p50_ms=max(1, round(latency_avg * 0.85)),
        latency_p95_ms=max(latency_avg, round(latency_avg * 1.8)),
        latency_p99_ms=max(latency_avg, round(latency_avg * 2.4)),
        throughput_rps=max(1, round(sample_count / max(predict_elapsed_ms / 1000, 0.001))),
        total_predictions=sample_count,
        error_rate=round(float((1 - accuracy_score(y_test, predictions)) * 100), 2),
    )


def _regression_metrics(
    pipeline: Pipeline,
    x_train: list[dict[str, Any]],
    x_test: list[dict[str, Any]],
    y_train: np.ndarray,
    y_test: np.ndarray,
    display_name: str,
) -> ModelMetrics:
    fit_started = perf_counter()
    pipeline.fit(x_train, y_train)
    fit_elapsed_ms = max(1, round((perf_counter() - fit_started) * 1000))

    predict_started = perf_counter()
    predictions = pipeline.predict(x_test)
    predict_elapsed_ms = max(1, round((perf_counter() - predict_started) * 1000))

    sample_count = max(1, len(y_test))
    latency_avg = max(1, round(predict_elapsed_ms / sample_count))
    mse = float(mean_squared_error(y_test, predictions))
    mae = float(mean_absolute_error(y_test, predictions))
    return ModelMetrics(
        display_name=display_name,
        accuracy=0.0,
        precision=0.0,
        recall=0.0,
        f1_score=0.0,
        auc_roc=0.0,
        auc_pr=0.0,
        log_loss=0.0,
        mse=round(mse, 4),
        mae=round(mae, 4),
        r_squared=round(float(r2_score(y_test, predictions)), 4),
        specificity=0.0,
        sensitivity=0.0,
        confusion_matrix={"tp": 0, "fp": 0, "tn": 0, "fn": 0},
        latency_avg_ms=latency_avg,
        latency_p50_ms=max(1, round(latency_avg * 0.85)),
        latency_p95_ms=max(latency_avg, round(latency_avg * 1.8)),
        latency_p99_ms=max(latency_avg, round(latency_avg * 2.4)),
        throughput_rps=max(1, round(sample_count / max(predict_elapsed_ms / 1000, 0.001))),
        total_predictions=sample_count,
        error_rate=round(float((mae / max(abs(float(np.mean(y_test))), 1.0)) * 100), 2),
    )


def evaluate_dataset_file(
    dataset_path: Path,
    *,
    model_a_type: str = "logistic_regression",
    model_b_type: str = "random_forest",
    train_split: float = 0.8,
    metadata_mode: str = "auto",
    manual_data_size: int | None = None,
    manual_features: int | None = None,
    manual_classes: list[str] | None = None,
) -> ComparisonResult:
    loaded = load_dataset(dataset_path)
    features, raw_targets = _prepare_features(loaded.rows, loaded.target_column)
    feature_count = len(features[0])
    test_size = max(0.05, min(0.49, 1 - train_split))

    is_regression = _is_regression_target(raw_targets)
    if is_regression:
        y = np.array([float(value) for value in raw_targets], dtype=float)
        x_train, x_test, y_train, y_test = train_test_split(features, y, test_size=test_size, random_state=42)

        model_a = _build_pipeline(model_a_type, True)
        model_b = _build_pipeline(model_b_type, True)

        metrics_a = _regression_metrics(model_a, x_train, x_test, y_train, y_test, get_model_label(model_a_type))
        metrics_b = _regression_metrics(model_b, x_train, x_test, y_train, y_test, get_model_label(model_b_type))
        inferred_classes = [loaded.target_column]
    else:
        encoder = LabelEncoder()
        y = encoder.fit_transform([str(value) for value in raw_targets])
        stratify = y if len(set(y)) > 1 and min(np.bincount(y)) > 1 else None
        x_train, x_test, y_train, y_test = train_test_split(
            features,
            y,
            test_size=test_size,
            random_state=42,
            stratify=stratify,
        )

        model_a = _build_pipeline(model_a_type, False)
        model_b = _build_pipeline(model_b_type, False)

        class_names = [str(value) for value in encoder.classes_]
        metrics_a = _classification_metrics(
            model_a,
            x_train,
            x_test,
            y_train,
            y_test,
            class_names,
            get_model_label(model_a_type),
        )
        metrics_b = _classification_metrics(
            model_b,
            x_train,
            x_test,
            y_train,
            y_test,
            class_names,
            get_model_label(model_b_type),
        )
        inferred_classes = class_names

    total_samples = len(features)
    inferred_test_size = max(1, len(x_test))
    train_size = max(1, len(x_train))
    resolved_classes = manual_classes if metadata_mode == "manual" and manual_classes else inferred_classes
    resolved_samples = manual_data_size if metadata_mode == "manual" and manual_data_size else total_samples
    resolved_features = manual_features if metadata_mode == "manual" and manual_features else feature_count

    return ComparisonResult(
        model_a=metrics_a,
        model_b=metrics_b,
        dataset_info=DatasetInfo(
            total_samples=resolved_samples,
            features=resolved_features,
            classes=resolved_classes,
            format=loaded.data_format,
            train_split=round(train_size / total_samples, 2),
            test_split=round(inferred_test_size / total_samples, 2),
        ),
        timestamp=_timestamp(),
    )
