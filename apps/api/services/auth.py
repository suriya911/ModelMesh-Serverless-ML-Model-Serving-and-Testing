from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Header, HTTPException


@dataclass(frozen=True)
class AuthContext:
    tenant_id: str
    api_key: str
    predictions_limit: int
    comparisons_limit: int
    uploads_limit: int


def _parse_int(value: str, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _configured_auth_rows() -> list[AuthContext]:
    raw = (os.getenv("API_KEYS") or "").strip()
    if not raw:
        raw = "demo:modelmesh-demo-key:1000:50:100"

    rows: list[AuthContext] = []
    for chunk in raw.split(";"):
        entry = chunk.strip()
        if not entry:
            continue
        parts = [part.strip() for part in entry.split(":")]
        if len(parts) < 2:
            continue
        tenant_id = parts[0] or "demo"
        api_key = parts[1]
        predictions_limit = _parse_int(parts[2] if len(parts) > 2 else "1000", 1000)
        comparisons_limit = _parse_int(parts[3] if len(parts) > 3 else "50", 50)
        uploads_limit = _parse_int(parts[4] if len(parts) > 4 else "100", 100)
        rows.append(
            AuthContext(
                tenant_id=tenant_id,
                api_key=api_key,
                predictions_limit=predictions_limit,
                comparisons_limit=comparisons_limit,
                uploads_limit=uploads_limit,
            )
        )
    return rows


def _find_context_by_key(api_key: str) -> AuthContext | None:
    for row in _configured_auth_rows():
        if row.api_key == api_key:
            return row
    return None


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> AuthContext:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    context = _find_context_by_key(x_api_key)
    if context is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return context
