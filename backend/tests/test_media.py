"""Tests for media upload endpoints."""

import io

import pytest
from httpx import AsyncClient


class TestMediaList:
    """GET /api/v1/media/"""

    async def test_list_media_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/media/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 0

    async def test_list_media_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/media/")
        assert resp.status_code == 401


class TestMediaUpload:
    """POST /api/v1/media/upload"""

    async def test_upload_image(self, client: AsyncClient, auth_headers: dict):
        """Upload a minimal PNG file."""
        # Minimal 1x1 red pixel PNG
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00"
            b"\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        resp = await client.post(
            "/api/v1/media/upload",
            headers=auth_headers,
            files={"file": ("test.png", io.BytesIO(png_bytes), "image/png")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["file_name"] == "test.png"
        assert data["media_type"] == "image"
        assert "id" in data

    async def test_upload_no_auth(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/media/upload",
            files={"file": ("test.png", io.BytesIO(b"fake"), "image/png")},
        )
        assert resp.status_code == 401

    async def test_upload_no_file(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/media/upload",
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestMediaDelete:
    """DELETE /api/v1/media/{media_id}"""

    async def test_delete_nonexistent(self, client: AsyncClient, auth_headers: dict):
        resp = await client.delete(
            "/api/v1/media/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code in [404, 500]
