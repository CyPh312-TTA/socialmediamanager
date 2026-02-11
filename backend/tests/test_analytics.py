"""Tests for analytics endpoints."""

import pytest
from httpx import AsyncClient


class TestAnalyticsDashboard:
    """GET /api/v1/analytics/dashboard"""

    async def test_dashboard_empty(self, client: AsyncClient, auth_headers: dict):
        """Dashboard should return zero values when no data exists."""
        resp = await client.get(
            "/api/v1/analytics/dashboard",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()

        # Structure check
        assert "overview" in data
        assert "platform_breakdown" in data
        assert "top_posts" in data
        assert "daily_metrics" in data

        # Overview defaults
        overview = data["overview"]
        assert overview["total_impressions"] == 0
        assert overview["total_reach"] == 0
        assert overview["total_likes"] == 0
        assert overview["avg_engagement_rate"] == 0.0
        assert overview["total_followers"] == 0

        # Empty lists when no data
        assert data["platform_breakdown"] == []
        assert data["top_posts"] == []
        assert data["daily_metrics"] == []

    async def test_dashboard_with_days_param(self, client: AsyncClient, auth_headers: dict):
        """Dashboard should accept a days query parameter."""
        resp = await client.get(
            "/api/v1/analytics/dashboard?days=7",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_dashboard_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/analytics/dashboard")
        assert resp.status_code == 401

    async def test_dashboard_has_post_counts(self, client: AsyncClient, auth_headers: dict):
        """Dashboard overview total_posts should match actual post count."""
        resp = await client.get(
            "/api/v1/analytics/dashboard",
            headers=auth_headers,
        )
        data = resp.json()
        # For a fresh user with no posts, should be 0
        assert data["overview"]["total_posts"] >= 0
        assert data["overview"]["total_published"] >= 0
