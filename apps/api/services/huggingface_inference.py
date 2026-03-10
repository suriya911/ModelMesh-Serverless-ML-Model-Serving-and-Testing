from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from huggingface_hub import InferenceClient


class HuggingFaceInferenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class HuggingFacePrediction:
    label: str
    score: float


class HuggingFaceInferenceClient:
    def __init__(self) -> None:
        self.token = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
        provider = os.getenv("HF_PROVIDER", "auto")
        timeout_seconds = float(os.getenv("HF_TIMEOUT_SECONDS", "45"))
        self.client = InferenceClient(
            provider=provider,
            api_key=self.token,
            timeout=timeout_seconds,
        )

    def text_classification(self, repo_id: str, text: str) -> HuggingFacePrediction:
        if not self.token:
            raise HuggingFaceInferenceError(
                "Missing Hugging Face API token. Set HF_API_TOKEN or HUGGINGFACEHUB_API_TOKEN before calling /v1/predictions."
            )

        try:
            response = self.client.text_classification(text, model=repo_id)
        except Exception as exc:  # noqa: BLE001
            raise HuggingFaceInferenceError(str(exc)) from exc

        predictions = self._normalize_predictions(response)
        if not predictions:
            raise HuggingFaceInferenceError("Hugging Face returned an empty prediction payload")

        best = max(predictions, key=lambda item: item.score)
        return best

    def _normalize_predictions(self, response: Any) -> list[HuggingFacePrediction]:
        if response is None:
            return []

        if isinstance(response, list):
            return [self._to_prediction(item) for item in response]

        return [self._to_prediction(response)]

    @staticmethod
    def _to_prediction(item: Any) -> HuggingFacePrediction:
        label = getattr(item, "label", None)
        score = getattr(item, "score", None)

        if label is None and isinstance(item, dict):
            label = item.get("label")
            score = item.get("score")

        if label is None or score is None:
            raise HuggingFaceInferenceError("Unexpected prediction format from Hugging Face")

        return HuggingFacePrediction(label=str(label), score=float(score))
