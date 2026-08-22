from fastapi import HTTPException, status

from app.supabase_admin import get_admin_client


def get_member_row(org_id: str, user_id: str) -> dict | None:
    admin = get_admin_client()
    res = (
        admin.table("org_members")
        .select("*")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .eq("status", "joined")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def require_admin(org_id: str, user_id: str) -> dict:
    member = get_member_row(org_id, user_id)
    if member is None or member["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return member


def require_member(org_id: str, user_id: str) -> dict:
    member = get_member_row(org_id, user_id)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization",
        )
    return member


def require_full_access(org_id: str, user_id: str) -> dict:
    member = get_member_row(org_id, user_id)
    if member is None or (member["access_level"] != "full" and member["role"] != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Full access required",
        )
    return member


def count_admins(org_id: str) -> int:
    admin = get_admin_client()
    res = (
        admin.table("org_members")
        .select("id", count="exact")
        .eq("org_id", org_id)
        .eq("role", "admin")
        .eq("status", "joined")
        .execute()
    )
    return res.count or 0
