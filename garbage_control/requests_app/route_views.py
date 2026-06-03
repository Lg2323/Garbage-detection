from django.db.models import Prefetch, Q
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from .models import Route, RoutePoint, Request
from .permissions import IsRouteManagerRole, IsRouteWorkerOrManagerOrAdmin
from .route_serializers import (
    AvailableRouteRequestSerializer,
    RouteAssignSerializer,
    RouteCreateSerializer,
    RouteSerializer,
)
from .route_services import apply_available_request_filters, get_manageable_requests_queryset, get_visible_routes_queryset
from .services.routing import RoadRouteBuildError, update_route_road_geometry


class RouteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    permission_classes = [IsAuthenticated]

    def _get_base_queryset(self):
        return (
            Route.objects.select_related(
                "organization",
                "department",
                "brigade",
                "assigned_worker",
                "created_by",
            )
            .prefetch_related(
                Prefetch(
                    "points",
                    queryset=RoutePoint.objects.select_related("request").order_by("order_number", "id"),
                )
            )
            .order_by("-updated_at", "-id")
        )

    def get_queryset(self):
        queryset = get_visible_routes_queryset(self.request.user, self._get_base_queryset())
        status_values = _split_values(self.request.query_params, "status")
        brigade = (self.request.query_params.get("brigade") or "").strip()
        assigned_worker = (self.request.query_params.get("assigned_worker") or "").strip()
        search = (self.request.query_params.get("search") or self.request.query_params.get("q") or "").strip()

        valid_statuses = {value for value, _ in Route.Status.choices}
        if status_values:
            queryset = queryset.filter(status__in=[value for value in status_values if value in valid_statuses])

        if brigade.isdigit():
            queryset = queryset.filter(brigade_id=int(brigade))

        if assigned_worker.isdigit():
            queryset = queryset.filter(assigned_worker_id=int(assigned_worker))

        if search:
            lookup = (
                Q(name__icontains=search)
                | Q(comment__icontains=search)
                | Q(organization__name__icontains=search)
                | Q(department__name__icontains=search)
                | Q(brigade__name__icontains=search)
                | Q(assigned_worker__username__icontains=search)
            )
            normalized_id = search.lstrip("#")
            if normalized_id.isdigit():
                lookup |= Q(id=int(normalized_id))
            queryset = queryset.filter(lookup)

        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return RouteCreateSerializer
        if self.action == "assign":
            return RouteAssignSerializer
        return RouteSerializer

    def get_permissions(self):
        if self.action in ("create", "assign", "cancel", "available_requests", "rebuild_road_route"):
            return [IsAuthenticated(), IsRouteManagerRole()]

        if self.action in ("start", "complete"):
            return [IsAuthenticated(), IsRouteWorkerOrManagerOrAdmin()]

        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        route = serializer.save()
        output = dict(RouteSerializer(route, context={"request": request}).data)
        warning = getattr(route, "_road_route_warning", None)
        if warning:
            output["warning"] = warning
        return Response(output, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="available-requests")
    def available_requests(self, request):
        queryset = (
            get_manageable_requests_queryset(request.user)
            .select_related("responsible_organization", "responsible_department", "assigned_brigade")
        )
        queryset = apply_available_request_filters(queryset, request.query_params)
        serializer = AvailableRouteRequestSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        route = self.get_object()
        if route.status in (Route.Status.COMPLETED, Route.Status.CANCELLED):
            return Response(
                {"error": "Назначение недоступно для завершенного или отмененного маршрута."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "route": route},
        )
        serializer.is_valid(raise_exception=True)
        route = serializer.save()
        return Response(RouteSerializer(route, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        route = self.get_object()

        if route.status == Route.Status.CANCELLED:
            return Response({"error": "Отмененный маршрут нельзя запустить."}, status=status.HTTP_400_BAD_REQUEST)

        if route.status == Route.Status.COMPLETED:
            return Response({"error": "Завершенный маршрут нельзя запустить заново."}, status=status.HTTP_400_BAD_REQUEST)

        if route.status == Route.Status.IN_PROGRESS:
            return Response({"error": "Маршрут уже находится в работе."}, status=status.HTTP_400_BAD_REQUEST)

        if not route.brigade_id and not route.assigned_worker_id:
            return Response(
                {"error": "Сначала назначьте бригаду или исполнителя."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        route.status = Route.Status.IN_PROGRESS
        route.save(update_fields=["status", "updated_at"])
        return Response(RouteSerializer(route, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        route = self.get_object()

        if route.status == Route.Status.CANCELLED:
            return Response({"error": "Отмененный маршрут нельзя завершить."}, status=status.HTTP_400_BAD_REQUEST)

        if route.status == Route.Status.COMPLETED:
            return Response({"error": "Маршрут уже завершен."}, status=status.HTTP_400_BAD_REQUEST)

        incomplete_request_ids = list(
            route.points.exclude(request__status=Request.Status.COMPLETED).values_list("request_id", flat=True)
        )
        if incomplete_request_ids:
            return Response(
                {
                    "error": (
                        "Нельзя завершить маршрут, пока не завершены все заявки. "
                        f"Незавершенные заявки: {', '.join(str(request_id) for request_id in incomplete_request_ids)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        route.status = Route.Status.COMPLETED
        route.save(update_fields=["status", "updated_at"])
        return Response(RouteSerializer(route, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        route = self.get_object()

        if route.status == Route.Status.COMPLETED:
            return Response({"error": "Завершенный маршрут нельзя отменить."}, status=status.HTTP_400_BAD_REQUEST)

        if route.status == Route.Status.CANCELLED:
            return Response({"error": "Маршрут уже отменен."}, status=status.HTTP_400_BAD_REQUEST)

        route.status = Route.Status.CANCELLED
        route.save(update_fields=["status", "updated_at"])
        return Response(RouteSerializer(route, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="rebuild-road-route")
    def rebuild_road_route(self, request, pk=None):
        route = self.get_object()
        points = list(route.points.order_by("order_number", "id"))
        if len(points) < 2:
            return Response(
                {"error": "Для построения дорожного маршрута нужны минимум две точки."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            update_route_road_geometry(route, points)
        except RoadRouteBuildError as exc:
            return Response(
                {"error": f"Дорожный маршрут не построен: {exc}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(RouteSerializer(route, context={"request": request}).data, status=status.HTTP_200_OK)


def _split_values(params, key):
    values = []
    for raw_value in params.getlist(key):
        for chunk in raw_value.split(","):
            value = chunk.strip()
            if value:
                values.append(value)
    return values
