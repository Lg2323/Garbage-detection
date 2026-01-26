from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import RegisterSerializer, UserSerializer

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
            return Response({"detail": "No refresh cookie"}, status=status.HTTP_401_UNAUTHORIZED)

        # Do not mutate request.data (QueryDict can be immutable)
        serializer = self.get_serializer(data={"refresh": refresh})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        response = Response(data, status=status.HTTP_200_OK)
        if "refresh" in response.data:
            _set_refresh_cookie(response, response.data["refresh"])
            # Do not expose refresh in response body
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
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role not in ("COORDINATOR", "ADMIN"):
            return User.objects.none()
        return User.objects.filter(role="WORKER").only("id", "username", "email")
