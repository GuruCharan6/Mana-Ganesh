from functools import lru_cache
from typing import TypeVar

import httpx
from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_admin_client() -> Client:
    """Service-role client. Bypasses RLS — every call site must enforce its
    own authorization checks in Python (role, access_level, org membership)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


T = TypeVar("T")


def execute_read(builder, retries: int = 1) -> T:
    """Run a read-only PostgREST query, retrying on a transient transport
    failure (seen on Render <-> Supabase as httpx.ReadError / "Resource
    temporarily unavailable" on HTTP/2 — most likely a reused connection
    going stale between requests). GET-only: read-only queries are safe to
    retry blindly, unlike writes. Calling .execute() again rebuilds the
    request fresh, no builder state is consumed by a failed attempt.
    """
    for attempt in range(retries + 1):
        try:
            return builder.execute()
        except httpx.TransportError:
            if attempt == retries:
                raise
