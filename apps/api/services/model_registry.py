from __future__ import annotations

from shared.schemas.contracts import ModelRecord
from apps.api.services.db import ModelRecordORM, model_exists, query_models, session_scope


SEED_MODELS = [
    ModelRecord(
        model_id="model_a",
        display_name="Model A",
        provider="huggingface",
        hf_repo_id="distilbert/distilbert-base-uncased-finetuned-sst-2-english",
        task_type="text-classification",
        status="active",
    ),
    ModelRecord(
        model_id="model_b",
        display_name="Model B",
        provider="huggingface",
        hf_repo_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
        task_type="text-classification",
        status="active",
    ),
]


def seed_models() -> None:
    with session_scope() as session:
        for model in SEED_MODELS:
            if model_exists(session, model.model_id):
                continue
            session.add(
                ModelRecordORM(
                    model_id=model.model_id,
                    display_name=model.display_name,
                    provider=model.provider,
                    hf_repo_id=model.hf_repo_id,
                    task_type=model.task_type,
                    status=model.status,
                )
            )


def list_models() -> list[ModelRecord]:
    with session_scope() as session:
        return [
            ModelRecord(
                model_id=row.model_id,
                display_name=row.display_name,
                provider=row.provider,
                hf_repo_id=row.hf_repo_id,
                task_type=row.task_type,
                status=row.status,
            )
            for row in query_models(session)
        ]


def get_model(model_id: str) -> ModelRecord | None:
    with session_scope() as session:
        row = session.get(ModelRecordORM, model_id)
        if row is None:
            return None
        return ModelRecord(
            model_id=row.model_id,
            display_name=row.display_name,
            provider=row.provider,
            hf_repo_id=row.hf_repo_id,
            task_type=row.task_type,
            status=row.status,
        )
