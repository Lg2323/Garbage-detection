from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Brigade, Request, Route, RoutePoint
from .route_services import build_route_order, get_manageable_requests_queryset, infer_route_department
from .services.routing import RoadRouteBuildError, update_route_road_geometry

User = get_user_model()


class AvailableRouteRequestSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    responsible_organization_name = serializers.CharField(source="responsible_organization.name", read_only=True)
    responsible_department_name = serializers.CharField(source="responsible_department.name", read_only=True)
    assigned_brigade_name = serializers.CharField(source="assigned_brigade.name", read_only=True)

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "address",
            "city",
            "status",
            "latitude",
            "longitude",
            "responsible_organization",
            "responsible_organization_name",
            "responsible_department",
            "responsible_department_name",
            "assigned_brigade",
            "assigned_brigade_name",
        )

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None


class RoutePointSerializer(serializers.ModelSerializer):
    request_title = serializers.CharField(source="request.title", read_only=True)
    request_status = serializers.CharField(source="request.status", read_only=True)
    request_city = serializers.CharField(source="request.city", read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = RoutePoint
        fields = (
            "id",
            "request",
            "request_title",
            "request_status",
            "request_city",
            "order_number",
            "address",
            "latitude",
            "longitude",
            "created_at",
        )

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None


class RouteSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    brigade_name = serializers.CharField(source="brigade.name", read_only=True)
    assigned_worker_username = serializers.CharField(source="assigned_worker.username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    points = RoutePointSerializer(many=True, read_only=True)
    points_count = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = (
            "id",
            "organization",
            "organization_name",
            "department",
            "department_name",
            "brigade",
            "brigade_name",
            "assigned_worker",
            "assigned_worker_username",
            "created_by",
            "created_by_username",
            "name",
            "status",
            "comment",
            "route_geometry",
            "distance_meters",
            "duration_seconds",
            "distance_km",
            "duration_minutes",
            "created_at",
            "updated_at",
            "points_count",
            "points",
        )

    def get_points_count(self, obj):
        return obj.points.count()

    def get_distance_km(self, obj):
        if obj.distance_meters is None:
            return None
        return round(obj.distance_meters / 1000, 2)

    def get_duration_minutes(self, obj):
        if obj.duration_seconds is None:
            return None
        return round(obj.duration_seconds / 60, 1)


class RouteCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    request_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=2,
        write_only=True,
    )
    brigade = serializers.PrimaryKeyRelatedField(
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

    def validate_request_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Одна и та же заявка не может быть добавлена в маршрут дважды.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        request_ids = attrs["request_ids"]
        brigade = attrs.get("brigade")
        assigned_worker = attrs.get("assigned_worker")

        available_queryset = (
            get_manageable_requests_queryset(user)
            .select_related("responsible_organization", "responsible_department")
            .filter(id__in=request_ids)
        )
        request_map = {request.id: request for request in available_queryset}
        missing_ids = [request_id for request_id in request_ids if request_id not in request_map]
        if missing_ids:
            raise serializers.ValidationError(
                {
                    "request_ids": (
                        "Недоступные, уже включенные в активный маршрут или неподходящие заявки: "
                        f"{', '.join(str(request_id) for request_id in missing_ids)}."
                    )
                }
            )

        requests = [request_map[request_id] for request_id in request_ids]
        organization_ids = {request.responsible_organization_id for request in requests}
        if len(organization_ids) != 1 or not next(iter(organization_ids), None):
            raise serializers.ValidationError(
                {"request_ids": "Все заявки маршрута должны относиться к одной ответственной организации."}
            )

        organization = requests[0].responsible_organization
        department = infer_route_department(requests, user)
        _validate_route_assignment_context(
            organization=organization,
            department=department,
            brigade=brigade,
            assigned_worker=assigned_worker,
        )

        attrs["organization"] = organization
        attrs["department"] = department
        attrs["requests"] = requests
        return attrs

    def create(self, validated_data):
        requests = validated_data.pop("requests")
        request_ids = validated_data.pop("request_ids")
        organization = validated_data.pop("organization")
        department = validated_data.pop("department")
        user = self.context["request"].user
        brigade = validated_data.get("brigade")
        assigned_worker = validated_data.get("assigned_worker")

        with transaction.atomic():
            route = Route(
                organization=organization,
                department=department,
                created_by=user,
                status=Route.Status.ASSIGNED if brigade or assigned_worker else Route.Status.DRAFT,
                **validated_data,
            )
            route.full_clean()
            route.save()

            points = []
            ordered_requests = build_route_order(requests, request_ids)
            for index, request in enumerate(ordered_requests, start=1):
                point = RoutePoint(
                    route=route,
                    request=request,
                    order_number=index,
                    address=request.address or "",
                    location=request.location,
                )
                point.full_clean()
                points.append(point)

            RoutePoint.objects.bulk_create(points)

        try:
            update_route_road_geometry(route, points)
        except RoadRouteBuildError as exc:
            route._road_route_warning = f"Маршрут создан, но дорожная линия не построена: {exc}."

        return route


class RouteAssignSerializer(serializers.Serializer):
    brigade = serializers.PrimaryKeyRelatedField(
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
        route = self.context["route"]
        brigade = attrs["brigade"] if "brigade" in attrs else route.brigade
        assigned_worker = attrs["assigned_worker"] if "assigned_worker" in attrs else route.assigned_worker

        if "brigade" not in self.initial_data and "assigned_worker" not in self.initial_data:
            raise serializers.ValidationError("Укажите бригаду и/или исполнителя для назначения маршрута.")

        if brigade is None and assigned_worker is None:
            raise serializers.ValidationError("Нельзя снять все назначения через этот endpoint.")

        _validate_route_assignment_context(
            organization=route.organization,
            department=route.department,
            brigade=brigade,
            assigned_worker=assigned_worker,
        )

        attrs["resolved_brigade"] = brigade
        attrs["resolved_assigned_worker"] = assigned_worker
        return attrs

    def save(self, **kwargs):
        route = self.context["route"]
        route.brigade = self.validated_data["resolved_brigade"]
        route.assigned_worker = self.validated_data["resolved_assigned_worker"]
        route.status = Route.Status.ASSIGNED

        update_fields = ["brigade", "assigned_worker", "status", "updated_at"]
        if "comment" in self.validated_data:
            route.comment = self.validated_data["comment"]
            update_fields.append("comment")

        route.full_clean()
        route.save(update_fields=update_fields)
        return route


def _validate_route_assignment_context(*, organization, department, brigade, assigned_worker):
    errors = {}

    if brigade:
        if brigade.organization_id != organization.id:
            errors["brigade"] = "Бригада не относится к организации маршрута."
        elif department and brigade.department_id != department.id:
            errors["brigade"] = "Бригада не относится к подразделению маршрута."
        elif department is None and brigade.department_id:
            errors["brigade"] = "Для маршрута из нескольких подразделений можно выбрать только общую бригаду организации."

    if assigned_worker:
        if assigned_worker.role != User.Role.WORKER:
            errors["assigned_worker"] = "Назначить можно только исполнителя."
        elif assigned_worker.organization_id != organization.id:
            errors["assigned_worker"] = "Исполнитель не относится к организации маршрута."
        elif department and assigned_worker.department_id != department.id:
            errors["assigned_worker"] = "Исполнитель не относится к подразделению маршрута."
        elif department is None and assigned_worker.department_id:
            errors["assigned_worker"] = (
                "Для маршрута из нескольких подразделений можно выбрать только исполнителя уровня организации."
            )

    if brigade and assigned_worker and "assigned_worker" not in errors:
        member_ids = set(brigade.members.values_list("id", flat=True))
        if assigned_worker.id != brigade.supervisor_id and assigned_worker.id not in member_ids:
            errors["assigned_worker"] = "Исполнитель не входит в выбранную бригаду."

    if errors:
        raise serializers.ValidationError(errors)
