"""
Platform account health monitoring.
Tracks token expiry, API errors, and account status.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"       # Token expiring soon or occasional errors
    ERROR = "error"           # Token expired or repeated failures
    DISCONNECTED = "disconnected"  # Needs re-auth


@dataclass
class AccountHealth:
    account_id: str
    platform: str
    status: HealthStatus = HealthStatus.HEALTHY
    last_successful_call: float = 0.0
    consecutive_errors: int = 0
    last_error_message: str = ""
    token_expires_at: float | None = None
    total_api_calls: int = 0
    total_errors: int = 0
    total_publishes: int = 0


class HealthMonitor:
    """Monitor health of all connected social accounts."""

    def __init__(self):
        self._accounts: dict[str, AccountHealth] = {}

    def _key(self, platform: str, account_id: str) -> str:
        return f"{platform}:{account_id}"

    def _get_or_create(self, platform: str, account_id: str) -> AccountHealth:
        key = self._key(platform, account_id)
        if key not in self._accounts:
            self._accounts[key] = AccountHealth(
                account_id=account_id, platform=platform
            )
        return self._accounts[key]

    def record_success(self, platform: str, account_id: str) -> None:
        """Record a successful API call."""
        health = self._get_or_create(platform, account_id)
        health.last_successful_call = time.time()
        health.consecutive_errors = 0
        health.total_api_calls += 1
        health.status = HealthStatus.HEALTHY

    def record_publish(self, platform: str, account_id: str) -> None:
        """Record a successful publish."""
        health = self._get_or_create(platform, account_id)
        health.total_publishes += 1
        self.record_success(platform, account_id)

    def record_error(self, platform: str, account_id: str, error_message: str) -> None:
        """Record an API error."""
        health = self._get_or_create(platform, account_id)
        health.consecutive_errors += 1
        health.total_errors += 1
        health.total_api_calls += 1
        health.last_error_message = error_message

        if health.consecutive_errors >= 5:
            health.status = HealthStatus.ERROR
        elif health.consecutive_errors >= 2:
            health.status = HealthStatus.WARNING

    def record_auth_failure(self, platform: str, account_id: str) -> None:
        """Record an authentication failure (401/403)."""
        health = self._get_or_create(platform, account_id)
        health.status = HealthStatus.DISCONNECTED
        health.last_error_message = "Authentication failed — reconnect required"

    def set_token_expiry(
        self, platform: str, account_id: str, expires_at: datetime | None
    ) -> None:
        """Update token expiry time."""
        health = self._get_or_create(platform, account_id)
        if expires_at:
            health.token_expires_at = expires_at.timestamp()
            # Warn if expiring within 24 hours
            hours_left = (expires_at.timestamp() - time.time()) / 3600
            if hours_left < 0:
                health.status = HealthStatus.DISCONNECTED
            elif hours_left < 24:
                health.status = HealthStatus.WARNING

    def get_health(self, platform: str, account_id: str) -> dict:
        """Get health status for a single account."""
        health = self._get_or_create(platform, account_id)

        # Check token expiry
        if health.token_expires_at:
            hours_left = (health.token_expires_at - time.time()) / 3600
            if hours_left < 0:
                health.status = HealthStatus.DISCONNECTED
            elif hours_left < 24 and health.status == HealthStatus.HEALTHY:
                health.status = HealthStatus.WARNING

        return {
            "account_id": health.account_id,
            "platform": health.platform,
            "status": health.status.value,
            "last_successful_call": (
                datetime.fromtimestamp(health.last_successful_call, tz=timezone.utc).isoformat()
                if health.last_successful_call
                else None
            ),
            "consecutive_errors": health.consecutive_errors,
            "last_error": health.last_error_message or None,
            "token_expires_at": (
                datetime.fromtimestamp(health.token_expires_at, tz=timezone.utc).isoformat()
                if health.token_expires_at
                else None
            ),
            "total_api_calls": health.total_api_calls,
            "total_errors": health.total_errors,
            "total_publishes": health.total_publishes,
        }

    def get_all_health(self) -> list[dict]:
        """Get health of all tracked accounts."""
        return [
            self.get_health(h.platform, h.account_id) for h in self._accounts.values()
        ]

    def get_accounts_needing_attention(self) -> list[dict]:
        """Get accounts that are warning, error, or disconnected."""
        return [
            self.get_health(h.platform, h.account_id)
            for h in self._accounts.values()
            if h.status != HealthStatus.HEALTHY
        ]

    def remove_account(self, platform: str, account_id: str) -> None:
        key = self._key(platform, account_id)
        self._accounts.pop(key, None)


# Global singleton
health_monitor = HealthMonitor()
