from fastapi import APIRouter

from app.api.v1.routes import ai, auth, media, posts, social_accounts

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(social_accounts.router)
api_router.include_router(posts.router)
api_router.include_router(media.router)
api_router.include_router(ai.router)
