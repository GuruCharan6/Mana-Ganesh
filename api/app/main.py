from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import AuthUser, get_current_user
from app.config import settings
from app.routers.announcements import router as announcements_router
from app.routers.chanda import router as chanda_router
from app.routers.dashboard import router as dashboard_router
from app.routers.expenses import router as expenses_router
from app.routers.lucky_draw import router as lucky_draw_router
from app.routers.orgs import router as orgs_router
from app.routers.pledges import router as pledges_router

app = FastAPI(title="Mana Ganesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orgs_router)
app.include_router(chanda_router)
app.include_router(expenses_router)
app.include_router(dashboard_router)
app.include_router(announcements_router)
app.include_router(pledges_router)
app.include_router(lucky_draw_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def me(user: AuthUser = Depends(get_current_user)):
    return user
