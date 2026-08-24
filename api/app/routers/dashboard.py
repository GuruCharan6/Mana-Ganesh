from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends

from app.auth import AuthUser, get_current_user
from app.authz import require_admin, require_member
from app.supabase_admin import get_admin_client

router = APIRouter()


@router.get("/orgs/{org_id}/dashboard")
def get_dashboard(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    chanda = admin.table("chanda_entries").select("amount").eq("org_id", org_id).execute()
    expenses = admin.table("expense_entries").select("amount").eq("org_id", org_id).execute()
    lucky_draw = (
        admin.table("lucky_draw_entries").select("amount").eq("org_id", org_id).execute()
    )

    collected = round(sum(row["amount"] for row in chanda.data), 2)
    spent = round(sum(row["amount"] for row in expenses.data), 2)
    lucky_draw_total = round(sum(row["amount"] for row in lucky_draw.data), 2)

    return {
        "total_collected": collected,
        "total_spent": spent,
        "balance": round(collected - spent, 2),
        # Lucky Draw money is deliberately excluded from collected/spent/balance
        # — it's a separate fundraising activity, shown here only as its own
        # figure for Settings to display alongside the other two.
        "total_lucky_draw": lucky_draw_total,
    }


@router.get("/orgs/{org_id}/compliance")
def get_compliance(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    members = (
        admin.table("org_members")
        .select("user_id, name")
        .eq("org_id", org_id)
        .eq("status", "joined")
        .execute()
    )

    entries = (
        admin.table("chanda_entries")
        .select("collected_by, entered_on")
        .eq("org_id", org_id)
        .execute()
    )

    today = date.today()
    rows = []
    for m in members.data:
        mine = [e for e in entries.data if e["collected_by"] == m["user_id"]]
        entries_today = sum(
            1
            for e in mine
            if datetime.fromisoformat(e["entered_on"]).astimezone(timezone.utc).date() == today
        )
        last_entered = max((e["entered_on"] for e in mine), default=None)
        rows.append(
            {
                "member_id": m["user_id"],
                "name": m["name"],
                "entries_today": entries_today,
                "last_entered_on": last_entered,
            }
        )

    rows.sort(key=lambda r: (-r["entries_today"], r["name"]))
    return rows
