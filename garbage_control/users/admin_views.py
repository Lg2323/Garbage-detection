from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Max, Q
from django.db.models.functions import Coalesce, TruncMonth
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
    RequestAssignment,
    RequestRework,
    ResponsibilityZone,
    TerritoryType,
)
from requests_app.permissions import IsAdminRole
from .serializers import AdminUserCreateSerializer, AdminUserSerializer, AdminUserUpdateSerializer


User = get_user_model()


def _duration_to_hours(value):
    if not value:
        return None
    return round(value.total_seconds() / 3600, 2)


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
        request_qs = Request.objects.select_related("responsible_organization", "assigned_worker")
        completed_qs = request_qs.filter(status=Request.Status.COMPLETED)
        transferred_qs = request_qs.filter(status=Request.Status.TRANSFERRED)
        active_qs = request_qs.exclude(status__in=(Request.Status.COMPLETED, Request.Status.TRANSFERRED))

        req_counts = request_qs.values("status").annotate(count=Count("id")).order_by("status")
        user_counts = User.objects.values("role").annotate(count=Count("id")).order_by("role")

        resolution_time = ExpressionWrapper(
            F("updated_at") - F("created_at"),
            output_field=DurationField(),
        )
        avg_resolution = completed_qs.annotate(resolution_time=resolution_time).aggregate(
            avg=Avg("resolution_time")
        )["avg"]

        worker_current_load = {
            row["assigned_worker_id"]: row
            for row in request_qs.filter(assigned_worker__isnull=False)
            .values("assigned_worker_id")
            .annotate(
                active_requests=Count(
                    "id",
                    filter=~Q(status__in=(Request.Status.COMPLETED, Request.Status.TRANSFERRED)),
                ),
                waiting_for_start=Count("id", filter=Q(status=Request.Status.VERIFIED)),
                in_progress_requests=Count("id", filter=Q(status=Request.Status.IN_PROGRESS)),
                on_check_requests=Count("id", filter=Q(status=Request.Status.ON_CHECK)),
            )
        }

        assignment_time = ExpressionWrapper(
            F("completed_at") - Coalesce("accepted_at", "created_at"),
            output_field=DurationField(),
        )
        worker_completed_load = {
            row["assigned_worker_id"]: row
            for row in RequestAssignment.objects.filter(
                assigned_worker__isnull=False,
                completed_at__isnull=False,
            )
            .annotate(completion_time=assignment_time)
            .values("assigned_worker_id")
            .annotate(
                completed_requests=Count("id"),
                avg_completion_time=Avg("completion_time"),
                last_completed_at=Max("completed_at"),
            )
        }

        worker_rows = []
        for worker in User.objects.filter(role=User.Role.WORKER, is_active=True).select_related(
            "organization",
            "department",
        ):
            current_row = worker_current_load.get(worker.id, {})
            completed_row = worker_completed_load.get(worker.id, {})
            worker_rows.append(
                {
                    "id": worker.id,
                    "username": worker.username,
                    "organization_name": worker.organization.name if worker.organization_id else "",
                    "department_name": worker.department.name if worker.department_id else "",
                    "active_requests": current_row.get("active_requests", 0),
                    "waiting_for_start": current_row.get("waiting_for_start", 0),
                    "in_progress_requests": current_row.get("in_progress_requests", 0),
                    "on_check_requests": current_row.get("on_check_requests", 0),
                    "completed_requests": completed_row.get("completed_requests", 0),
                    "avg_completion_hours": _duration_to_hours(
                        completed_row.get("avg_completion_time")
                    ),
                    "last_completed_at": (
                        completed_row["last_completed_at"].isoformat()
                        if completed_row.get("last_completed_at")
                        else None
                    ),
                }
            )

        worker_rows.sort(
            key=lambda item: (
                -item["active_requests"],
                -item["on_check_requests"],
                -item["completed_requests"],
                item["username"].lower(),
            )
        )

        active_workers = sum(1 for item in worker_rows if item["active_requests"] > 0)
        workers_with_on_check = sum(1 for item in worker_rows if item["on_check_requests"] > 0)
        idle_workers = sum(1 for item in worker_rows if item["active_requests"] == 0)

        organization_backlog = list(
            active_qs.values("responsible_organization", "responsible_organization__name")
            .annotate(active_requests=Count("id"))
            .exclude(responsible_organization__isnull=True)
            .order_by("-active_requests", "responsible_organization__name")[:8]
        )

        timeline = list(
            request_qs.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        requests_total = request_qs.count()
        completed_total = completed_qs.count()
        transferred_total = transferred_qs.count()

        return Response(
            {
                "requests_total": requests_total,
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
                "request_efficiency": {
                    "active_requests": active_qs.count(),
                    "waiting_for_start": active_qs.filter(status=Request.Status.VERIFIED).count(),
                    "on_check_requests": active_qs.filter(status=Request.Status.ON_CHECK).count(),
                    "unassigned_requests": active_qs.filter(assigned_worker__isnull=True).count(),
                    "completed_requests": completed_total,
                    "transferred_requests": transferred_total,
                    "rework_requests": RequestRework.objects.values("request_id").distinct().count(),
                    "completion_rate": round((completed_total / requests_total * 100), 2)
                    if requests_total
                    else 0,
                    "transfer_rate": round((transferred_total / requests_total * 100), 2)
                    if requests_total
                    else 0,
                    "avg_completion_hours": _duration_to_hours(avg_resolution),
                },
                "worker_load_summary": {
                    "active_workers": active_workers,
                    "idle_workers": idle_workers,
                    "workers_with_on_check": workers_with_on_check,
                },
                "worker_load": worker_rows,
                "organization_backlog": [
                    {
                        "organization_id": item["responsible_organization"],
                        "organization_name": item["responsible_organization__name"],
                        "active_requests": item["active_requests"],
                    }
                    for item in organization_backlog
                ],
                "request_timeline": [
                    {
                        "period": item["month"].date().isoformat() if item["month"] else None,
                        "count": item["count"],
                    }
                    for item in timeline
                ],
            }
        )
