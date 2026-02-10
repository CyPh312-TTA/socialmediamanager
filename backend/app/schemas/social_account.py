from datetime import datetime

from pydantic import BaseModel


class SocialAccountResponse(BaseModel):
    id: str
    platform: str
    platform_username: str
    account_type: str
    is_active: bool
    connected_at: datetime

    model_config = {"from_attributes": True}


class OAuthStartResponse(BaseModel):
    authorization_url: str
