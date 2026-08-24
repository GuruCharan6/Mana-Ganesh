import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.auth import AuthUser, get_current_user
from app.authz import require_admin, require_full_access, require_member
from app.schemas import ExpenseAdjustCreate, ExpenseCommentCreate, ExpenseUpdate
from app.supabase_admin import get_admin_client

router = APIRouter()

RECEIPT_BUCKET = "expense-receipts"
MAX_RECEIPT_BYTES = 5 * 1024 * 1024
ALLOWED_RECEIPT_TYPES = {"image/png": "png", "image/jpeg": "jpg"}


def _member_name_map(admin, org_id: str) -> dict[str, str]:
    res = admin.table("org_members").select("user_id, name").eq("org_id", org_id).execute()
    return {row["user_id"]: row["name"] for row in res.data if row["user_id"]}


def _get_entry_or_404(admin, entry_id: str) -> dict:
    res = admin.table("expense_entries").select("*").eq("id", entry_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return res.data[0]


async def _upload_receipt(admin, org_id: str, file: UploadFile) -> str:
    ext = ALLOWED_RECEIPT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt must be PNG or JPEG",
        )
    body = await file.read()
    if len(body) > MAX_RECEIPT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt must be 5MB or smaller",
        )
    path = f"{org_id}/{uuid.uuid4()}.{ext}"
    admin.storage.from_(RECEIPT_BUCKET).upload(
        path, body, {"content-type": file.content_type}
    )
    return admin.storage.from_(RECEIPT_BUCKET).get_public_url(path)


# ---------------------------------------------------------------------------
# List / create
# ---------------------------------------------------------------------------


@router.get("/orgs/{org_id}/expenses")
def list_expenses(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("expense_entries")
        .select("*")
        .eq("org_id", org_id)
        .order("expense_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    names = _member_name_map(admin, org_id)
    return [
        {**row, "logged_by_name": names.get(row["logged_by"], "Unknown")}
        for row in res.data
    ]


@router.post("/orgs/{org_id}/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    org_id: str,
    category: str = Form(...),
    amount: float = Form(...),
    expense_date: date = Form(...),
    vendor_name: str | None = Form(None),
    receipt: UploadFile | None = File(None),
    user: AuthUser = Depends(get_current_user),
):
    require_full_access(org_id, user.id)

    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    if category == "Other" and not (vendor_name and vendor_name.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Describe what this expense was for",
        )

    admin = get_admin_client()

    receipt_url = None
    if receipt is not None and receipt.filename:
        receipt_url = await _upload_receipt(admin, org_id, receipt)

    res = (
        admin.table("expense_entries")
        .insert(
            {
                "org_id": org_id,
                "category": category,
                "vendor_name": vendor_name,
                "amount": round(amount, 2),
                "expense_date": expense_date.isoformat(),
                "receipt_url": receipt_url,
                "logged_by": user.id,
            }
        )
        .execute()
    )
    return res.data[0]


# ---------------------------------------------------------------------------
# Detail / comments / adjustments
# ---------------------------------------------------------------------------


@router.get("/expenses/{entry_id}")
def get_expense_detail(entry_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_member(entry["org_id"], user.id)

    names = _member_name_map(admin, entry["org_id"])

    comments_res = (
        admin.table("expense_comments")
        .select("*")
        .eq("expense_entry_id", entry_id)
        .order("created_at")
        .execute()
    )
    comments = [
        {**c, "commented_by_name": names.get(c["commented_by"], "Unknown")}
        for c in comments_res.data
    ]

    adjustments_res = (
        admin.table("expense_entries")
        .select("*")
        .eq("adjustment_for", entry_id)
        .order("created_at")
        .execute()
    )
    adjustments = [
        {**a, "logged_by_name": names.get(a["logged_by"], "Unknown")}
        for a in adjustments_res.data
    ]

    return {
        "entry": {**entry, "logged_by_name": names.get(entry["logged_by"], "Unknown")},
        "comments": comments,
        "adjustments": adjustments,
    }


@router.post("/expenses/{entry_id}/comments", status_code=status.HTTP_201_CREATED)
def add_expense_comment(
    entry_id: str, body: ExpenseCommentCreate, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_full_access(entry["org_id"], user.id)

    res = (
        admin.table("expense_comments")
        .insert(
            {
                "expense_entry_id": entry_id,
                "commented_by": user.id,
                "comment": body.comment,
            }
        )
        .execute()
    )
    return res.data[0]


@router.patch("/expenses/{entry_id}")
async def update_expense(
    entry_id: str,
    category: str | None = Form(None),
    amount: float | None = Form(None),
    expense_date: date | None = Form(None),
    vendor_name: str | None = Form(None),
    receipt: UploadFile | None = File(None),
    user: AuthUser = Depends(get_current_user),
):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_admin(entry["org_id"], user.id)

    body = ExpenseUpdate(
        category=category, amount=amount, expense_date=expense_date, vendor_name=vendor_name
    )
    update = {
        k: v
        for k, v in {
            "category": body.category,
            "vendor_name": body.vendor_name,
            "amount": body.amount,
            "expense_date": body.expense_date.isoformat() if body.expense_date else None,
        }.items()
        if v is not None
    }
    if receipt is not None and receipt.filename:
        update["receipt_url"] = await _upload_receipt(admin, entry["org_id"], receipt)

    if not update:
        return entry

    res = admin.table("expense_entries").update(update).eq("id", entry_id).execute()
    return res.data[0]


@router.delete("/expenses/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(entry_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    entry = _get_entry_or_404(admin, entry_id)
    require_admin(entry["org_id"], user.id)

    admin.table("expense_entries").delete().eq("id", entry_id).execute()


@router.post("/expenses/{entry_id}/adjust", status_code=status.HTTP_201_CREATED)
def adjust_expense(
    entry_id: str, body: ExpenseAdjustCreate, user: AuthUser = Depends(get_current_user)
):
    admin = get_admin_client()
    original = _get_entry_or_404(admin, entry_id)
    require_full_access(original["org_id"], user.id)

    admin.table("expense_comments").insert(
        {
            "expense_entry_id": entry_id,
            "commented_by": user.id,
            "comment": body.note,
        }
    ).execute()

    adjustment = (
        admin.table("expense_entries")
        .insert(
            {
                "org_id": original["org_id"],
                "category": body.category or original["category"],
                "vendor_name": body.vendor_name if body.vendor_name is not None else original["vendor_name"],
                "amount": body.amount,
                "expense_date": (
                    body.expense_date.isoformat() if body.expense_date else original["expense_date"]
                ),
                "logged_by": user.id,
                "adjustment_for": entry_id,
            }
        )
        .execute()
    )
    return adjustment.data[0]
