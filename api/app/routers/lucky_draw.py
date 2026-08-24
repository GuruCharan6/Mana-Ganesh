from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import AuthUser, get_current_user
from app.authz import require_admin, require_full_access, require_member
from app.schemas import LuckyDrawCreate, LuckyDrawUpdate
from app.supabase_admin import get_admin_client

router = APIRouter()


def _member_name_map(admin, org_id: str) -> dict[str, str]:
    res = admin.table("org_members").select("user_id, name").eq("org_id", org_id).execute()
    return {row["user_id"]: row["name"] for row in res.data if row["user_id"]}


def _get_ticket_or_404(admin, ticket_id: str) -> dict:
    res = admin.table("lucky_draw_entries").select("*").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return res.data[0]


@router.get("/orgs/{org_id}/lucky-draw")
def list_lucky_draw(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("lucky_draw_entries")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    names = _member_name_map(admin, org_id)
    return [{**row, "sold_by_name": names.get(row["sold_by"], "Unknown")} for row in res.data]


@router.get("/lucky-draw/{ticket_id}")
def get_lucky_draw_ticket(ticket_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    ticket = _get_ticket_or_404(admin, ticket_id)
    require_member(ticket["org_id"], user.id)

    names = _member_name_map(admin, ticket["org_id"])
    return {**ticket, "sold_by_name": names.get(ticket["sold_by"], "Unknown")}


@router.post("/orgs/{org_id}/lucky-draw", status_code=status.HTTP_201_CREATED)
def create_lucky_draw(
    org_id: str, body: LuckyDrawCreate, user: AuthUser = Depends(get_current_user)
):
    require_full_access(org_id, user.id)

    admin = get_admin_client()
    org = (
        admin.table("organizations")
        .select("lucky_draw_ticket_price")
        .eq("id", org_id)
        .limit(1)
        .execute()
        .data
    )
    price = org[0]["lucky_draw_ticket_price"] if org else None
    if not price or price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set a ticket price in Settings before selling tickets",
        )

    # Amount is always server-computed from the configured ticket price —
    # never trust a client-supplied amount for this. One row per ticket, not
    # per purchase, so each ticket is independently eligible for a draw.
    rows = [
        {
            "org_id": org_id,
            "buyer_name": t.buyer_name,
            "buyer_mobile": t.buyer_mobile,
            "buyer_address": t.buyer_address,
            "amount": price,
            "payment_method": body.payment_method,
            "sold_by": user.id,
        }
        for t in body.tickets
    ]
    res = admin.table("lucky_draw_entries").insert(rows).execute()
    return res.data


@router.patch("/lucky-draw/{ticket_id}")
def update_lucky_draw_ticket(
    ticket_id: str, body: LuckyDrawUpdate, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    ticket = _get_ticket_or_404(admin, ticket_id)
    require_admin(ticket["org_id"], user.id)

    # See chanda.update_chanda for why this uses model_fields_set rather than
    # filtering on `is not None` — an explicitly cleared field must still be
    # distinguishable from a field that was never sent.
    provided = body.model_fields_set
    field_map = {
        "buyer_name": body.buyer_name,
        "buyer_mobile": body.buyer_mobile,
        "buyer_address": body.buyer_address,
        "amount": body.amount,
        "payment_method": body.payment_method,
    }
    update = {k: v for k, v in field_map.items() if k in provided}
    if not update:
        return ticket

    res = admin.table("lucky_draw_entries").update(update).eq("id", ticket_id).execute()
    return res.data[0]


@router.post("/lucky-draw/{ticket_id}/mark-thanked")
def mark_lucky_draw_thanked(ticket_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    ticket = _get_ticket_or_404(admin, ticket_id)
    require_full_access(ticket["org_id"], user.id)

    res = (
        admin.table("lucky_draw_entries")
        .update({"receipt_sent_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", ticket_id)
        .execute()
    )
    return res.data[0]


@router.delete("/lucky-draw/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lucky_draw_ticket(ticket_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    ticket = _get_ticket_or_404(admin, ticket_id)
    require_admin(ticket["org_id"], user.id)

    admin.table("lucky_draw_entries").delete().eq("id", ticket_id).execute()
