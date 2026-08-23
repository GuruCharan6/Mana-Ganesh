from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import AuthUser, get_current_user
from app.authz import require_full_access, require_member
from app.schemas import PledgeCreate, PledgeResolveCash, PledgeResolveCollected
from app.supabase_admin import get_admin_client

router = APIRouter()


def _get_pledge_or_404(admin, pledge_id: str) -> dict:
    res = admin.table("chanda_pledges").select("*").eq("id", pledge_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pledge not found")
    return res.data[0]


@router.get("/orgs/{org_id}/pledges")
def list_pledges(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("chanda_pledges")
        .select("*")
        .eq("org_id", org_id)
        .eq("status", "pending")
        .order("promised_on")
        .execute()
    )
    return res.data


@router.post("/orgs/{org_id}/pledges", status_code=status.HTTP_201_CREATED)
def create_pledge(
    org_id: str, body: PledgeCreate, user: AuthUser = Depends(get_current_user)
):
    require_full_access(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("chanda_pledges")
        .insert(
            {
                "org_id": org_id,
                "donor_name": body.donor_name,
                "donor_mobile": body.donor_mobile,
                "item_description": body.item_description,
                "promised_on": (body.promised_on or date.today()).isoformat(),
                "area": body.area,
                "book_reference": body.book_reference,
                "promised_amount": body.promised_amount,
                "created_by": user.id,
            }
        )
        .execute()
    )
    return res.data[0]


@router.post("/pledges/{pledge_id}/resolve-collected", status_code=status.HTTP_201_CREATED)
def resolve_pledge_collected(
    pledge_id: str, body: PledgeResolveCollected, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    pledge = _get_pledge_or_404(admin, pledge_id)
    require_full_access(pledge["org_id"], user.id)

    if pledge["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pledge already resolved")

    entry = (
        admin.table("chanda_entries")
        .insert(
            {
                "org_id": pledge["org_id"],
                "donor_name": pledge["donor_name"],
                "donor_mobile": pledge["donor_mobile"],
                "amount": body.value or 0,
                "collected_on": (body.collected_on or date.today()).isoformat(),
                "area": pledge.get("area"),
                "book_reference": pledge.get("book_reference"),
                "item_description": pledge["item_description"],
                "pledge_id": pledge["id"],
                "collected_by": user.id,
            }
        )
        .execute()
    ).data[0]

    admin.table("chanda_pledges").update(
        {"status": "resolved", "resolved_chanda_entry_id": entry["id"]}
    ).eq("id", pledge_id).execute()

    return entry


@router.post("/pledges/{pledge_id}/resolve-cash", status_code=status.HTTP_201_CREATED)
def resolve_pledge_cash(
    pledge_id: str, body: PledgeResolveCash, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    pledge = _get_pledge_or_404(admin, pledge_id)
    require_full_access(pledge["org_id"], user.id)

    if pledge["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pledge already resolved")

    entry = (
        admin.table("chanda_entries")
        .insert(
            {
                "org_id": pledge["org_id"],
                "donor_name": pledge["donor_name"],
                "donor_mobile": pledge["donor_mobile"],
                "amount": body.amount,
                "collected_on": (body.collected_on or date.today()).isoformat(),
                "area": pledge.get("area"),
                "book_reference": pledge.get("book_reference"),
                "item_description": pledge["item_description"],  # what was originally promised, even though cash was given instead
                "pledge_id": pledge["id"],
                "collected_by": user.id,
            }
        )
        .execute()
    ).data[0]

    admin.table("chanda_pledges").update(
        {"status": "resolved", "resolved_chanda_entry_id": entry["id"]}
    ).eq("id", pledge_id).execute()

    return entry
