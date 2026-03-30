import json

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from rest_framework import serializers

from .models import (
    Brigade,
    Department,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OrganizationType,
    OwnershipType,
    ResponsibilityZone,
    TerritoryType,
)

User = get_user_model()


def _parse_geometry_geojson(value):
    if value in (None, "", {}):
        return None

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise serializers.ValidationError("Invalid geometry JSON.") from exc

    if not isinstance(value, dict):
        raise serializers.ValidationError("Geometry must be a GeoJSON object.")

    try:
        geometry = GEOSGeometry(json.dumps(value), srid=4326)
    except Exception as exc:  # pragma: no cover - GIS parsing depends on GEOS runtime
        raise serializers.ValidationError("Failed to parse geometry.") from exc

    if geometry.geom_type == "Polygon":
        geometry = MultiPolygon(geometry)

    if geometry.geom_type != "MultiPolygon":
        raise serializers.ValidationError("Only Polygon or MultiPolygon geometry is supported.")

    return geometry


class FederalSubjectAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = FederalSubject
        fields = ("id", "code", "name", "is_active")


class MunicipalityAdminSerializer(serializers.ModelSerializer):
    federal_subject_name = serializers.CharField(source="federal_subject.name", read_only=True)

    class Meta:
        model = Municipality
        fields = ("id", "federal_subject", "federal_subject_name", "name", "kind", "is_active")


class LocalityAdminSerializer(serializers.ModelSerializer):
    municipality_name = serializers.CharField(source="municipality.name", read_only=True)
    federal_subject = serializers.IntegerField(source="municipality.federal_subject_id", read_only=True)
    federal_subject_name = serializers.CharField(source="municipality.federal_subject.name", read_only=True)

    class Meta:
        model = Locality
        fields = (
            "id",
            "municipality",
            "municipality_name",
            "federal_subject",
            "federal_subject_name",
            "name",
            "kind",
            "is_active",
        )


class OrganizationTypeAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationType
        fields = ("id", "code", "name", "description", "is_active")


class OrganizationAdminSerializer(serializers.ModelSerializer):
    organization_type_name = serializers.CharField(source="organization_type.name", read_only=True)
    federal_subject_name = serializers.CharField(source="federal_subject.name", read_only=True)
    municipality_name = serializers.CharField(source="municipality.name", read_only=True)
    locality_name = serializers.CharField(source="locality.name", read_only=True)

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "short_name",
            "organization_type",
            "organization_type_name",
            "federal_subject",
            "federal_subject_name",
            "municipality",
            "municipality_name",
            "locality",
            "locality_name",
            "address",
            "contact_phone",
            "email",
            "is_external",
            "is_active",
        )


class DepartmentAdminSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    parent_department_name = serializers.CharField(source="parent_department.name", read_only=True)

    class Meta:
        model = Department
        fields = (
            "id",
            "organization",
            "organization_name",
            "parent_department",
            "parent_department_name",
            "name",
            "code",
            "department_type",
            "is_active",
        )


class BrigadeAdminSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    supervisor_username = serializers.CharField(source="supervisor.username", read_only=True)
    members = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        many=True,
        required=False,
    )
    member_usernames = serializers.SerializerMethodField()

    class Meta:
        model = Brigade
        fields = (
            "id",
            "organization",
            "organization_name",
            "department",
            "department_name",
            "supervisor",
            "supervisor_username",
            "members",
            "member_usernames",
            "name",
            "brigade_type",
            "is_active",
        )

    def get_member_usernames(self, obj):
        return [{"id": member.id, "username": member.username} for member in obj.members.all().order_by("username")]


class TerritoryTypeAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerritoryType
        fields = ("id", "code", "name", "description", "requires_external_transfer", "is_active")


class OwnershipTypeAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnershipType
        fields = ("id", "code", "name", "description", "is_active")


class ResponsibilityZoneAdminSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    brigade_name = serializers.CharField(source="brigade.name", read_only=True)
    federal_subject_name = serializers.CharField(source="federal_subject.name", read_only=True)
    municipality_name = serializers.CharField(source="municipality.name", read_only=True)
    locality_name = serializers.CharField(source="locality.name", read_only=True)
    territory_type_name = serializers.CharField(source="territory_type.name", read_only=True)
    geometry_geojson = serializers.SerializerMethodField()
    geometry_input = serializers.JSONField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = ResponsibilityZone
        fields = (
            "id",
            "name",
            "organization",
            "organization_name",
            "department",
            "department_name",
            "brigade",
            "brigade_name",
            "federal_subject",
            "federal_subject_name",
            "municipality",
            "municipality_name",
            "locality",
            "locality_name",
            "territory_type",
            "territory_type_name",
            "comment",
            "is_active",
            "geometry_geojson",
            "geometry_input",
        )

    def get_geometry_geojson(self, instance):
        return json.loads(instance.geometry.geojson) if instance.geometry else None

    def validate(self, attrs):
        organization = attrs.get("organization")
        department = attrs.get("department")
        brigade = attrs.get("brigade")
        municipality = attrs.get("municipality")
        locality = attrs.get("locality")

        if department and organization and department.organization_id != organization.id:
            raise serializers.ValidationError("Department does not belong to the selected organization.")

        if brigade and organization and brigade.organization_id != organization.id:
            raise serializers.ValidationError("Brigade does not belong to the selected organization.")

        if locality and municipality and locality.municipality_id != municipality.id:
            raise serializers.ValidationError("Locality does not belong to the selected municipality.")

        return attrs

    def create(self, validated_data):
        geometry_geojson = validated_data.pop("geometry_input", None)
        if "geometry" in validated_data:
            validated_data.pop("geometry")
        if geometry_geojson is not None:
            validated_data["geometry"] = _parse_geometry_geojson(geometry_geojson)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        geometry_geojson = validated_data.pop("geometry_input", serializers.empty)
        if "geometry" in validated_data:
            validated_data.pop("geometry")
        if geometry_geojson is not serializers.empty:
            instance.geometry = _parse_geometry_geojson(geometry_geojson)
        return super().update(instance, validated_data)
