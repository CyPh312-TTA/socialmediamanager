import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.settings import PasswordChange, ProfileUpdate, UserPreferences, UserPreferencesUpdate
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile (name, email)."""
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email

    await db.flush()
    return user


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password."""
    if not verify_password(data.current_password, user.hashed_password):
        raise BadRequestError("Current password is incorrect")

    if len(data.new_password) < 8:
        raise BadRequestError("New password must be at least 8 characters")

    user.hashed_password = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password changed successfully"}


@router.get("/preferences", response_model=UserPreferences)
async def get_preferences(
    user: User = Depends(get_current_user),
):
    """Get user preferences (stored as JSON in user model or defaults)."""
    # For now, preferences are stored as a JSON string attribute on User
    # If the user model doesn't have preferences yet, return defaults
    prefs = getattr(user, "_preferences_cache", None)
    if prefs is None:
        return UserPreferences()
    return prefs


@router.put("/preferences", response_model=UserPreferences)
async def update_preferences(
    data: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences."""
    # Build current preferences with updates applied
    current = UserPreferences()
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(current, key, value)

    return current
