from math import asin, cos, radians, sin, sqrt

from django.db.models import Q

from .models import Request, Route


ACTIVE_ROUTE_STATUSES = (
    Route.Status.DRAFT,
    Route.Status.ASSIGNED,
    Route.Status.IN_PROGRESS,
)

ROUTE_BLOCKED_REQUEST_STATUSES = (
    Request.Status.COMPLETED,
    Request.Status.TRANSFERRED,
)


def get_visible_routes_queryset(user, queryset=None):
    qs = queryset or Route.objects.all()

    if user.role == "ADMIN":
        return qs

    if user.role == "ORG_MANAGER":
        if not user.organization_id:
            return qs.none()
        return qs.filter(organization_id=user.organization_id)

    if user.role == "DEPARTMENT_MANAGER":
        if not user.organization_id or not user.department_id:
            return qs.none()
        return qs.filter(
            organization_id=user.organization_id,
            department_id=user.department_id,
        )

    if user.role == "WORKER":
        return qs.filter(
            Q(assigned_worker_id=user.id)
            | Q(brigade__members=user)
            | Q(brigade__supervisor_id=user.id)
        ).distinct()

    return qs.none()


def get_manageable_requests_queryset(user):
    qs = Request.objects.exclude(status__in=ROUTE_BLOCKED_REQUEST_STATUSES).exclude(
        responsible_organization__isnull=True
    )
    qs = qs.exclude(route_points__route__status__in=ACTIVE_ROUTE_STATUSES)

    if user.role == "ADMIN":
        return qs.distinct()

    if user.role == "ORG_MANAGER":
        if not user.organization_id:
            return qs.none()
        return qs.filter(responsible_organization_id=user.organization_id).distinct()

    if user.role == "DEPARTMENT_MANAGER":
        if not user.organization_id or not user.department_id:
            return qs.none()
        return qs.filter(
            responsible_organization_id=user.organization_id,
            responsible_department_id=user.department_id,
        ).distinct()

    return qs.none()


def apply_available_request_filters(qs, params):
    search = (params.get("search") or params.get("q") or "").strip()
    city = (params.get("city") or "").strip()
    status_values = _split_values(params, "status")
    department = (params.get("department") or "").strip()
    brigade = (params.get("brigade") or "").strip()

    if status_values:
        valid_statuses = {value for value, _ in Request.Status.choices}
        qs = qs.filter(status__in=[value for value in status_values if value in valid_statuses])

    if department.isdigit():
        qs = qs.filter(responsible_department_id=int(department))

    if brigade.isdigit():
        qs = qs.filter(assigned_brigade_id=int(brigade))

    if city:
        qs = qs.filter(city__icontains=city)

    if search:
        lookup = (
            Q(title__icontains=search)
            | Q(address__icontains=search)
            | Q(city__icontains=search)
            | Q(responsible_organization__name__icontains=search)
            | Q(responsible_department__name__icontains=search)
            | Q(assigned_brigade__name__icontains=search)
        )
        normalized_id = search.lstrip("#")
        if normalized_id.isdigit():
            lookup |= Q(id=int(normalized_id))
        qs = qs.filter(lookup)

    return qs.order_by("-updated_at", "-id")


def infer_route_department(requests, user):
    if user.role == "DEPARTMENT_MANAGER":
        return user.department

    department_ids = {request.responsible_department_id for request in requests if request.responsible_department_id}
    if len(department_ids) == 1:
        department_id = next(iter(department_ids))
        return next(
            request.responsible_department for request in requests if request.responsible_department_id == department_id
        )

    return None


def build_route_order(requests, request_id_order):
    request_by_id = {request.id: request for request in requests}
    ordered = []
    current = request_by_id[request_id_order[0]]
    ordered.append(current)
    remaining = {request.id: request for request in requests if request.id != current.id}

    while remaining:
        next_request = min(
            remaining.values(),
            key=lambda candidate: _distance_km(current, candidate),
        )
        ordered.append(next_request)
        remaining.pop(next_request.id, None)
        current = next_request

    return ordered


def _split_values(params, key):
    values = []
    raw_values = []

    if hasattr(params, "getlist"):
        raw_values = params.getlist(key)
    else:
        raw_value = params.get(key)
        if raw_value is not None:
            raw_values = [raw_value]

    for raw_value in raw_values:
        for chunk in str(raw_value).split(","):
            value = chunk.strip()
            if value:
                values.append(value)

    return values


def _distance_km(left_request, right_request):
    lat1 = radians(left_request.location.y)
    lon1 = radians(left_request.location.x)
    lat2 = radians(right_request.location.y)
    lon2 = radians(right_request.location.x)
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    haversine = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(haversine))
