import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import cast, func, select, update, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.link_in_bio import BioLink, BioPage, BioPageClick
from app.schemas.link_in_bio import BioLinkCreate, BioLinkUpdate, BioPageCreate, BioPageUpdate

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Bio Page CRUD
# ---------------------------------------------------------------------------

async def create_bio_page(
    user_id: str, data: BioPageCreate, db: AsyncSession
) -> BioPage:
    """Create a new bio page for a user."""
    # Check slug uniqueness
    existing = await db.execute(
        select(BioPage).where(BioPage.slug == data.slug)
    )
    if existing.scalar_one_or_none():
        raise BadRequestError(f"Slug '{data.slug}' is already taken")

    page = BioPage(
        user_id=user_id,
        slug=data.slug,
        title=data.title,
        bio=data.bio,
        avatar_url=data.avatar_url,
        theme=data.theme,
        bg_color=data.bg_color,
        text_color=data.text_color,
        button_style=data.button_style,
    )
    db.add(page)
    await db.flush()
    return page


async def update_bio_page(
    page_id: str, user_id: str, data: BioPageUpdate, db: AsyncSession
) -> BioPage:
    """Update an existing bio page owned by user_id."""
    page = await _get_owned_page(page_id, user_id, db)

    update_data = data.model_dump(exclude_unset=True)

    # If slug is being changed, verify uniqueness
    if "slug" in update_data:
        existing = await db.execute(
            select(BioPage).where(BioPage.slug == update_data["slug"], BioPage.id != page_id)
        )
        if existing.scalar_one_or_none():
            raise BadRequestError(f"Slug '{update_data['slug']}' is already taken")

    for field, value in update_data.items():
        setattr(page, field, value)

    await db.flush()
    return page


