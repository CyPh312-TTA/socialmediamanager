"""Tests for health check and basic API endpoints."""

import pytest
from httpx import AsyncClient


class TestHealthCheck:
    """GET /health"""

    async def test_health_returns_ok(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestAPIDiscovery:
    """Verify key API routes are registered and return proper status codes."""

    async def test_auth_endpoints_exist(self, client: AsyncClient):
        # These should return 422 (missing body) not 404 (not found)
        for endpoint in [
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
        ]:
            resp = await client.post(endpoint, json={})
            assert resp.status_code != 404, f"{endpoint} returned 404"

    async def test_protected_endpoints_require_auth(self, client: AsyncClient):
        """All protected endpoints should return 401 without a token."""
        protected_gets = [
            "/api/v1/auth/me",
            "/api/v1/posts/",
            "/api/v1/media/",
            "/api/v1/analytics/dashboard",
            "/api/v1/settings/preferences",
        ]
        for endpoint in protected_gets:
            resp = await client.get(endpoint)
            assert resp.status_code == 401, (
                f"{endpoint} returned {resp.status_code} instead of 401"
            )

    async def test_settings_endpoints_exist(self, client: AsyncClient, auth_headers: dict):
        """Settings routes should respond (not 404)."""
        resp = await client.get("/api/v1/settings/preferences", headers=auth_headers)
        assert resp.status_code == 200

        resp = await client.put(
            "/api/v1/settings/profile",
            headers=auth_headers,
            json={"full_name": "Test"},
        )
        assert resp.status_code == 200

    async def test_analytics_endpoint_exists(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        assert resp.status_code == 200
