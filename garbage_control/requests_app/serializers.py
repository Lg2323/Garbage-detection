import json
from collections.abc import Mapping

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.db.models import Q
from rest_framework import serializers

from .geocoding import detect_city_by_coordinates
from .models import (
    Brigade,
    Department,
    ExternalTransfer,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OwnershipType,
    Request,
    RequestAssignment,
    RequestRework,
    RequestStatusHistory,
    ResponsibilityZone,
    TerritoryType,
    VerificationResult,
)

User = get_user_model()


class RequestReworkSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    previous_worker_username = serializers.CharField(source="previous_worker.username", read_only=True)
    new_worker_username = serializers.CharField(source="new_worker.username", read_only=True)

    class Meta:
        model = RequestRework
        fields = (
            "id",
            "comment",
            "created_at",
            "previous_status",
            "created_by",
            "created_by_username",
            "previous_worker",
            "previous_worker_username",
            "new_worker",
            "new_worker_username",
        )


class RequestCreateSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True)
    longitude = serializers.FloatField(write_only=True)
    city = serializers.CharField(required=False, allow_blank=True, max_length=120)
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "address",
            "latitude",
            "longitude",
            "city",
            "location",
            "before_photo",
            "created_at",
        )
        read_only_fields = ("id", "location", "created_at")

    def create(self, validated_data):
        lat = validated_data.pop("latitude")
        lon = validated_data.pop("longitude")
        provided_city = (validated_data.pop("city", "") or "").strip()
        detected_city = detect_city_by_coordinates(lat, lon)
        validated_data["city"] = detected_city or provided_city
        validated_data["location"] = Point(lon, lat)
        return super().create(validated_data)


class RequestListSerializer(serializers.ModelSerializer):
    last_rework_comment = serializers.SerializerMethodField()
    rework_count = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    assigned_worker_username = serializers.CharField(source="assigned_worker.username", read_only=True)
    assigned_worker_organization_name = serializers.CharField(
        source="assigned_worker.organization.name",
        read_only=True,
    )
    assigned_worker_department_name = serializers.CharField(
        source="assigned_worker.department.name",
        read_only=True,
    )
    coordinator_username = serializers.CharField(source="coordinator.username", read_only=True)
    territory_type_name = serializers.CharField(source="territory_type.name", read_only=True)
    ownership_type_name = serializers.CharField(source="ownership_type.name", read_only=True)
    responsible_organization_name = serializers.CharField(source="responsible_organization.name", read_only=True)
    responsible_department_name = serializers.CharField(source="responsible_department.name", read_only=True)
    assigned_brigade_name = serializers.CharField(source="assigned_brigade.name", read_only=True)
    federal_subject_name = serializers.CharField(source="federal_subject.name", read_only=True)
    municipality_name = serializers.CharField(source="municipality.name", read_only=True)
    locality_name = serializers.CharField(source="locality.name", read_only=True)

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "address",
            "status",
            "handling_mode",
            "city",
            "location",
            "latitude",
            "longitude",
            "federal_subject",
            "federal_subject_name",
            "municipality",
            "municipality_name",
            "locality",
            "locality_name",
            "territory_type",
            "territory_type_name",
            "ownership_type",
            "ownership_type_name",
            "created_by",
            "created_by_username",
            "responsible_organization",
            "responsible_organization_name",
            "responsible_department",
            "responsible_department_name",
            "assigned_brigade",
            "assigned_brigade_name",
            "assigned_worker",
            "assigned_worker_username",
            "assigned_worker_organization_name",
            "assigned_worker_department_name",
            "coordinator",
            "coordinator_username",
            "created_at",
            "updated_at",
            "last_rework_comment",
            "rework_count",
        )

    def get_last_rework_comment(self, obj):
        event = obj.rework_events.order_by("-created_at").first()
        return event.comment if event else ""

    def get_rework_count(self, obj):
        return obj.rework_events.count()

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None


class VerificationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationResult
        fields = ("is_clean", "score", "details", "created_at")


class RequestStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source="changed_by.username", read_only=True)

    class Meta:
        model = RequestStatusHistory
        fields = ("id", "status", "comment", "changed_by", "changed_by_username", "created_at")


class RequestAssignmentSerializer(serializers.ModelSerializer):
    assigned_by_username = serializers.CharField(source="assigned_by.username", read_only=True)
    assigned_worker_username = serializers.CharField(source="assigned_worker.username", read_only=True)
    assigned_organization_name = serializers.CharField(source="assigned_organization.name", read_only=True)
    assigned_department_name = serializers.CharField(source="assigned_department.name", read_only=True)
    assigned_brigade_name = serializers.CharField(source="assigned_brigade.name", read_only=True)

    class Meta:
        model = RequestAssignment
        fields = (
            "id",
            "assignment_type",
            "assigned_by",
            "assigned_by_username",
            "assigned_organization",
            "assigned_organization_name",
            "assigned_department",
            "assigned_department_name",
            "assigned_brigade",
            "assigned_brigade_name",
            "assigned_worker",
            "assigned_worker_username",
            "comment",
            "created_at",
            "accepted_at",
            "completed_at",
        )


class ExternalTransferSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    target_organization_name = serializers.CharField(source="target_organization.name", read_only=True)

    class Meta:
        model = ExternalTransfer
        fields = (
            "id",
            "target_organization",
            "target_organization_name",
            "recipient_name",
            "recipient_contact",
            "transfer_reason",
            "comment",
            "outgoing_number",
            "status",
            "created_by",
            "created_by_username",
            "sent_at",
            "closed_at",
        )


class ResponsibilityZonePreviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    organization = serializers.IntegerField(allow_null=True)
    organization_name = serializers.CharField(allow_blank=True)
    department = serializers.IntegerField(allow_null=True)
    department_name = serializers.CharField(allow_blank=True)
    brigade = serializers.IntegerField(allow_null=True)
    brigade_name = serializers.CharField(allow_blank=True)
    territory_type = serializers.IntegerField(allow_null=True)
    territory_type_name = serializers.CharField(allow_blank=True)
    comment = serializers.CharField(allow_blank=True)
    geometry_geojson = serializers.JSONField(allow_null=True)
    is_selected = serializers.BooleanField()
    match_reasons = serializers.ListField(child=serializers.CharField(), allow_empty=True)


class RequestDetailSerializer(serializers.ModelSerializer):
    verification = VerificationResultSerializer(read_only=True)
    rework_events = RequestReworkSerializer(many=True, read_only=True)
    status_history = RequestStatusHistorySerializer(many=True, read_only=True)
    assignments = RequestAssignmentSerializer(many=True, read_only=True)
    external_transfers = ExternalTransferSerializer(many=True, read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    responsibility_zones = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    assigned_worker_username = serializers.CharField(source="assigned_worker.username", read_only=True)
    assigned_worker_organization_name = serializers.CharField(
        source="assigned_worker.organization.name",
        read_only=True,
    )
    assigned_worker_department_name = serializers.CharField(
        source="assigned_worker.department.name",
        read_only=True,
    )
    coordinator_username = serializers.CharField(source="coordinator.username", read_only=True)
    territory_type_name = serializers.CharField(source="territory_type.name", read_only=True)
    ownership_type_name = serializers.CharField(source="ownership_type.name", read_only=True)
    responsible_organization_name = serializers.CharField(source="responsible_organization.name", read_only=True)
    responsible_department_name = serializers.CharField(source="responsible_department.name", read_only=True)
    assigned_brigade_name = serializers.CharField(source="assigned_brigade.name", read_only=True)
    federal_subject_name = serializers.CharField(source="federal_subject.name", read_only=True)
    municipality_name = serializers.CharField(source="municipality.name", read_only=True)
    locality_name = serializers.CharField(source="locality.name", read_only=True)

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "address",
            "status",
            "handling_mode",
            "city",
            "location",
            "latitude",
            "longitude",
            "federal_subject",
            "federal_subject_name",
            "municipality",
            "municipality_name",
            "locality",
            "locality_name",
            "territory_type",
            "territory_type_name",
            "ownership_type",
            "ownership_type_name",
            "created_by",
            "created_by_username",
            "responsible_organization",
            "responsible_organization_name",
            "responsible_department",
            "responsible_department_name",
            "assigned_brigade",
            "assigned_brigade_name",
            "assigned_worker",
            "assigned_worker_username",
            "assigned_worker_organization_name",
            "assigned_worker_department_name",
            "coordinator",
            "coordinator_username",
            "classification_comment",
            "before_photo",
            "after_photo",
            "verification",
            "status_history",
            "assignments",
            "external_transfers",
            "rework_events",
            "responsibility_zones",
            "created_at",
            "updated_at",
        )

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None

    def get_responsibility_zones(self, obj):
        zone_qs = ResponsibilityZone.objects.filter(is_active=True).select_related(
            "organization",
            "department",
            "brigade",
            "territory_type",
            "federal_subject",
            "municipality",
            "locality",
        )

        if obj.federal_subject_id:
            zone_qs = zone_qs.filter(
                Q(federal_subject_id=obj.federal_subject_id) | Q(federal_subject__isnull=True)
            )

        if obj.municipality_id:
            zone_qs = zone_qs.filter(
                Q(municipality_id=obj.municipality_id) | Q(municipality__isnull=True)
            )

        if obj.locality_id:
            zone_qs = zone_qs.filter(Q(locality_id=obj.locality_id) | Q(locality__isnull=True))

        if obj.territory_type_id:
            zone_qs = zone_qs.filter(
                Q(territory_type_id=obj.territory_type_id) | Q(territory_type__isnull=True)
            )

        point = obj.location
        payload = []

        for zone in zone_qs[:200]:
            match_reasons = []

            if zone.geometry and point and zone.geometry.intersects(point):
                match_reasons.append("Точка заявки попадает в полигон")
            elif not zone.geometry:
                if zone.locality_id and obj.locality_id and zone.locality_id == obj.locality_id:
                    match_reasons.append("Совпадает населённый пункт")
                elif zone.municipality_id and obj.municipality_id and zone.municipality_id == obj.municipality_id:
                    match_reasons.append("Совпадает муниципалитет")
                elif zone.federal_subject_id and obj.federal_subject_id and zone.federal_subject_id == obj.federal_subject_id:
                    match_reasons.append("Совпадает субъект РФ")

            if zone.territory_type_id and obj.territory_type_id and zone.territory_type_id == obj.territory_type_id:
                match_reasons.append("Подходит тип территории")

            is_selected = bool(
                (obj.assigned_brigade_id and zone.brigade_id == obj.assigned_brigade_id)
                or (obj.responsible_department_id and zone.department_id == obj.responsible_department_id)
                or (obj.responsible_organization_id and zone.organization_id == obj.responsible_organization_id)
            )
            if is_selected:
                match_reasons.append("Текущий маршрут заявки")

            if not match_reasons:
                continue

            payload.append(
                {
                    "id": zone.id,
                    "name": zone.name,
                    "organization": zone.organization_id,
                    "organization_name": zone.organization.name if zone.organization_id else "",
                    "department": zone.department_id,
                    "department_name": zone.department.name if zone.department_id else "",
                    "brigade": zone.brigade_id,
                    "brigade_name": zone.brigade.name if zone.brigade_id else "",
                    "territory_type": zone.territory_type_id,
                    "territory_type_name": zone.territory_type.name if zone.territory_type_id else "",
                    "comment": zone.comment or "",
                    "geometry_geojson": (
                        json.loads(zone.geometry.geojson) if zone.geometry else None
                    ),
                    "is_selected": is_selected,
                    "match_reasons": list(dict.fromkeys(match_reasons)),
                }
            )

        payload.sort(
            key=lambda item: (
                0 if item["is_selected"] else 1,
                0 if any("полигон" in reason.lower() for reason in item["match_reasons"]) else 1,
                item["name"].lower(),
            )
        )
        return ResponsibilityZonePreviewSerializer(payload, many=True).data


class RequestCompletedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "address",
            "status",
            "city",
            "handling_mode",
            "before_photo",
            "after_photo",
            "created_at",
            "updated_at",
        )


class AssignWorkerSerializer(serializers.Serializer):
    worker_id = serializers.IntegerField(min_value=1)


class StrictFieldsSerializer(serializers.Serializer):
    forbidden_field_errors: dict[str, str] = {}
    unexpected_field_message = "Недопустимое поле для этого действия."

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"non_field_errors": ["Ожидался JSON-объект."]})

        errors = {}
        allowed_fields = set(self.fields)

        for field_name in data.keys():
            if field_name in self.forbidden_field_errors:
                errors[field_name] = [self.forbidden_field_errors[field_name]]
            elif field_name not in allowed_fields:
                errors[field_name] = [self.unexpected_field_message]

        if errors:
            raise serializers.ValidationError(errors)

        return super().to_internal_value(data)


class OrganizationAssignSerializer(StrictFieldsSerializer):
    forbidden_field_errors = {
        "assigned_brigade": "Руководитель организации назначает только подразделение. Выбор бригады выполняет руководитель подразделения.",
        "assigned_worker": "Руководитель организации не может назначать исполнителя. Это делает руководитель подразделения или администратор по override.",
    }

    responsible_department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        organization = self.context["organization"]
        department = attrs.get("responsible_department")
        errors = {}

        if department and department.organization_id != organization.id:
            raise serializers.ValidationError("Подразделение не относится к организации заявки.")

        return attrs

        if brigade and brigade.organization_id != organization.id:
            raise serializers.ValidationError("Бригада не относится к организации заявки.")

        if brigade and department and brigade.department_id and brigade.department_id != department.id:
            raise serializers.ValidationError("Бригада не относится к выбранному подразделению.")

        if worker and worker.role != "WORKER":
            raise serializers.ValidationError("Назначить можно только исполнителя.")

        if worker and worker.organization_id and worker.organization_id != organization.id:
            raise serializers.ValidationError("Исполнитель не относится к организации заявки.")

        if worker and department and worker.department_id and worker.department_id != department.id:
            raise serializers.ValidationError("Исполнитель не относится к выбранному подразделению.")

        if worker and brigade:
            brigade_member_ids = set(brigade.members.values_list("id", flat=True))
            if brigade_member_ids and worker.id not in brigade_member_ids and worker.id != brigade.supervisor_id:
                raise serializers.ValidationError("Исполнитель не входит в выбранную бригаду.")

        return attrs


