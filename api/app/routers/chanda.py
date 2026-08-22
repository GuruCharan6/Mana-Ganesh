from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import AuthUser, get_current_user
from app.authz import require_full_access, require_member
from app.schemas import (
    ChandaAdjustCreate,
    ChandaBatchCreate,
    ChandaCommentCreate,
    ChandaCreate,
)
from app.supabase_admin import get_admin_client

router = APIRouter()


def _member_name_map(admin, org_id: str) -> dict[str, str]:
    res = admin.table("org_members").select("user_id, name").eq("org_id", org_id).execute()
    return {row["user_id"]: row["name"] for row in res.data if row["user_id"]}


def _get_entry_or_404(admin, entry_id: str) -> dict:
    res = admin.table("chanda_entries").select("*").eq("id", entry_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return res.data[0]


# ---------------------------------------------------------------------------
# List / create
# ---------------------------------------------------------------------------


@router.get("/orgs/{org_id}/chanda")
def list_chanda(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("chanda_entries")
        .select("*")
        .eq("org_id", org_id)
        .order("collected_on", desc=True)
        .order("entered_on", desc=True)
        .execute()
    )
    names = _member_name_map(admin, org_id)
    entries = [
        {**row, "collected_by_name": names.get(row["collected_by"], "Unknown")}
        for row in res.data
    ]
    return entries


@router.post("/orgs/{org_id}/chanda", status_code=status.HTTP_201_CREATED)
def create_chanda(
    org_id: str, body: ChandaCreate, user: AuthUser = Depends(get_current_user)
):
    require_full_access(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("chanda_entries")
        .insert(
            {
                "org_id": org_id,
                "donor_name": body.donor_name,
                "donor_mobile": body.donor_mobile,
                "amount": body.amount,
                "collected_on": body.collected_on.isoformat(),
                "area": body.area,
                "book_reference": body.book_reference,
                "item_description": body.item_description,
                "collected_by": user.id,
            }
        )
        .execute()
    )
    entry = res.data[0]
    entry["client_ref"] = body.client_ref
    return entry


@router.post("/orgs/{org_id}/chanda/batch", status_code=status.HTTP_201_CREATED)
def create_chanda_batch(
    org_id: str, body: ChandaBatchCreate, user: AuthUser = Depends(get_current_user)
):
    require_full_access(org_id, user.id)
    if not body.entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No entries provided"
        )

    admin = get_admin_client()
    rows = [
        {
            "org_id": org_id,
            "donor_name": e.donor_name,
            "donor_mobile": e.donor_mobile,
            "amount": e.amount,
            "collected_on": e.collected_on.isoformat(),
            "area": e.area,
            "book_reference": e.book_reference,
            "item_description": e.item_description,
            "collected_by": user.id,
        }
        for e in body.entries
    ]
    res = admin.table("chanda_entries").insert(rows).execute()

    created = res.data
    for entry, original in zip(created, body.entries):
        entry["client_ref"] = original.client_ref
    return created


# ---------------------------------------------------------------------------
# Detail / comments / adjustments
# ---------------------------------------------------------------------------


@router.get("/chanda/{entry_id}")
def get_chanda_detail(entry_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_member(entry["org_id"], user.id)

    names = _member_name_map(admin, entry["org_id"])

    comments_res = (
        admin.table("chanda_comments")
        .select("*")
        .eq("chanda_entry_id", entry_id)
        .order("created_at")
        .execute()
    )
    comments = [
        {**c, "commented_by_name": names.get(c["commented_by"], "Unknown")}
        for c in comments_res.data
    ]

    adjustments_res = (
        admin.table("chanda_entries")
        .select("*")
        .eq("adjustment_for", entry_id)
        .order("created_at")
        .execute()
    )
    adjustments = [
        {**a, "collected_by_name": names.get(a["collected_by"], "Unknown")}
        for a in adjustments_res.data
    ]

    return {
        "entry": {**entry, "collected_by_name": names.get(entry["collected_by"], "Unknown")},
        "comments": comments,
        "adjustments": adjustments,
    }


@router.post("/chanda/{entry_id}/comments", status_code=status.HTTP_201_CREATED)
def add_chanda_comment(
    entry_id: str, body: ChandaCommentCreate, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_full_access(entry["org_id"], user.id)

    res = (
        admin.table("chanda_comments")
        .insert(
            {
                "chanda_entry_id": entry_id,
                "commented_by": user.id,
                "comment": body.comment,
            }
        )
        .execute()
    )
    return res.data[0]


@router.post("/chanda/{entry_id}/adjust", status_code=status.HTTP_201_CREATED)
def adjust_chanda(
    entry_id: str, body: ChandaAdjustCreate, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    original = _get_entry_or_404(admin, entry_id)
    require_full_access(original["org_id"], user.id)

    admin.table("chanda_comments").insert(
        {
            "chanda_entry_id": entry_id,
            "commented_by": user.id,
            "comment": body.note,
        }
    ).execute()

    adjustment = (
        admin.table("chanda_entries")
        .insert(
            {
                "org_id": original["org_id"],
                "donor_name": body.donor_name or original["donor_name"],
                "donor_mobile": body.donor_mobile or original["donor_mobile"],
                "amount": body.amount,
                "collected_on": (
                    body.collected_on.isoformat() if body.collected_on else original["collected_on"]
                ),
                "area": body.area if body.area is not None else original["area"],
                "book_reference": (
                    body.book_reference if body.book_reference is not None else original["book_reference"]
                ),
                "collected_by": user.id,
                "adjustment_for": entry_id,
            }
        )
        .execute()
    )
    return adjustment.data[0]
