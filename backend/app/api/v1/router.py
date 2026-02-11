from fastapi import APIRouter

from app.api.v1.routes import (
    ai,
    analytics,
    auth,
    best_time,
    bulk_schedule,
    content_categories,
    feed_planner,
    first_comment,
    inbox,
    link_in_bio,
    media,
    posts,
    settings,
    social_accounts,
    strategy,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(social_accounts.router)
api_router.include_router(posts.router)
api_router.include_router(media.router)
api_router.include_router(ai.router)
api_router.include_router(analytics.router)
api_router.include_router(settings.router)
api_router.include_router(link_in_bio.router)
api_router.include_router(strategy.router)
api_router.include_router(best_time.router)
api_router.include_router(inbox.router)
api_router.include_router(bulk_schedule.router)
api_router.include_router(first_comment.router)
api_router.include_router(content_categories.router)
api_router.include_router(feed_planner.router)
