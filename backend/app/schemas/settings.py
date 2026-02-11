from typing import Optional

from pydantic import BaseModel, EmailStr


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserPreferences(BaseModel):
    default_tone: str = "professional"
    default_hashtag_count: int = 20
    default_platforms: list[str] = []
    auto_hashtags: bool = False
    posting_timezone: str = "UTC"


class UserPreferencesUpdate(BaseModel):
    default_tone: Optional[str] = None
    default_hashtag_count: Optional[int] = None
    default_platforms: Optional[list[str]] = None
    auto_hashtags: Optional[bool] = None
    posting_timezone: Optional[str] = None