class DepartmentAssignSerializer(StrictFieldsSerializer):
    assigned_brigade = serializers.PrimaryKeyRelatedField(
        queryset=Brigade.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    assigned_worker = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, role=User.Role.WORKER),
        required=False,
        allow_null=True,
    )
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        department = self.context["department"]
        brigade = attrs.get("assigned_brigade")
        worker = attrs.get("assigned_worker")
        errors = {}

        if brigade:
            if brigade.organization_id != department.organization_id:
                errors["assigned_brigade"] = "Бригада не относится к организации подразделения."
            elif brigade.department_id != department.id:
                errors["assigned_brigade"] = "Бригада не относится к подразделению заявки."

        if worker:
            if worker.role != User.Role.WORKER:
                errors["assigned_worker"] = "Назначить можно только исполнителя."
            elif worker.organization_id != department.organization_id:
                errors["assigned_worker"] = "Исполнитель не относится к организации подразделения."
            elif worker.department_id != department.id:
                errors["assigned_worker"] = "Исполнитель не относится к подразделению заявки."

        if worker and not brigade:
            errors["assigned_brigade"] = "Сначала выберите бригаду подразделения."

        if brigade and worker and "assigned_worker" not in errors:
            brigade_member_ids = set(brigade.members.values_list("id", flat=True))
            if worker.id != brigade.supervisor_id and worker.id not in brigade_member_ids:
                errors["assigned_worker"] = "Исполнитель не входит в выбранную бригаду."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class UploadAfterPhotoSerializer(serializers.Serializer):
    after_photo = serializers.ImageField()


class VerifyRequestSerializer(serializers.Serializer):
    force = serializers.BooleanField(required=False, default=False)


class AdminSetStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Request.Status.choices)


class ReturnToWorkSerializer(serializers.Serializer):
    comment = serializers.CharField(min_length=5, max_length=2000)


class ClassifyRequestSerializer(StrictFieldsSerializer):
    forbidden_field_errors = {
        "responsible_department": "Координатор назначает только ответственную организацию. Подразделение назначает руководитель организации.",
        "assigned_brigade": "Координатор не может назначать бригаду. Это делает руководитель подразделения.",
        "assigned_worker": "Координатор не может назначать исполнителя. Это делает руководитель подразделения или администратор по override.",
    }

    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    federal_subject = serializers.PrimaryKeyRelatedField(
        queryset=FederalSubject.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    municipality = serializers.PrimaryKeyRelatedField(
        queryset=Municipality.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    locality = serializers.PrimaryKeyRelatedField(
        queryset=Locality.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    territory_type = serializers.PrimaryKeyRelatedField(
        queryset=TerritoryType.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    ownership_type = serializers.PrimaryKeyRelatedField(
        queryset=OwnershipType.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    handling_mode = serializers.ChoiceField(choices=Request.HandlingMode.choices, required=False)
    responsible_organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    classification_comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        federal_subject = attrs.get("federal_subject")
        municipality = attrs.get("municipality")
        locality = attrs.get("locality")

        if municipality and federal_subject and municipality.federal_subject_id != federal_subject.id:
            raise serializers.ValidationError("Муниципалитет не относится к выбранному субъекту РФ.")

        if locality and municipality and locality.municipality_id != municipality.id:
            raise serializers.ValidationError("Населённый пункт не относится к выбранному муниципалитету.")

        if locality and federal_subject and locality.municipality.federal_subject_id != federal_subject.id:
            raise serializers.ValidationError("Населённый пункт не относится к выбранному субъекту РФ.")

        return attrs

        if False:
            raise serializers.ValidationError("Подразделение не относится к выбранной организации.")

        if False:
            raise serializers.ValidationError("Бригада не относится к выбранной организации.")

        if False:
            raise serializers.ValidationError("Бригада не относится к выбранному подразделению.")

        return attrs


class ExternalTransferCreateSerializer(serializers.Serializer):
    target_organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    recipient_contact = serializers.CharField(required=False, allow_blank=True, max_length=255)
    transfer_reason = serializers.CharField(min_length=5, max_length=4000)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    outgoing_number = serializers.CharField(required=False, allow_blank=True, max_length=100)

    def validate(self, attrs):
        target_organization = attrs.get("target_organization")
        recipient_name = (attrs.get("recipient_name") or "").strip()
        if not target_organization and not recipient_name:
            raise serializers.ValidationError(
                "Укажите организацию-адресата или текстовое имя получателя."
            )
        return attrs
