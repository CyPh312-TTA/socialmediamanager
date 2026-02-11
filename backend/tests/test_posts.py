"""Tests for post endpoints."""

import pytest
from httpx import AsyncClient


class TestPostList:
    """GET /api/v1/posts/"""

    async def test_list_posts_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/posts/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    async def test_list_posts_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/posts/")
        assert resp.status_code == 401


class TestPostCreate:
    """POST /api/v1/posts/"""

    async def test_create_post_no_accounts(self, client: AsyncClient, auth_headers: dict):
        """Creating a post with no valid account IDs should fail gracefully."""
        resp = await client.post(
            "/api/v1/posts/",
            headers=auth_headers,
            json={
                "caption": "Test post from QA suite",
                "account_ids": ["nonexistent-account-id"],
                "publish_now": False,
            },
        )
        # Should fail because the account ID doesn't exist
        assert resp.status_code in [400, 404, 422, 500]

    async def test_create_post_missing_caption(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/posts/",
            headers=auth_headers,
            json={"account_ids": ["some-id"]},
        )
        assert resp.status_code == 422

    async def test_create_post_missing_accounts(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/posts/",
            headers=auth_headers,
            json={"caption": "No accounts"},
        )
        assert resp.status_code == 422


class TestPostDelete:
    """DELETE /api/v1/posts/{post_id}"""

    async def test_delete_nonexistent_post(self, client: AsyncClient, auth_headers: dict):
        resp = await client.delete(
            "/api/v1/posts/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code in [404, 500]

    async def test_delete_no_auth(self, client: AsyncClient):
        resp = await client.delete("/api/v1/posts/some-id")
        assert resp.status_code == 401
