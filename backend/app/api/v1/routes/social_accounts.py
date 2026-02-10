from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.core.security import encrypt_token
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.social_account import SocialAccount
from app.models.user import User
from app.platforms.oauth import meta_oauth, tiktok_oauth, twitter_oauth
from app.schemas.social_account import OAuthStartResponse, SocialAccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/", response_model=list[SocialAccountResponse])
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialAccount)
        .where(SocialAccount.user_id == user.id)
        .order_by(SocialAccount.connected_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{platform}/connect", response_model=OAuthStartResponse)
async def start_oauth(
    platform: str,
    user: User = Depends(get_current_user),
):
    if platform == "twitter":
        url = twitter_oauth.generate_oauth_url(user.id)
    elif platform == "meta":
        url = meta_oauth.generate_oauth_url(user.id)
    elif platform == "tiktok":
        url = tiktok_oauth.generate_oauth_url(user.id)
    else:
        raise BadRequestError(f"Unsupported platform: {platform}")

    return OAuthStartResponse(authorization_url=url)


@router.get("/twitter/callback")
async def twitter_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await twitter_oauth.handle_callback(code, state)
    except ValueError as e:
        raise BadRequestError(str(e))

    await _upsert_account(data, "twitter", db)
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/accounts?connected=twitter")


@router.get("/meta/callback")
async def meta_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        accounts_data = await meta_oauth.handle_callback(code, state)
    except ValueError as e:
        raise BadRequestError(str(e))

    for data in accounts_data:
        await _upsert_account(data, data["platform"], db)

    return RedirectResponse(url=f"{settings.FRONTEND_URL}/accounts?connected=meta")


@router.get("/tiktok/callback")
async def tiktok_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await tiktok_oauth.handle_callback(code, state)
    except ValueError as e:
        raise BadRequestError(str(e))

    await _upsert_account(data, "tiktok", db)
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/accounts?connected=tiktok")


@router.delete("/{account_id}", status_code=204)
async def disconnect_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id, SocialAccount.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Account not found")
    await db.delete(account)


async def _upsert_account(data: dict, platform: str, db: AsyncSession) -> SocialAccount:
    """Create or update a social account from OAuth callback data."""
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == data["user_id"],
            SocialAccount.platform == platform,
            SocialAccount.platform_user_id == data["platform_user_id"],
        )
    )
    account = result.scalar_one_or_none()

    expires_at = None
    if data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])

    if account:
        account.access_token = encrypt_token(data["access_token"])
        account.refresh_token = (
            encrypt_token(data["refresh_token"]) if data.get("refresh_token") else None
        )
        account.token_expires_at = expires_at
        account.platform_username = data["platform_username"]
        account.is_active = True
    else:
        account = SocialAccount(
            user_id=data["user_id"],
            platform=platform,
            platform_user_id=data["platform_user_id"],
            platform_username=data["platform_username"],
            access_token=encrypt_token(data["access_token"]),
            refresh_token=(
                encrypt_token(data["refresh_token"]) if data.get("refresh_token") else None
            ),
            token_expires_at=expires_at,
            scopes=data.get("scopes"),
            meta_page_id=data.get("meta_page_id"),
        )
        db.add(account)

    await db.flush()
    return account
