from app.supabase_admin import get_admin_client


def log_change(
    org_id: str,
    entry_type: str,
    entry_id: str,
    action: str,
    changed_by: str,
    old_values: dict,
    new_values: dict | None,
) -> None:
    """Record a full before/after snapshot of an Admin edit or delete.

    Only chanda/expense/lucky_draw entries go through this — the only tables
    where Admin can bypass the normal immutable/append-only rule.
    """
    admin = get_admin_client()
    admin.table("audit_log").insert(
        {
            "org_id": org_id,
            "entry_type": entry_type,
            "entry_id": entry_id,
            "action": action,
            "changed_by": changed_by,
            "old_values": old_values,
            "new_values": new_values,
        }
    ).execute()
