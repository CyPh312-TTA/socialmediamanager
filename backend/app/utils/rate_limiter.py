"""
Per-platform API rate limiter with sliding window tracking.
Prevents hitting platform rate limits and implements exponential backoff.
"""

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class PlatformLimits:
    """Rate limit configuration per platform."""
    max_requests: int
    window_seconds: int
    max_publishes_per_day: int
    backoff_base: float = 2.0
    max_retries: int = 3


PLATFORM_RATE_LIMITS: dict[str, PlatformLimits] = {
    "twitter": PlatformLimits(
        max_requests=300,         # 300 requests per 15 min window
        window_seconds=900,       # 15 minutes
        max_publishes_per_day=50, # Conservative limit (free tier: 1500/mo)
    ),
    "instagram": PlatformLimits(
        max_requests=200,         # 200 calls/hr per user token
        window_seconds=3600,      # 1 hour
        max_publishes_per_day=25, # Instagram's 25 posts/24hr limit
    ),
    "facebook": PlatformLimits(
        max_requests=200,         # 200 calls/hr per user token
        window_seconds=3600,      # 1 hour
        max_publishes_per_day=50, # No hard limit, but be reasonable
    ),
    "tiktok": PlatformLimits(
        max_requests=100,         # Conservative estimate
        window_seconds=3600,      # 1 hour
        max_publishes_per_day=10, # TikTok is stricter
    ),
}


class SlidingWindowCounter:
    """Track API calls within a sliding time window."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.timestamps: list[float] = []

    def _cleanup(self) -> None:
        """Remove expired timestamps."""
        cutoff = time.time() - self.window_seconds
        self.timestamps = [ts for ts in self.timestamps if ts > cutoff]

    def can_proceed(self) -> bool:
        """Check if we can make another request."""
        self._cleanup()
        return len(self.timestamps) < self.max_requests

    def record(self) -> None:
        """Record a new request."""
        self.timestamps.append(time.time())

    def time_until_available(self) -> float:
        """Seconds until next request slot opens."""
        self._cleanup()
        if len(self.timestamps) < self.max_requests:
            return 0.0
        oldest = self.timestamps[0]
        return max(0.0, oldest + self.window_seconds - time.time())

    @property
    def current_count(self) -> int:
        self._cleanup()
        return len(self.timestamps)

    @property
    def remaining(self) -> int:
        self._cleanup()
        return max(0, self.max_requests - len(self.timestamps))


class DailyCounter:
    """Track daily publish counts per account."""

    def __init__(self, max_per_day: int):
        self.max_per_day = max_per_day
        self.count = 0
        self.reset_date: str = ""

    def _check_reset(self) -> None:
        today = time.strftime("%Y-%m-%d")
        if self.reset_date != today:
            self.count = 0
            self.reset_date = today

    def can_publish(self) -> bool:
        self._check_reset()
        return self.count < self.max_per_day

    def record_publish(self) -> None:
        self._check_reset()
        self.count += 1

    @property
    def remaining(self) -> int:
        self._check_reset()
        return max(0, self.max_per_day - self.count)


class RateLimiter:
    """
    Central rate limiter for all platform API calls.
    Keyed by (platform, account_id) to track per-account usage.
    """

    def __init__(self):
        self._api_windows: dict[str, SlidingWindowCounter] = {}
        self._daily_counters: dict[str, DailyCounter] = {}
        self._backoff_until: dict[str, float] = {}

    def _get_key(self, platform: str, account_id: str) -> str:
        return f"{platform}:{account_id}"

    def _get_window(self, platform: str, account_id: str) -> SlidingWindowCounter:
        key = self._get_key(platform, account_id)
        if key not in self._api_windows:
            limits = PLATFORM_RATE_LIMITS.get(platform, PLATFORM_RATE_LIMITS["twitter"])
            self._api_windows[key] = SlidingWindowCounter(
                limits.max_requests, limits.window_seconds
            )
        return self._api_windows[key]

    def _get_daily(self, platform: str, account_id: str) -> DailyCounter:
        key = self._get_key(platform, account_id)
        if key not in self._daily_counters:
            limits = PLATFORM_RATE_LIMITS.get(platform, PLATFORM_RATE_LIMITS["twitter"])
            self._daily_counters[key] = DailyCounter(limits.max_publishes_per_day)
        return self._daily_counters[key]

    async def acquire(self, platform: str, account_id: str) -> None:
        """
        Wait until it's safe to make an API call.
        Blocks if rate limited, respects backoff.
        """
        key = self._get_key(platform, account_id)

        # Check backoff
        backoff_until = self._backoff_until.get(key, 0)
        if time.time() < backoff_until:
            wait = backoff_until - time.time()
            await asyncio.sleep(wait)

        window = self._get_window(platform, account_id)
        while not window.can_proceed():
            wait = window.time_until_available()
            if wait > 0:
                await asyncio.sleep(min(wait + 0.5, 60))

        window.record()

    def can_publish(self, platform: str, account_id: str) -> bool:
        """Check if this account can publish today."""
        return self._get_daily(platform, account_id).can_publish()

    def record_publish(self, platform: str, account_id: str) -> None:
        """Record a successful publish."""
        self._get_daily(platform, account_id).record_publish()

    def record_rate_limit_hit(
        self, platform: str, account_id: str, retry_after: float | None = None
    ) -> None:
        """Record a 429 response. Apply exponential backoff."""
        key = self._get_key(platform, account_id)
        current_backoff = self._backoff_until.get(key, 0)
        limits = PLATFORM_RATE_LIMITS.get(platform, PLATFORM_RATE_LIMITS["twitter"])

        if retry_after:
            self._backoff_until[key] = time.time() + retry_after
        else:
            # Exponential backoff: double each time, max 5 minutes
            elapsed = max(1.0, current_backoff - time.time()) if current_backoff > time.time() else 1.0
            next_backoff = min(elapsed * limits.backoff_base, 300)
            self._backoff_until[key] = time.time() + next_backoff

    def get_status(self, platform: str, account_id: str) -> dict:
        """Get current rate limit status for an account."""
        window = self._get_window(platform, account_id)
        daily = self._get_daily(platform, account_id)
        key = self._get_key(platform, account_id)
        backoff_until = self._backoff_until.get(key, 0)

        return {
            "platform": platform,
            "account_id": account_id,
            "api_calls_remaining": window.remaining,
            "api_calls_used": window.current_count,
            "publishes_remaining_today": daily.remaining,
            "is_backing_off": time.time() < backoff_until,
            "backoff_seconds_left": max(0, backoff_until - time.time()),
        }

    def get_all_statuses(self) -> list[dict]:
        """Get rate limit status for all tracked accounts."""
        seen = set()
        statuses = []
        for key in list(self._api_windows.keys()) | set(self._daily_counters.keys()):
            if key not in seen:
                seen.add(key)
                platform, account_id = key.split(":", 1)
                statuses.append(self.get_status(platform, account_id))
        return statuses


# Global singleton
rate_limiter = RateLimiter()
