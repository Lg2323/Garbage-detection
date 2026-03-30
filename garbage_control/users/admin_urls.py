from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .admin_views import AdminUserViewSet, AdminStatsView
from requests_app.admin_api import (
    AdminReferenceOptionsView,
    BrigadeAdminViewSet,
    DepartmentAdminViewSet,
    FederalSubjectAdminViewSet,
    LocalityAdminViewSet,
    MunicipalityAdminViewSet,
    OrganizationAdminViewSet,
    OrganizationTypeAdminViewSet,
    OwnershipTypeAdminViewSet,
    ResponsibilityZoneAdminViewSet,
    TerritoryTypeAdminViewSet,
)

router = DefaultRouter()
router.register(r"users", AdminUserViewSet, basename="admin-users")
router.register(r"federal-subjects", FederalSubjectAdminViewSet, basename="admin-federal-subjects")
router.register(r"municipalities", MunicipalityAdminViewSet, basename="admin-municipalities")
router.register(r"localities", LocalityAdminViewSet, basename="admin-localities")
router.register(r"organization-types", OrganizationTypeAdminViewSet, basename="admin-organization-types")
router.register(r"organizations", OrganizationAdminViewSet, basename="admin-organizations")
router.register(r"departments", DepartmentAdminViewSet, basename="admin-departments")
router.register(r"brigades", BrigadeAdminViewSet, basename="admin-brigades")
router.register(r"territory-types", TerritoryTypeAdminViewSet, basename="admin-territory-types")
router.register(r"ownership-types", OwnershipTypeAdminViewSet, basename="admin-ownership-types")
router.register(r"responsibility-zones", ResponsibilityZoneAdminViewSet, basename="admin-responsibility-zones")

urlpatterns = [
    path("", include(router.urls)),
    path("stats/", AdminStatsView.as_view()),
    path("reference-options/", AdminReferenceOptionsView.as_view()),
]
