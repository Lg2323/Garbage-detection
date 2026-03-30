from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from .admin_serializers import (
    BrigadeAdminSerializer,
    DepartmentAdminSerializer,
    FederalSubjectAdminSerializer,
    LocalityAdminSerializer,
    MunicipalityAdminSerializer,
    OrganizationAdminSerializer,
    OrganizationTypeAdminSerializer,
    OwnershipTypeAdminSerializer,
    ResponsibilityZoneAdminSerializer,
    TerritoryTypeAdminSerializer,
)
from .models import (
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
from .permissions import IsAdminRole

User = get_user_model()


def _serialize_users(qs):
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "city": user.city,
            "phone": user.phone,
            "organization": user.organization_id,
            "organization_name": user.organization.name if user.organization_id else "",
            "department": user.department_id,
            "department_name": user.department.name if user.department_id else "",
        }
        for user in qs
    ]


class AdminSearchViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]
    search_fields = ()
    exact_filters = ()

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get("q") or "").strip()
        if q and self.search_fields:
            lookup = Q()
            for field in self.search_fields:
                lookup |= Q(**{f"{field}__icontains": q})
            qs = qs.filter(lookup)

        for field in self.exact_filters:
            raw_value = (self.request.query_params.get(field) or "").strip()
            if raw_value:
                qs = qs.filter(**{field: raw_value})

        return qs


class FederalSubjectAdminViewSet(AdminSearchViewSet):
    serializer_class = FederalSubjectAdminSerializer
    queryset = FederalSubject.objects.all().order_by("name")
    search_fields = ("name", "code")


class MunicipalityAdminViewSet(AdminSearchViewSet):
    serializer_class = MunicipalityAdminSerializer
    queryset = Municipality.objects.select_related("federal_subject").all().order_by("name")
    search_fields = ("name", "kind", "federal_subject__name")
    exact_filters = ("federal_subject",)


class LocalityAdminViewSet(AdminSearchViewSet):
    serializer_class = LocalityAdminSerializer
    queryset = Locality.objects.select_related("municipality", "municipality__federal_subject").all().order_by("name")
    search_fields = ("name", "kind", "municipality__name", "municipality__federal_subject__name")
    exact_filters = ("municipality",)


class OrganizationTypeAdminViewSet(AdminSearchViewSet):
    serializer_class = OrganizationTypeAdminSerializer
    queryset = OrganizationType.objects.all().order_by("name")
    search_fields = ("name", "code", "description")


class OrganizationAdminViewSet(AdminSearchViewSet):
    serializer_class = OrganizationAdminSerializer
    queryset = Organization.objects.select_related(
        "organization_type",
        "federal_subject",
        "municipality",
        "locality",
    ).all().order_by("name")
    search_fields = (
        "name",
        "short_name",
        "address",
        "contact_phone",
        "email",
        "organization_type__name",
        "federal_subject__name",
        "municipality__name",
        "locality__name",
    )
    exact_filters = ("organization_type", "federal_subject", "municipality", "locality")


class DepartmentAdminViewSet(AdminSearchViewSet):
    serializer_class = DepartmentAdminSerializer
    queryset = Department.objects.select_related("organization", "parent_department").all().order_by("name")
    search_fields = ("name", "code", "department_type", "organization__name")
    exact_filters = ("organization",)


class BrigadeAdminViewSet(AdminSearchViewSet):
    serializer_class = BrigadeAdminSerializer
    queryset = Brigade.objects.select_related("organization", "department", "supervisor").prefetch_related("members").all().order_by("name")
    search_fields = ("name", "brigade_type", "organization__name", "department__name", "supervisor__username")
    exact_filters = ("organization", "department")


class TerritoryTypeAdminViewSet(AdminSearchViewSet):
    serializer_class = TerritoryTypeAdminSerializer
    queryset = TerritoryType.objects.all().order_by("name")
    search_fields = ("name", "code", "description")


class OwnershipTypeAdminViewSet(AdminSearchViewSet):
    serializer_class = OwnershipTypeAdminSerializer
    queryset = OwnershipType.objects.all().order_by("name")
    search_fields = ("name", "code", "description")


class ResponsibilityZoneAdminViewSet(AdminSearchViewSet):
    serializer_class = ResponsibilityZoneAdminSerializer
    queryset = ResponsibilityZone.objects.select_related(
        "organization",
        "department",
        "brigade",
        "federal_subject",
        "municipality",
        "locality",
        "territory_type",
    ).all().order_by("name")
    search_fields = (
        "name",
        "comment",
        "organization__name",
        "department__name",
        "brigade__name",
        "federal_subject__name",
        "municipality__name",
        "locality__name",
        "territory_type__name",
    )
    exact_filters = ("organization", "municipality", "territory_type")


class AdminReferenceOptionsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = User.objects.filter(is_active=True).select_related("organization", "department").order_by("username")
        workers = users.filter(role=User.Role.WORKER)

        payload = {
            "users": _serialize_users(users),
            "workers": _serialize_users(workers),
            "federal_subjects": list(
                FederalSubject.objects.filter(is_active=True).order_by("name").values("id", "code", "name")
            ),
            "municipalities": list(
                Municipality.objects.filter(is_active=True)
                .select_related("federal_subject")
                .order_by("name")
                .values("id", "name", "kind", "federal_subject_id", "federal_subject__name")
            ),
            "localities": list(
                Locality.objects.filter(is_active=True)
                .select_related("municipality", "municipality__federal_subject")
                .order_by("name")
                .values(
                    "id",
                    "name",
                    "kind",
                    "municipality_id",
                    "municipality__name",
                    "municipality__federal_subject_id",
                    "municipality__federal_subject__name",
                )
            ),
            "organization_types": list(
                OrganizationType.objects.filter(is_active=True).order_by("name").values("id", "code", "name")
            ),
            "organizations": list(
                Organization.objects.filter(is_active=True)
                .select_related("organization_type")
                .order_by("name")
                .values("id", "name", "short_name", "organization_type_id", "organization_type__name", "is_external")
            ),
            "departments": list(
                Department.objects.filter(is_active=True)
                .select_related("organization")
                .order_by("name")
                .values("id", "name", "organization_id", "organization__name", "department_type")
            ),
            "brigades": list(
                Brigade.objects.filter(is_active=True)
                .select_related("organization", "department", "supervisor")
                .order_by("name")
                .values(
                    "id",
                    "name",
                    "organization_id",
                    "organization__name",
                    "department_id",
                    "department__name",
                    "supervisor_id",
                    "supervisor__username",
                    "brigade_type",
                )
            ),
            "territory_types": list(
                TerritoryType.objects.filter(is_active=True).order_by("name").values(
                    "id", "code", "name", "requires_external_transfer"
                )
            ),
            "ownership_types": list(
                OwnershipType.objects.filter(is_active=True).order_by("name").values("id", "code", "name")
            ),
            "choices": {
                "municipality_kind": [{"value": code, "label": label} for code, label in Municipality.Kind.choices],
                "locality_kind": [{"value": code, "label": label} for code, label in Locality.Kind.choices],
                "department_type": [{"value": code, "label": label} for code, label in Department.DepartmentType.choices],
                "brigade_type": [{"value": code, "label": label} for code, label in Brigade.BrigadeType.choices],
                "request_status": [{"value": code, "label": label} for code, label in Request.Status.choices],
                "handling_mode": [{"value": code, "label": label} for code, label in Request.HandlingMode.choices],
            },
        }
        return Response(payload)
