from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.link_in_bio import (
    BioLinkCreate,
    BioLinkResponse,
    BioLinkUpdate,
    BioPageCreate,
    BioPageResponse,
    BioPageUpdate,
    ClickAnalyticsResponse,
    PublicBioPageResponse,
    ReorderLinksRequest,
)
from app.services import link_in_bio_service

router = APIRouter(prefix="/bio", tags=["link-in-bio"])


# ---------------------------------------------------------------------------
# Bio Page endpoints (authenticated)
# ---------------------------------------------------------------------------

@router.post("/bio-pages", response_model=BioPageResponse, status_code=201)
async def create_bio_page(
    data: BioPageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new Link in Bio page."""
    page = await link_in_bio_service.create_bio_page(user.id, data, db)
    return page


@router.get("/bio-pages", response_model=list[BioPageResponse])
async def list_bio_pages(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bio pages belonging to the current user."""
    pages = await link_in_bio_service.list_bio_pages(user.id, db)
    return pages


@router.get("/bio-pages/{page_id}", response_model=BioPageResponse)
async def get_bio_page(
    page_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific bio page by ID (owner only)."""
    page = await link_in_bio_service.get_bio_page(page_id, user.id, db)
    return page


@router.put("/bio-pages/{page_id}", response_model=BioPageResponse)
async def update_bio_page(
    page_id: str,
    data: BioPageUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update bio page settings."""
    page = await link_in_bio_service.update_bio_page(page_id, user.id, data, db)
    return page


@router.delete("/bio-pages/{page_id}", status_code=204)
async def delete_bio_page(
    page_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bio page."""
    await link_in_bio_service.delete_bio_page(page_id, user.id, db)


# ---------------------------------------------------------------------------
# Bio Link endpoints (authenticated)
# ---------------------------------------------------------------------------

@router.post(
    "/bio-pages/{page_id}/links",
    response_model=BioLinkResponse,
    status_code=201,
)
async def add_link(
    page_id: str,
    data: BioLinkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new link to a bio page."""
    link = await link_in_bio_service.add_link(page_id, user.id, data, db)
    return link


@router.put(
    "/bio-pages/{page_id}/links/{link_id}",
    response_model=BioLinkResponse,
)
async def update_link(
    page_id: str,
    link_id: str,
    data: BioLinkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing link."""
    link = await link_in_bio_service.update_link(link_id, user.id, data, db)
    return link


@router.delete("/bio-pages/{page_id}/links/{link_id}", status_code=204)
async def delete_link(
    page_id: str,
    link_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a link from a bio page."""
    await link_in_bio_service.delete_link(link_id, user.id, db)


@router.put(
    "/bio-pages/{page_id}/links/reorder",
    response_model=list[BioLinkResponse],
)
async def reorder_links(
    page_id: str,
    data: ReorderLinksRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder links by providing a new ordered list of link IDs."""
    links = await link_in_bio_service.reorder_links(page_id, user.id, data.link_ids, db)
    return links


# ---------------------------------------------------------------------------
# Analytics (authenticated)
# ---------------------------------------------------------------------------

@router.get(
    "/bio-pages/{page_id}/analytics",
    response_model=list[ClickAnalyticsResponse],
)
async def get_click_analytics(
    page_id: str,
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get click analytics for a bio page."""
    analytics = await link_in_bio_service.get_click_analytics(
        page_id, user.id, db, days=days
    )
    return analytics


# ---------------------------------------------------------------------------
# Public endpoints (no auth required)
# ---------------------------------------------------------------------------

@router.get("/p/{slug}", response_model=PublicBioPageResponse)
async def public_bio_page(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: view a published bio page by slug."""
    page = await link_in_bio_service.get_bio_page_by_slug(slug, db)
    return page


@router.post("/p/{slug}/click/{link_id}", status_code=204)
async def record_click(
    slug: str,
    link_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: record a click on a bio link."""
    referrer = request.headers.get("referer")
    user_agent = request.headers.get("user-agent")
    await link_in_bio_service.record_click(link_id, referrer, user_agent, db)
