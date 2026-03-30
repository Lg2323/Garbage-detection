from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from requests_app.models import (
    Brigade,
    Department,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OrganizationType,
    OwnershipType,
    Request,
    ResponsibilityZone,
    TerritoryType,
)
from requests_app.permissions import IsAdminRole
from .serializers import AdminUserSerializer, AdminUserCreateSerializer, AdminUserUpdateSerializer


User = get_user_model()


class AdminUserViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]
    queryset = User.objects.select_related("organization", "department").all().order_by("id")

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(phone__icontains=q)
                | Q(organization__name__icontains=q)
                | Q(department__name__icontains=q)
            )
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        if self.action in ("update", "partial_update"):
            return AdminUserUpdateSerializer
        return AdminUserSerializer


class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        req_counts = (
            Request.objects.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        user_counts = (
            User.objects.values("role")
            .annotate(count=Count("id"))
            .order_by("role")
        )

        return Response(
            {
                "requests_total": Request.objects.count(),
                "requests_by_status": list(req_counts),
                "users_total": User.objects.count(),
                "users_by_role": list(user_counts),
                "reference_totals": {
                    "federal_subjects": FederalSubject.objects.count(),
                    "municipalities": Municipality.objects.count(),
                    "localities": Locality.objects.count(),
                    "organization_types": OrganizationType.objects.count(),
                    "organizations": Organization.objects.count(),
                    "departments": Department.objects.count(),
                    "brigades": Brigade.objects.count(),
                    "territory_types": TerritoryType.objects.count(),
                    "ownership_types": OwnershipType.objects.count(),
                    "responsibility_zones": ResponsibilityZone.objects.count(),
                },
            }
        )
