import pytest
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User


pytestmark = pytest.mark.django_db


def test_register_creates_new_citizen():
    client = APIClient()

    response = client.post(
        "/api/auth/register/",
        {
            "username": "new_citizen",
            "first_name": "Ivan",
            "last_name": "Petrov",
            "email": "new_citizen@example.com",
            "phone": "+79000000001",
            "city": "Almetyevsk",
            "password": "Test12345!",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    user = User.objects.get(username="new_citizen")
    assert user.role == User.Role.CITIZEN
    assert user.check_password("Test12345!")


def test_register_rejects_duplicate_username(citizen):
    client = APIClient()

    response = client.post(
        "/api/auth/register/",
        {
            "username": citizen.username,
            "first_name": "Ivan",
            "last_name": "Petrov",
            "email": "duplicate@example.com",
            "phone": "+79000000002",
            "city": "Almetyevsk",
            "password": "Test12345!",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "username" in response.data


def test_login_returns_access_token_and_refresh_cookie(citizen, password):
    client = APIClient()

    response = client.post(
        "/api/auth/login/",
        {"username": citizen.username, "password": password},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert "access" in response.data
    assert "refresh" not in response.data
    assert "refresh_token" in response.cookies
    assert response.cookies["refresh_token"]["path"] == "/api/auth/"


def test_refresh_returns_new_access_token_using_refresh_cookie(citizen, password):
    client = APIClient()
    login_response = client.post(
        "/api/auth/login/",
        {"username": citizen.username, "password": password},
        format="json",
    )

    assert login_response.status_code == status.HTTP_200_OK
    refresh_response = client.post("/api/auth/refresh/", {}, format="json")

    assert refresh_response.status_code == status.HTTP_200_OK
    assert "access" in refresh_response.data
    assert "refresh" not in refresh_response.data
    assert "refresh_token" in refresh_response.cookies


def test_logout_clears_refresh_cookie_and_prevents_next_refresh(citizen, password):
    client = APIClient()
    login_response = client.post(
        "/api/auth/login/",
        {"username": citizen.username, "password": password},
        format="json",
    )

    assert login_response.status_code == status.HTTP_200_OK
    logout_response = client.post("/api/auth/logout/", {}, format="json")
    refresh_response = client.post("/api/auth/refresh/", {}, format="json")

    assert logout_response.status_code == status.HTTP_200_OK
    assert logout_response.data["detail"] == "ok"
    assert "refresh_token" in logout_response.cookies
    assert logout_response.cookies["refresh_token"].value == ""
    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED
    assert refresh_response.data["detail"] == "No refresh cookie"


def test_protected_endpoint_requires_token_and_accepts_valid_access_token(citizen, password):
    anonymous_client = APIClient()
    unauthorized_response = anonymous_client.get("/api/auth/me/")

    login_client = APIClient()
    login_response = login_client.post(
        "/api/auth/login/",
        {"username": citizen.username, "password": password},
        format="json",
    )
    authorized_client = APIClient()
    authorized_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
    authorized_response = authorized_client.get("/api/auth/me/")

    assert unauthorized_response.status_code == status.HTTP_401_UNAUTHORIZED
    assert authorized_response.status_code == status.HTTP_200_OK
    assert authorized_response.data["username"] == citizen.username
