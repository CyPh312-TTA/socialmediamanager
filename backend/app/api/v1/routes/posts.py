import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.post import PostCreate, PostListResponse, PostPlatformStatus, PostResponse, PostUpdate
from app.services import post_service

router = APIRouter(prefix="/posts", tags=["posts"])


def _post_to_response(post) -> PostResponse:
    platforms = []
    for pp in getattr(post, "post_platforms", []):
        platforms.append(
            PostPlatformStatus(
                id=pp.id,
                platform=pp.social_account.platform if pp.social_account else "unknown",
                platform_username=(
                    pp.social_account.platform_username if pp.social_account else "unknown"
                ),
                status=pp.status,
                error_message=pp.error_message,
                published_at=pp.published_at,
            )
        )

    hashtags = None
    if post.hashtags:
        try:
            hashtags = json.loads(post.hashtags)
        except json.JSONDecodeError:
            hashtags = []

    return PostResponse(
        id=post.id,
        caption=post.caption,
        hashtags=hashtags,
        status=post.status,
        post_type=post.post_type,
        ai_generated=post.ai_generated,
        created_at=post.created_at,
        updated_at=post.updated_at,
        platforms=platforms,
    )


@router.post("/", response_model=PostResponse, status_code=201)
async def create_post(
    data: PostCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await post_service.create_post(data, user, db)
    return _post_to_response(post)


@router.get("/", response_model=PostListResponse)
async def list_posts(
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await post_service.list_posts(user, db, status=status, skip=skip, limit=limit)
    return PostListResponse(
        items=[_post_to_response(p) for p in items],
        total=total,
    )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await post_service.get_post(post_id, user, db)
    return _post_to_response(post)


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await post_service.delete_post(post_id, user, db)
