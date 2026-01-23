from django.shortcuts import render
from rest_framework import generics, permissions
from .serializers import RegisterSerializer
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .serializers import WorkerSerializer
from rest_framework.generics import ListAPIView


User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
        })


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


REFRESH_COOKIE_NAME = "refresh_token"

def _set_refresh_cookie(response: Response, refresh: str):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh,
        httponly=True,
        secure=False,
        samesite="Lax",
        path="/api/auth/",
        max_age=7 * 24 * 3600,
    )

def _delete_refresh_cookie(response: Response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth/")

class CookieTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code != 200:
            return response

        refresh = response.data.get("refresh")
        access = response.data.get("access")

        new_response = Response({"access": access}, status=200)
        _set_refresh_cookie(new_response, refresh)
        return new_response

class CookieTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh:
            return Response({"detail": "No refresh cookie"}, status=401)

        # подсовываем refresh в data, дальше simplejwt всё сделает сам,
        # включая ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION, если включишь
        request.data["refresh"] = refresh
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200 and "refresh" in response.data:
            _set_refresh_cookie(response, response.data["refresh"])
            # не светим refresh в body
            del response.data["refresh"]

        return response

class LogoutView(APIView):
    def post(self, request):
        # Опционально: заблэклистить refresh (если есть)
        refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except Exception:
                pass

        resp = Response({"detail": "ok"}, status=200)
        _delete_refresh_cookie(resp)
        return resp






class WorkersListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WorkerSerializer

    def get_queryset(self):
        if self.request.user.role not in ("COORDINATOR", "ADMIN"):
            return User.objects.none()
        return User.objects.filter(role="WORKER").only("id", "username", "email")
