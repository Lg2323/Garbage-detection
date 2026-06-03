from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from requests_app.models import Request
from requests_app.serializers import RequestListSerializer

from .serializers import (
    MeSerializer,
    MeUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class MeSubmittedRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Request.objects.filter(created_by=request.user)
            .select_related(
                "created_by",
                "assigned_worker",
                "coordinator",
                "federal_subject",
                "municipality",
                "locality",
                "territory_type",
                "ownership_type",
                "responsible_organization",
                "responsible_department",
                "assigned_brigade",
            )
            .prefetch_related("rework_events")
            .order_by("-created_at", "-id")
        )
        return Response(RequestListSerializer(qs, many=True, context={"request": request}).data)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


REFRESH_COOKIE_NAME = "refresh_token"

# Храним refresh-токен в httpOnly-cookie для веб-клиента.

def _set_refresh_cookie(response: Response, refresh: str):
    # Не даём доступ к refresh-токену из JS.
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
    # Удаляем refresh-cookie при выходе.
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
        # Берём refresh-токен из cookie, а не из тела запроса.
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
        # Пытаемся заблокировать refresh-токен (best-effort).
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
        user = self.request.user
        if user.role not in ("COORDINATOR", "ORG_MANAGER", "ADMIN"):
            return User.objects.none()

        qs = User.objects.filter(role="WORKER", is_active=True).select_related("organization", "department")
        if user.role == "ORG_MANAGER":
            if not user.organization_id:
                return User.objects.none()
            qs = qs.filter(organization_id=user.organization_id)

        return qs.only(
            "id",
            "username",
            "email",
            "role",
            "phone",
            "city",
            "organization_id",
            "department_id",
            "organization__name",
            "department__name",
        )


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Всегда отвечаем 200, чтобы не раскрывать наличие пользователя.
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}"

            send_mail(
                subject="Password reset",
                message=f"Use this link to reset your password: {reset_link}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )

        # Всегда возвращаем успех, чтобы не раскрывать наличие пользователя.
        return Response({"detail": "If the account exists, a reset email was sent."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Проверяем токен и обновляем пароль.
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"detail": "Invalid link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
