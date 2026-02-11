from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.content_category import (
    CategoryCreate,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdate,
    RecyclablePostsResponse,
    RecycleQueueAdd,
    RecycleQueueItemResponse,
    RecycleQueueResponse,
)
from app.schemas.post import PostListResponse, PostResponse
from app.services import content_category_service

router = APIRouter(prefix="/content", tags=["content-categories"])


# ---------------------------------------------------------------------------
# Category CRUD
# ---------------------------------------------------------------------------


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new content category."""
    category = await content_category_service.create_category(
        user_id=user.id,
        data=data.model_dump(exclude_unset=True),
        db=db,
    )
    return CategoryResponse.model_validate(category)


@router.get("/categories", response_model=CategoryListResponse)
async def list_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all content categories for the authenticated user."""
    categories = await content_category_service.list_categories(user.id, db)
    return CategoryListResponse(
        items=[CategoryResponse.model_validate(c) for c in categories]
    )


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing content category."""
    category = await content_category_service.update_category(
        category_id=category_id,
        user_id=user.id,
        data=data.model_dump(exclude_unset=True),
        db=db,
    )
    return CategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a content category."""
    await content_category_service.delete_category(category_id, user.id, db)


# ---------------------------------------------------------------------------
# Post <-> Category assignments
# ---------------------------------------------------------------------------


@router.post(
    "/categories/{category_id}/posts/{post_id}",
    status_code=201,
    response_model=dict,
)
async def assign_post_to_category(
    category_id: str,
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a post to a content category."""
    link = await content_category_service.assign_post_to_category(
        post_id=post_id,
        category_id=category_id,
        user_id=user.id,
        db=db,
    )
    return {"id": link.id, "post_id": link.post_id, "category_id": link.category_id}


@router.delete("/categories/{category_id}/posts/{post_id}", status_code=204)
async def remove_post_from_category(
    category_id: str,
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a post from a content category."""
    await content_category_service.remove_post_from_category(
        post_id=post_id,
        category_id=category_id,
        user_id=user.id,
        db=db,
    )


# ---------------------------------------------------------------------------
# Recycling  (static paths registered BEFORE parameterized {category_id} ones)
# ---------------------------------------------------------------------------


@router.get("/categories/recyclable", response_model=RecyclablePostsResponse)
async def get_recyclable_posts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all posts that are eligible for recycling (published, in recyclable
    categories, and past their recycle interval)."""
    items = await content_category_service.get_recyclable_posts(user.id, db)
    return RecyclablePostsResponse(items=items)


@router.post("/categories/recycle-queue", response_model=RecycleQueueItemResponse, status_code=201)
async def add_to_recycle_queue(
    data: RecycleQueueAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a post to the recycle queue for future re-publishing."""
    item = await content_category_service.add_to_recycle_queue(
        post_id=data.post_id,
        category_id=data.category_id,
        user_id=user.id,
        scheduled_for=data.scheduled_for,
        db=db,
    )
    # Fetch enriched data for the response
    queue_items = await content_category_service.get_recycle_queue(user.id, db)
    for qi in queue_items:
        if qi["id"] == item.id:
            return RecycleQueueItemResponse(**qi)

    # Fallback: return minimal data from the created item
    return RecycleQueueItemResponse(
        id=item.id,
        post_id=item.post_id,
        post_title="",
        category_id=item.category_id,
        category_name="",
        scheduled_for=item.scheduled_for,
        status=item.status,
        times_recycled=item.times_recycled,
        created_at=item.created_at,
    )


@router.get("/categories/recycle-queue", response_model=RecycleQueueResponse)
async def get_recycle_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """View the pending recycle queue for the authenticated user."""
    items = await content_category_service.get_recycle_queue(user.id, db)
    return RecycleQueueResponse(items=items)


# ---------------------------------------------------------------------------
# Posts in a category (parameterized paths after static ones)
# ---------------------------------------------------------------------------


@router.get("/categories/{category_id}/posts", response_model=PostListResponse)
async def get_posts_by_category(
    category_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all posts belonging to a specific category."""
    posts, total = await content_category_service.get_posts_by_category(
        category_id=category_id,
        user_id=user.id,
        db=db,
        skip=skip,
        limit=limit,
    )
    return PostListResponse(
        items=[
            PostResponse(
                id=p.id,
                caption=p.caption,
                hashtags=None,
                status=p.status,
                post_type=p.post_type,
                ai_generated=p.ai_generated,
                created_at=p.created_at,
                updated_at=p.updated_at,
                platforms=[],
            )
            for p in posts
        ],
        total=total,
    )
