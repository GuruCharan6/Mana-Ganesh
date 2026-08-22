import logging
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger("app.auth")


class AuthUser(BaseModel):
    id: str
    phone: str | None = None
    email: str | None = None


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Newer Supabase projects sign tokens asymmetrically (ES256/RS256) with
    # rotating keys, verified via this JWKS endpoint, instead of a static
    # shared secret.
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> dict:
    # Try the legacy static HS256 secret first (cheap, no network call);
    # fall back to JWKS-based asymmetric verification.
    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except (jwt.InvalidSignatureError, jwt.InvalidAlgorithmError):
            logger.warning("Token isn't HS256, trying JWKS")
        except jwt.PyJWTError as exc:
            logger.warning("HS256 decode failed: %r", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from exc

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        logger.warning("JWKS decode failed: %r", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    payload = _decode(credentials.credentials)
    return AuthUser(
        id=payload["sub"],
        phone=payload.get("phone"),
        email=payload.get("email"),
    )