async def get_bio_page(
    page_id: str, user_id: str, db: AsyncSession
) -> BioPage:
    """Get a bio page by ID for the owner (includes links)."""
    result = await db.execute(
        select(BioPage)
        .options(selectinload(BioPage.links))
        .where(BioPage.id == page_id, BioPage.user_id == user_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise NotFoundError("Bio page not found")
    return page


async def get_bio_page_by_slug(slug: str, db: AsyncSession) -> BioPage:
    """Public access: get a published bio page by slug."""
    result = await db.execute(
        select(BioPage)
        .options(selectinload(BioPage.links))
        .where(BioPage.slug == slug, BioPage.is_published.is_(True))
    )
    page = result.scalar_one_or_none()
    if not page:
        raise NotFoundError("Bio page not found")

    # Increment page view counter
    page.total_views += 1
    await db.flush()
    return page


async def list_bio_pages(user_id: str, db: AsyncSession) -> list[BioPage]:
    """List all bio pages owned by a user."""
    result = await db.execute(
        select(BioPage)
        .options(selectinload(BioPage.links))
        .where(BioPage.user_id == user_id)
        .order_by(BioPage.created_at.desc())
    )
    return list(result.scalars().unique().all())


async def delete_bio_page(
    page_id: str, user_id: str, db: AsyncSession
) -> None:
    """Delete a bio page owned by user_id."""
    page = await _get_owned_page(page_id, user_id, db)
    await db.delete(page)
    await db.flush()


# ---------------------------------------------------------------------------
# Bio Link CRUD
# ---------------------------------------------------------------------------

async def add_link(
    page_id: str, user_id: str, data: BioLinkCreate, db: AsyncSession
) -> BioLink:
    """Add a new link to a bio page."""
    await _get_owned_page(page_id, user_id, db)

    # Determine next position
    max_pos_result = await db.execute(
        select(func.coalesce(func.max(BioLink.position), -1)).where(
            BioLink.bio_page_id == page_id
        )
    )
    next_position = (max_pos_result.scalar() or 0) + 1

    link = BioLink(
        bio_page_id=page_id,
        title=data.title,
        url=data.url,
        icon=data.icon,
        thumbnail_url=data.thumbnail_url,
        position=next_position,
    )
    db.add(link)
    await db.flush()
    return link


async def update_link(
    link_id: str, user_id: str, data: BioLinkUpdate, db: AsyncSession
) -> BioLink:
    """Update an existing link (ownership validated via bio_page)."""
    link = await _get_owned_link(link_id, user_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(link, field, value)

    await db.flush()
    return link


async def delete_link(
    link_id: str, user_id: str, db: AsyncSession
) -> None:
    """Delete a link (ownership validated via bio_page)."""
    link = await _get_owned_link(link_id, user_id, db)
    await db.delete(link)
    await db.flush()


async def reorder_links(
    page_id: str, user_id: str, link_ids: list[str], db: AsyncSession
) -> list[BioLink]:
    """Reorder links by assigning new positions based on the supplied list order."""
    await _get_owned_page(page_id, user_id, db)

    # Validate that all link_ids belong to this page
    result = await db.execute(
        select(BioLink).where(
            BioLink.bio_page_id == page_id,
        )
    )
    existing_links = {link.id: link for link in result.scalars().all()}

    if set(link_ids) != set(existing_links.keys()):
        raise BadRequestError(
            "link_ids must contain exactly all link IDs belonging to this page"
        )

    for position, lid in enumerate(link_ids):
        existing_links[lid].position = position

    await db.flush()

    # Return in new order
    return [existing_links[lid] for lid in link_ids]


# ---------------------------------------------------------------------------
# Click tracking & analytics
# ---------------------------------------------------------------------------

async def record_click(
    link_id: str,
    referrer: str | None,
    user_agent: str | None,
    db: AsyncSession,
) -> None:
    """Record a click on a bio link and increment the counter."""
    result = await db.execute(select(BioLink).where(BioLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Link not found")

    # Increment click count on the link
    link.click_count += 1

    # Store click event for analytics
    click = BioPageClick(
        bio_link_id=link_id,
        referrer=referrer,
        user_agent=user_agent,
    )
    db.add(click)
    await db.flush()


async def get_click_analytics(
    page_id: str, user_id: str, db: AsyncSession, days: int = 30
) -> list[dict]:
    """Get click analytics for all links on a bio page over the given period."""
    page = await get_bio_page(page_id, user_id, db)

    since = datetime.now(timezone.utc) - timedelta(days=days)
    link_ids = [link.id for link in page.links]

    if not link_ids:
        return []

    # Build a map of link_id -> title
    link_titles = {link.id: link.title for link in page.links}
    link_totals = {link.id: link.click_count for link in page.links}

    # Clicks per link per day
    clicks_by_day_query = (
        select(
            BioPageClick.bio_link_id,
            cast(BioPageClick.clicked_at, Date).label("day"),
            func.count().label("count"),
        )
        .where(
            BioPageClick.bio_link_id.in_(link_ids),
            BioPageClick.clicked_at >= since,
        )
        .group_by(BioPageClick.bio_link_id, "day")
        .order_by("day")
    )
    result = await db.execute(clicks_by_day_query)
    rows = result.all()

    # Group by link
    day_map: dict[str, list[dict]] = {lid: [] for lid in link_ids}
    for row in rows:
        day_map[row.bio_link_id].append(
            {"date": str(row.day), "count": row.count}
        )

    analytics = []
    for lid in link_ids:
        analytics.append(
            {
                "link_id": lid,
                "link_title": link_titles[lid],
                "total_clicks": link_totals[lid],
                "clicks_by_day": day_map[lid],
            }
        )

    return analytics


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_owned_page(
    page_id: str, user_id: str, db: AsyncSession
) -> BioPage:
    """Fetch a bio page and verify ownership."""
    result = await db.execute(
        select(BioPage).where(BioPage.id == page_id, BioPage.user_id == user_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise NotFoundError("Bio page not found")
    return page


async def _get_owned_link(
    link_id: str, user_id: str, db: AsyncSession
) -> BioLink:
    """Fetch a bio link and verify that it belongs to a page owned by user_id."""
    result = await db.execute(
        select(BioLink)
        .join(BioPage, BioLink.bio_page_id == BioPage.id)
        .where(BioLink.id == link_id, BioPage.user_id == user_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Link not found")
    return link
