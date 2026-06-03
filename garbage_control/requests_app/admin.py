from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import (
    Brigade,
    Department,
    ExternalTransfer,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OrganizationType,
    OwnershipType,
    Request,
    RequestAssignment,
    RequestStatusHistory,
    Route,
    RoutePoint,
    ResponsibilityZone,
    TerritoryType,
)


@admin.register(FederalSubject)
class FederalSubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "federal_subject", "is_active")
    list_filter = ("kind", "is_active", "federal_subject")
    search_fields = ("name",)


@admin.register(Locality)
class LocalityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "municipality", "is_active")
    list_filter = ("kind", "is_active", "municipality")
    search_fields = ("name",)


@admin.register(OrganizationType)
class OrganizationTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "organization_type", "municipality", "locality", "is_external", "is_active")
    list_filter = ("organization_type", "is_external", "is_active")
    search_fields = ("name", "short_name")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "organization", "department_type", "is_active")
    list_filter = ("department_type", "organization", "is_active")
    search_fields = ("name", "code")


@admin.register(Brigade)
class BrigadeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "organization", "department", "brigade_type", "supervisor", "is_active")
    list_filter = ("brigade_type", "organization", "is_active")
    search_fields = ("name",)
    filter_horizontal = ("members",)


@admin.register(TerritoryType)
class TerritoryTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "requires_external_transfer", "is_active")
    list_filter = ("requires_external_transfer", "is_active")
    search_fields = ("code", "name")


@admin.register(OwnershipType)
class OwnershipTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(ResponsibilityZone)
class ResponsibilityZoneAdmin(GISModelAdmin):
    list_display = ("id", "name", "organization", "department", "brigade", "territory_type", "is_active")
    list_filter = ("organization", "territory_type", "is_active")
    search_fields = ("name",)


@admin.register(Request)
class RequestAdmin(GISModelAdmin):
    list_display = (
        "id",
        "title",
        "status",
        "handling_mode",
        "city",
        "responsible_organization",
        "assigned_brigade",
        "assigned_worker",
        "created_at",
    )
    search_fields = ("title", "city", "address")
    list_filter = ("status", "handling_mode", "territory_type", "ownership_type")

    class Media:
        js = ("admin/lock_location_map.js",)


@admin.register(RequestStatusHistory)
class RequestStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "request", "status", "changed_by", "created_at")
    list_filter = ("status",)
    search_fields = ("request__title", "comment")


@admin.register(RequestAssignment)
class RequestAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "request",
        "assignment_type",
        "assigned_organization",
        "assigned_brigade",
        "assigned_worker",
        "created_at",
    )
    list_filter = ("assignment_type", "assigned_organization")
    search_fields = ("request__title", "comment")


@admin.register(ExternalTransfer)
class ExternalTransferAdmin(admin.ModelAdmin):
    list_display = ("id", "request", "target_organization", "recipient_name", "status", "sent_at")
    list_filter = ("status", "target_organization")
    search_fields = ("request__title", "recipient_name", "outgoing_number")


class RoutePointInline(admin.TabularInline):
    model = RoutePoint
    extra = 0
    autocomplete_fields = ("request",)
    ordering = ("order_number", "id")


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "status",
        "organization",
        "department",
        "brigade",
        "assigned_worker",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "organization", "department")
    search_fields = ("name", "comment", "organization__name", "brigade__name", "assigned_worker__username")
    autocomplete_fields = ("organization", "department", "brigade", "assigned_worker", "created_by")
    inlines = (RoutePointInline,)


@admin.register(RoutePoint)
class RoutePointAdmin(admin.ModelAdmin):
    list_display = ("id", "route", "order_number", "request", "address", "created_at")
    list_filter = ("route__organization", "route__status")
    search_fields = ("route__name", "request__title", "address")
    autocomplete_fields = ("route", "request")
