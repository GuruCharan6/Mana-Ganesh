import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.auth import AuthUser, get_current_user
from app.authz import require_full_access, require_member
from app.supabase_admin import get_admin_client

router = APIRouter()

IMAGE_BUCKET = "announcement-images"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png": "png", "image/jpeg": "jpg"}


def _member_name_map(admin, org_id: str) -> dict[str, str]:
    res = admin.table("org_members").select("user_id, name").eq("org_id", org_id).execute()
    return {row["user_id"]: row["name"] for row in res.data if row["user_id"]}


def _get_announcement_or_404(admin, announcement_id: str) -> dict:
    res = admin.table("announcements").select("*").eq("id", announcement_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    return res.data[0]


async def _upload_image(admin, org_id: str, file: UploadFile) -> str:
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be PNG or JPEG",
        )
    body = await file.read()
    if len(body) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be 5MB or smaller",
        )
    path = f"{org_id}/{uuid.uuid4()}.{ext}"
    admin.storage.from_(IMAGE_BUCKET).upload(path, body, {"content-type": file.content_type})
    return admin.storage.from_(IMAGE_BUCKET).get_public_url(path)


@router.get("/orgs/{org_id}/announcements")
def list_announcements(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_member(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("announcements")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    names = _member_name_map(admin, org_id)
    return [
        {**row, "posted_by_name": names.get(row["posted_by"], "Unknown")}
        for row in res.data
    ]


@router.post("/orgs/{org_id}/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    org_id: str,
    body: str = Form(...),
    image: UploadFile | None = File(None),
    user: AuthUser = Depends(get_current_user),
):
    require_full_access(org_id, user.id)
    if not body.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Announcement text is required")

    admin = get_admin_client()

    image_url = None
    if image is not None and image.filename:
        image_url = await _upload_image(admin, org_id, image)

    res = (
        admin.table("announcements")
        .insert(
            {
                "org_id": org_id,
                "posted_by": user.id,
                "body": body.strip(),
                "image_url": image_url,
            }
        )
        .execute()
    )
    return res.data[0]


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    body: str | None = Form(None),
    image: UploadFile | None = File(None),
    user: AuthUser = Depends(get_current_user),
):
    admin = get_admin_client()
    existing = _get_announcement_or_404(admin, announcement_id)
    require_full_access(existing["org_id"], user.id)

    update: dict = {"updated_at": datetime.now(timezone.utc).isoformat(), "edited_by": user.id}
    if body is not None and body.strip():
        update["body"] = body.strip()
    if image is not None and image.filename:
        update["image_url"] = await _upload_image(admin, existing["org_id"], image)

    res = admin.table("announcements").update(update).eq("id", announcement_id).execute()
    return res.data[0]


@router.delete("/announcements/{announcement_id}")
def delete_announcement(announcement_id: str, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()
    existing = _get_announcement_or_404(admin, announcement_id)
    require_full_access(existing["org_id"], user.id)

    admin.table("announcements").delete().eq("id", announcement_id).execute()
    return {"ok": True}
