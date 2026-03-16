from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException

from apps.api.services.auth import AuthContext
from apps.api.services.db import get_or_create_tenant_usage, session_scope
from shared.schemas.contracts import AuthStatusResponse, TenantQuota, TenantUsage

UsageAction = Literal["predictions", "comparisons", "uploads"]


def _usage_date() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def _limit_for_action(context: AuthContext, action: UsageAction) -> int:
    if action == "predictions":
        return context.predictions_limit
    if action == "comparisons":
        return context.comparisons_limit
    return context.uploads_limit


def _value_for_action(usage: TenantUsage, action: UsageAction) -> int:
    if action == "predictions":
        return usage.predictions_used
    if action == "comparisons":
        return usage.comparisons_used
    return usage.uploads_used


def get_auth_status(context: AuthContext) -> AuthStatusResponse:
    with session_scope() as session:
        row = get_or_create_tenant_usage(session, context.tenant_id, _usage_date())
        return AuthStatusResponse(
            tenant_id=context.tenant_id,
            usage=TenantUsage(
                predictions_used=row.predictions_used,
                comparisons_used=row.comparisons_used,
                uploads_used=row.uploads_used,
            ),
            quota=TenantQuota(
                predictions_limit=context.predictions_limit,
                comparisons_limit=context.comparisons_limit,
                uploads_limit=context.uploads_limit,
            ),
        )


def enforce_and_increment_usage(context: AuthContext, action: UsageAction) -> AuthStatusResponse:
    with session_scope() as session:
        row = get_or_create_tenant_usage(session, context.tenant_id, _usage_date())
        current_usage = TenantUsage(
            predictions_used=row.predictions_used,
            comparisons_used=row.comparisons_used,
            uploads_used=row.uploads_used,
        )
        current_value = _value_for_action(current_usage, action)
        limit = _limit_for_action(context, action)
        if current_value >= limit:
            raise HTTPException(status_code=429, detail=f"Daily {action} quota exceeded for tenant '{context.tenant_id}'")

        if action == "predictions":
            row.predictions_used += 1
        elif action == "comparisons":
            row.comparisons_used += 1
        else:
            row.uploads_used += 1

        return AuthStatusResponse(
            tenant_id=context.tenant_id,
            usage=TenantUsage(
                predictions_used=row.predictions_used,
                comparisons_used=row.comparisons_used,
                uploads_used=row.uploads_used,
            ),
            quota=TenantQuota(
                predictions_limit=context.predictions_limit,
                comparisons_limit=context.comparisons_limit,
                uploads_limit=context.uploads_limit,
            ),
        )
