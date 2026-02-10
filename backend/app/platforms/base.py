from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PlatformPostResult:
    success: bool
    platform_post_id: str | None = None
    platform_media_ids: list[str] | None = None
    error_message: str | None = None


@dataclass
class PostMetrics:
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    clicks: int = 0
    engagement_rate: float = 0.0


@dataclass
class AccountMetrics:
    followers_count: int = 0
    impressions: int = 0
    reach: int = 0
    engagement_rate: float = 0.0


@dataclass
class OAuthTokens:
    access_token: str
    refresh_token: str | None = None
    expires_in: int | None = None
    scopes: str | None = None


class SocialPlatformBase(ABC):
    """Abstract base class that every platform adapter must implement."""

    @abstractmethod
    async def publish_post(
        self,
        text: str,
        media_file_paths: list[str] | None = None,
        post_type: str = "feed",
    ) -> PlatformPostResult:
        ...

    @abstractmethod
    async def delete_post(self, platform_post_id: str) -> bool:
        ...

    @abstractmethod
    async def get_post_metrics(self, platform_post_id: str) -> PostMetrics:
        ...

    @abstractmethod
    async def get_account_metrics(self) -> AccountMetrics:
        ...

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        ...
