import pytest
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient


pytestmark = pytest.mark.django_db


def test_password_reset_request_returns_same_response_for_existing_and_unknown_email(
    citizen,
    mailoutbox,
):
    client = APIClient()

    existing_response = client.post(
        "/api/auth/password-reset/",
        {"email": citizen.email},
        format="json",
    )
    unknown_response = client.post(
        "/api/auth/password-reset/",
        {"email": "missing@example.com"},
        format="json",
    )

    assert existing_response.status_code == status.HTTP_200_OK
    assert unknown_response.status_code == status.HTTP_200_OK
    assert existing_response.data == unknown_response.data
    assert len(mailoutbox) == 1
    assert citizen.email in mailoutbox[0].to
    assert "http://frontend.test/reset-password/" in mailoutbox[0].body


def test_password_reset_confirm_updates_password_for_valid_token(citizen):
    client = APIClient()
    uid = urlsafe_base64_encode(force_bytes(citizen.pk))
    token = default_token_generator.make_token(citizen)

    response = client.post(
        "/api/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password": "NewPass123!",
        },
        format="json",
    )

    citizen.refresh_from_db()
    assert response.status_code == status.HTTP_200_OK
    assert response.data["detail"] == "Password updated."
    assert citizen.check_password("NewPass123!")


def test_password_reset_confirm_rejects_invalid_token(citizen):
    client = APIClient()
    uid = urlsafe_base64_encode(force_bytes(citizen.pk))

    response = client.post(
        "/api/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": "invalid-token",
            "new_password": "NewPass123!",
        },
        format="json",
    )

    citizen.refresh_from_db()
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["detail"] == "Invalid or expired token."
    assert citizen.check_password("Test12345!")
