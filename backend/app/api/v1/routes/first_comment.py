import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.post import PostPlatform
from app.models.user import User
from app.schemas.first_comment import FirstCommentCreate, FirstCommentResponse
from app.services import first_comment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/first-comment", tags=["first-comment"])


async def _verify_ownership(
    post_platform_id: str,
    user: User,
    db: AsyncSession,
) -> PostPlatform:
    """Ensure the PostPlatform belongs to a post owned by the requesting user."""
    from app.models.post import Post

    result = await db.execute(
        select(PostPlatform)
        .join(Post, Post.id == PostPlatform.post_id)
        .where(
            PostPlatform.id == post_platform_id,
            Post.user_id == user.id,
        )
    )
    pp = result.scalar_one_or_none()
    if pp is None:
        raise NotFoundError("Post platform entry not found")
    return pp


@router.post("/", response_model=FirstCommentResponse, status_code=201)
async def schedule_first_comment(
    data: FirstCommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule a first comment for a specific post platform entry.

    The comment will be posted automatically after the parent post is
    published, with an optional delay.
    """
    # Verify the user owns the post
    await _verify_ownership(data.post_platform_id, user, db)

    first_comment = await first_comment_service.schedule_first_comment(
        post_platform_id=data.post_platform_id,
        comment_text=data.comment_text,
        delay_seconds=data.delay_seconds,
        db=db,
    )

    return FirstCommentResponse.model_validate(first_comment)


@router.get("/{post_platform_id}", response_model=FirstCommentResponse)
async def get_first_comment(
    post_platform_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the first comment status for a given post platform entry."""
    # Verify the user owns the post
    await _verify_ownership(post_platform_id, user, db)

    first_comment = await first_comment_service.get_first_comment_for_post_platform(
        post_platform_id, db
    )
    if first_comment is None:
        raise NotFoundError("No first comment found for this post platform entry")

    return FirstCommentResponse.model_validate(first_comment)
