import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.content_category import ContentCategory, PostCategory, RecycleQueue
from app.models.post import Post, PostPlatform

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Category CRUD
# ---------------------------------------------------------------------------


async def create_category(
    user_id: str,
    data: dict,
    db: AsyncSession,
) -> ContentCategory:
    """Create a new content category for the user."""
    # Check for duplicate name within this user's categories
    existing = await db.execute(
        select(ContentCategory).where(
            ContentCategory.user_id == user_id,
            ContentCategory.name == data["name"],
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestError(f"Category '{data['name']}' already exists")

    category = ContentCategory(user_id=user_id, **data)
    db.add(category)
    await db.flush()
    return category


async def list_categories(
    user_id: str,
    db: AsyncSession,
) -> list[ContentCategory]:
    """Return all categories belonging to the user, ordered by name."""
    result = await db.execute(
        select(ContentCategory)
        .where(ContentCategory.user_id == user_id)
        .order_by(ContentCategory.name)
    )
    return list(result.scalars().all())


async def _get_category_for_user(
    category_id: str,
    user_id: str,
    db: AsyncSession,
) -> ContentCategory:
    """Fetch a single category ensuring it belongs to the user."""
    result = await db.execute(
        select(ContentCategory).where(
            ContentCategory.id == category_id,
            ContentCategory.user_id == user_id,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category not found")
    return category


async def update_category(
    category_id: str,
    user_id: str,
    data: dict,
    db: AsyncSession,
) -> ContentCategory:
    """Update an existing content category."""
    category = await _get_category_for_user(category_id, user_id, db)

    # If the name is being changed, check for duplicates
    new_name = data.get("name")
    if new_name and new_name != category.name:
        dup = await db.execute(
            select(ContentCategory).where(
                ContentCategory.user_id == user_id,
                ContentCategory.name == new_name,
                ContentCategory.id != category_id,
            )
        )
        if dup.scalar_one_or_none():
            raise BadRequestError(f"Category '{new_name}' already exists")

    for key, value in data.items():
        if value is not None:
            setattr(category, key, value)

    await db.flush()
    return category


async def delete_category(
    category_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """Delete a content category and all associated links."""
    category = await _get_category_for_user(category_id, user_id, db)
    await db.delete(category)
    await db.flush()


# ---------------------------------------------------------------------------
# Post <-> Category assignment
# ---------------------------------------------------------------------------


async def assign_post_to_category(
    post_id: str,
    category_id: str,
    user_id: str,
    db: AsyncSession,
) -> PostCategory:
    """Link a post to a category. Both must belong to the user."""
    # Validate category ownership
    category = await _get_category_for_user(category_id, user_id, db)

    # Validate post ownership
    post_result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user_id)
    )
    if not post_result.scalar_one_or_none():
        raise NotFoundError("Post not found")

    # Check if already assigned
    existing = await db.execute(
        select(PostCategory).where(
            PostCategory.post_id == post_id,
            PostCategory.category_id == category_id,
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestError("Post is already assigned to this category")

    link = PostCategory(post_id=post_id, category_id=category_id)
    db.add(link)

    # Increment post_count on the category
    category.post_count = category.post_count + 1

    await db.flush()
    return link


async def remove_post_from_category(
    post_id: str,
    category_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """Unlink a post from a category."""
    category = await _get_category_for_user(category_id, user_id, db)

    result = await db.execute(
        select(PostCategory).where(
            PostCategory.post_id == post_id,
            PostCategory.category_id == category_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Post is not assigned to this category")

    await db.delete(link)

    # Decrement post_count (floor at 0)
    category.post_count = max(0, category.post_count - 1)

    await db.flush()


async def get_posts_by_category(
    category_id: str,
    user_id: str,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Post], int]:
    """Return posts that belong to a given category, with total count."""
    # Verify category ownership
    await _get_category_for_user(category_id, user_id, db)

    base_filter = (
        select(Post)
        .join(PostCategory, PostCategory.post_id == Post.id)
        .where(
            PostCategory.category_id == category_id,
            Post.user_id == user_id,
        )
    )

    count_result = await db.execute(
        select(func.count())
        .select_from(Post)
        .join(PostCategory, PostCategory.post_id == Post.id)
        .where(
            PostCategory.category_id == category_id,
            Post.user_id == user_id,
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        base_filter.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    )
    posts = list(result.scalars().all())

    return posts, total


# ---------------------------------------------------------------------------
# Recycling helpers
# ---------------------------------------------------------------------------


async def get_recyclable_posts(
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """Find posts that are published, in recyclable categories, and past their recycle interval.

    Returns a list of dicts with post and category metadata suitable for the
    RecyclablePostItem schema.
    """
    now = datetime.now(timezone.utc)

    # Subquery: latest published_at per post across all platforms
    latest_pub_sq = (
        select(
            PostPlatform.post_id,
            func.max(PostPlatform.published_at).label("last_published_at"),
        )
        .where(PostPlatform.status == "published")
        .group_by(PostPlatform.post_id)
        .subquery()
    )

    stmt = (
        select(
            Post.id.label("post_id"),
            Post.caption,
            ContentCategory.id.label("category_id"),
            ContentCategory.name.label("category_name"),
            ContentCategory.recycle_interval_days,
            latest_pub_sq.c.last_published_at,
        )
        .join(PostCategory, PostCategory.post_id == Post.id)
        .join(ContentCategory, ContentCategory.id == PostCategory.category_id)
        .outerjoin(latest_pub_sq, latest_pub_sq.c.post_id == Post.id)
        .where(
            Post.user_id == user_id,
            Post.status == "published",
            ContentCategory.is_recyclable.is_(True),
            ContentCategory.user_id == user_id,
        )
    )

    result = await db.execute(stmt)
    rows = result.all()

    recyclable: list[dict] = []
    for row in rows:
        last_pub = row.last_published_at
        interval = row.recycle_interval_days

        # Post is recyclable if it was published more than `interval` days ago
        if last_pub is not None:
            cutoff = now - timedelta(days=interval)
            if last_pub <= cutoff:
                recyclable.append(
                    {
                        "post_id": row.post_id,
                        "caption": row.caption,
                        "category_id": row.category_id,
                        "category_name": row.category_name,
                        "last_published_at": last_pub,
                        "recycle_interval_days": interval,
                    }
                )

    return recyclable


# ---------------------------------------------------------------------------
# Recycle queue management
# ---------------------------------------------------------------------------


async def add_to_recycle_queue(
    post_id: str,
    category_id: str,
    user_id: str,
    scheduled_for: datetime,
    db: AsyncSession,
) -> RecycleQueue:
    """Add a post to the recycle queue for future re-publishing."""
    # Validate post ownership
    post_result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user_id)
    )
    if not post_result.scalar_one_or_none():
        raise NotFoundError("Post not found")

    # Validate category ownership and that it is recyclable
    category = await _get_category_for_user(category_id, user_id, db)
    if not category.is_recyclable:
        raise BadRequestError("Category is not marked as recyclable")

    # Prevent duplicate pending entries for the same post
    dup = await db.execute(
        select(RecycleQueue).where(
            RecycleQueue.post_id == post_id,
            RecycleQueue.user_id == user_id,
            RecycleQueue.status == "pending",
        )
    )
    if dup.scalar_one_or_none():
        raise BadRequestError("Post already has a pending recycle entry")

    # Count how many times this post was previously recycled
    count_result = await db.execute(
        select(func.count())
        .select_from(RecycleQueue)
        .where(
            RecycleQueue.post_id == post_id,
            RecycleQueue.user_id == user_id,
        )
    )
    times_recycled = count_result.scalar() or 0

    item = RecycleQueue(
        post_id=post_id,
        category_id=category_id,
        user_id=user_id,
        scheduled_for=scheduled_for,
        times_recycled=times_recycled,
    )
    db.add(item)
    await db.flush()
    return item


async def get_recycle_queue(
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """Return all pending recycle-queue items for the user, enriched with post and category info."""
    stmt = (
        select(
            RecycleQueue.id,
            RecycleQueue.post_id,
            Post.caption.label("post_title"),
            RecycleQueue.category_id,
            ContentCategory.name.label("category_name"),
            RecycleQueue.scheduled_for,
            RecycleQueue.status,
            RecycleQueue.times_recycled,
            RecycleQueue.created_at,
        )
        .join(Post, Post.id == RecycleQueue.post_id)
        .join(ContentCategory, ContentCategory.id == RecycleQueue.category_id)
        .where(
            RecycleQueue.user_id == user_id,
            RecycleQueue.status == "pending",
        )
        .order_by(RecycleQueue.scheduled_for.asc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": row.id,
            "post_id": row.post_id,
            "post_title": row.post_title,
            "category_id": row.category_id,
            "category_name": row.category_name,
            "scheduled_for": row.scheduled_for,
            "status": row.status,
            "times_recycled": row.times_recycled,
            "created_at": row.created_at,
        }
        for row in rows
    ]
