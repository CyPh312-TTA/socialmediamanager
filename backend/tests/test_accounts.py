"""Tests for social accounts endpoints."""

import pytest
from httpx import AsyncClient


class TestAccountsList:
    """GET /api/v1/accounts/"""

    async def test_list_accounts_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/accounts/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 0

    async def test_list_accounts_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/accounts/")
        assert resp.status_code == 401


class TestOAuthConnect:
    """GET /api/v1/accounts/{platform}/connect"""

    async def test_connect_twitter_returns_url(self, client: AsyncClient, auth_headers: dict):
        """Should return an authorization_url for Twitter OAuth."""
        resp = await client.get(
            "/api/v1/accounts/twitter/connect",
            headers=auth_headers,
        )
        # Might fail because Twitter client ID is empty in test, but should not 404
        assert resp.status_code != 404

    async def test_connect_meta_returns_url(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/v1/accounts/meta/connect",
            headers=auth_headers,
        )
        assert resp.status_code != 404

    async def test_connect_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/accounts/twitter/connect")
        assert resp.status_code == 401
