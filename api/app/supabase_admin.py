from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_admin_client() -> Client:
    """Service-role client. Bypasses RLS — every call site must enforce its
    own authorization checks in Python (role, access_level, org membership)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
