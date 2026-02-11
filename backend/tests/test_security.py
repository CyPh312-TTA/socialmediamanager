"""Tests for security utilities (password hashing, JWT, encryption)."""

import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_token,
    encrypt_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        hashed = hash_password("mypassword")
        assert isinstance(hashed, str)
        assert hashed != "mypassword"

    def test_verify_correct_password(self):
        hashed = hash_password("secretpass")
        assert verify_password("secretpass", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("secretpass")
        assert verify_password("wrongpass", hashed) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt salts should make them different

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False


class TestJWT:
    def test_create_access_token(self):
        token = create_access_token("user-123")
        assert isinstance(token, str)
        assert len(token) > 50

    def test_decode_access_token(self):
        token = create_access_token("user-456")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-456"
        assert payload["type"] == "access"

    def test_create_refresh_token(self):
        token = create_refresh_token("user-789")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-789"
        assert payload["type"] == "refresh"
        assert "jti" in payload

    def test_decode_invalid_token(self):
        payload = decode_token("not-a-valid-jwt")
        assert payload is None

    def test_decode_empty_string(self):
        payload = decode_token("")
        assert payload is None


class TestFernetEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        original = "my-secret-oauth-token-12345"
        encrypted = encrypt_token(original)
        assert encrypted != original
        decrypted = decrypt_token(encrypted)
        assert decrypted == original

    def test_encrypted_is_different_each_time(self):
        """Fernet includes a timestamp, so encrypting the same value produces different ciphertexts."""
        e1 = encrypt_token("same-value")
        e2 = encrypt_token("same-value")
        assert e1 != e2

    def test_decrypt_wrong_ciphertext(self):
        with pytest.raises(Exception):
            decrypt_token("not-valid-fernet-ciphertext")
