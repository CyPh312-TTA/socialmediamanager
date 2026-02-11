"""Routes for the Visual Feed Planner (Instagram grid preview)."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.feed_planner import (
    FeedGridItem,
    FeedGridResponse,
    ReorderRequest,
    ReorderResponse,
)
from app.services import feed_planner_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feed-planner", tags=["feed-planner"])


@router.get("/{account_id}", response_model=FeedGridResponse)
async def get_feed_preview(
    account_id: str,
    limit: int = Query(18, ge=3, le=60, description="Number of grid slots to return"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the Instagram feed grid preview for an account.

    Returns published and scheduled posts laid out in a 3-column grid,
    with scheduled posts occupying the top rows (newest-to-be-published
    first) followed by already-published posts.
    """
    data = await feed_planner_service.get_feed_preview(
        social_account_id=account_id,
        user_id=user.id,
        db=db,
        limit=limit,
    )

    items = [FeedGridItem(**item) for item in data["items"]]

    return FeedGridResponse(
        account_id=data["account_id"],
        platform="instagram",
        items=items,
        total_published=data["total_published"],
        total_scheduled=data["total_scheduled"],
    )


@router.put("/{account_id}/reorder", response_model=ReorderResponse)
async def reorder_scheduled_posts(
    account_id: str,
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder scheduled posts for the Instagram feed grid.

    Accepts a list of post IDs in the desired visual order (top-left to
    bottom-right).  The service redistributes the scheduled times so the
    chronological publication order matches the requested grid layout.
    """
    result = await feed_planner_service.reorder_scheduled_posts(
        social_account_id=account_id,
        user_id=user.id,
        ordered_post_ids=body.post_ids,
        db=db,
    )

    return ReorderResponse(
        success=result["success"],
        message=result["message"],
    )
