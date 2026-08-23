import time

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from postgrest.exceptions import APIError

from app.auth import AuthUser, get_current_user
from app.authz import count_admins, get_member_row, require_admin
from app.schemas import (
    AddMemberRequest,
    CreateOrgRequest,
    LinkPendingMemberResponse,
    UpdateMemberRequest,
    UpdateOrgRequest,
)
from app.supabase_admin import get_admin_client

router = APIRouter()

LOGO_BUCKET = "org-logos"
MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg"}


# ---------------------------------------------------------------------------
# Auth linking
# ---------------------------------------------------------------------------


@router.post("/auth/link-pending-member", response_model=LinkPendingMemberResponse)
def link_pending_member(user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()

    existing = (
        admin.table("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("status", "joined")
        .limit(1)
        .execute()
    )
    if existing.data:
        return LinkPendingMemberResponse(org_id=existing.data[0]["org_id"], linked=False)

    if not user.email:
        return LinkPendingMemberResponse(org_id=None, linked=False)

    target = user.email.strip().lower()
    pending = (
        admin.table("org_members")
        .select("*")
        .eq("status", "pending")
        .is_("user_id", "null")
        .order("created_at")
        .execute()
    )
    match = next(
        (row for row in pending.data if row["email"].strip().lower() == target),
        None,
    )
    if match is None:
        return LinkPendingMemberResponse(org_id=None, linked=False)

    admin.table("org_members").update(
        {"user_id": user.id, "status": "joined"}
    ).eq("id", match["id"]).execute()

    return LinkPendingMemberResponse(org_id=match["org_id"], linked=True)


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


@router.get("/orgs/{org_id}/public-brand")
def get_public_brand(org_id: str):
    # Deliberately unauthenticated — the PWA manifest (name + icon) must be
    # fetchable by Chrome/Android's WebAPK install pipeline, which has no
    # user session. Only non-sensitive branding fields are exposed here.
    admin = get_admin_client()
    res = (
        admin.table("organizations")
        .select("name, logo_url")
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return res.data[0]


@router.post("/orgs", status_code=status.HTTP_201_CREATED)
def create_org(body: CreateOrgRequest, user: AuthUser = Depends(get_current_user)):
    admin = get_admin_client()

    org_res = (
        admin.table("organizations")
        .insert({"name": body.org_name, "created_by": user.id})
        .execute()
    )
    org = org_res.data[0]

    admin.table("org_members").insert(
        {
            "org_id": org["id"],
            "user_id": user.id,
            "name": body.admin_name,
            "email": user.email or "",
            "status": "joined",
            "role": "admin",
            "access_level": "full",
            "added_by": user.id,
        }
    ).execute()

    return org


@router.get("/orgs/{org_id}")
def get_org(org_id: str, user: AuthUser = Depends(get_current_user)):
    if get_member_row(org_id, user.id) is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    admin = get_admin_client()
    res = admin.table("organizations").select("*").eq("id", org_id).single().execute()
    return res.data


@router.patch("/orgs/{org_id}")
def update_org(
    org_id: str, body: UpdateOrgRequest, user: AuthUser = Depends(get_current_user)
):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    res = (
        admin.table("organizations")
        .update({"name": body.name})
        .eq("id", org_id)
        .execute()
    )
    return res.data[0]


@router.patch("/orgs/{org_id}/logo")
async def upload_logo(
    org_id: str, file: UploadFile, user: AuthUser = Depends(get_current_user)
):
    require_admin(org_id, user.id)

    ext = ALLOWED_LOGO_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo must be PNG or JPEG",
        )

    body = await file.read()
    if len(body) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo must be 2MB or smaller",
        )

    admin = get_admin_client()
    # Unique path per upload — Supabase Storage's CDN caches by object path and
    # ignores query strings, so overwriting a fixed path (with a `?t=` cache-bust
    # on the URL) still served the old cached bytes. A new path forces a cache miss.
    path = f"{org_id}/logo-{int(time.time())}.{ext}"
    admin.storage.from_(LOGO_BUCKET).upload(
        path,
        body,
        {"content-type": file.content_type, "upsert": "true"},
    )
    logo_url = admin.storage.from_(LOGO_BUCKET).get_public_url(path)

    admin.table("organizations").update({"logo_url": logo_url}).eq("id", org_id).execute()

    return {"logo_url": logo_url}


@router.delete("/orgs/{org_id}/logo")
def delete_logo(org_id: str, user: AuthUser = Depends(get_current_user)):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    admin.table("organizations").update({"logo_url": None}).eq("id", org_id).execute()

    return {"logo_url": None}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@router.get("/orgs/{org_id}/members")
def list_members(org_id: str, user: AuthUser = Depends(get_current_user)):
    if get_member_row(org_id, user.id) is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    admin = get_admin_client()
    res = (
        admin.table("org_members")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at")
        .execute()
    )
    return res.data


@router.post("/orgs/{org_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    org_id: str, body: AddMemberRequest, user: AuthUser = Depends(get_current_user)
):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    try:
        res = (
            admin.table("org_members")
            .insert(
                {
                    "org_id": org_id,
                    "name": body.name,
                    "email": body.email,
                    "status": "pending",
                    "role": "member",
                    "access_level": "full",
                    "added_by": user.id,
                }
            )
            .execute()
        )
    except APIError as exc:
        if exc.code == "23505":  # unique_violation on (org_id, email)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A member with this email already exists",
            ) from exc
        raise

    return res.data[0]


@router.patch("/orgs/{org_id}/members/{member_id}")
def update_member(
    org_id: str,
    member_id: str,
    body: UpdateMemberRequest,
    user: AuthUser = Depends(get_current_user),
):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    existing = (
        admin.table("org_members")
        .select("*")
        .eq("id", member_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member = existing.data[0]

    update: dict = {}
    becoming_admin = False

    if body.role is not None:
        if body.role not in ("admin", "member"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="role must be 'admin' or 'member'",
            )
        if member["status"] != "joined":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role of a pending member",
            )
        if body.role != member["role"]:
            if body.role == "admin":
                update["role"] = "admin"
                update["access_level"] = "full"
                becoming_admin = True
            else:  # demote
                if member["role"] == "admin" and count_admins(org_id) <= 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot remove the last admin",
                    )
                update["role"] = "member"

    is_admin_row = member["role"] == "admin" and "role" not in update

    if body.name is not None or body.email is not None:
        if member["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Joined members own their own name/email",
            )
        if body.name is not None:
            update["name"] = body.name
        if body.email is not None:
            update["email"] = body.email

    if body.access_level is not None:
        if is_admin_row or becoming_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin is always Full Access",
            )
        if member["status"] != "joined":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set access level on a pending member",
            )
        if body.access_level not in ("full", "view_only"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="access_level must be 'full' or 'view_only'",
            )
        update["access_level"] = body.access_level

    if not update:
        return member

    try:
        res = (
            admin.table("org_members")
            .update(update)
            .eq("id", member_id)
            .execute()
        )
    except APIError as exc:
        if exc.code == "23505":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A member with this email already exists",
            ) from exc
        raise

    return res.data[0]


@router.delete("/orgs/{org_id}/members/{member_id}")
def remove_member(
    org_id: str, member_id: str, user: AuthUser = Depends(get_current_user)
):
    require_admin(org_id, user.id)

    admin = get_admin_client()
    existing = (
        admin.table("org_members")
        .select("role")
        .eq("id", member_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if existing.data[0]["role"] == "admin" and count_admins(org_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last admin",
        )

    admin.table("org_members").delete().eq("id", member_id).execute()
    return {"ok": True}
