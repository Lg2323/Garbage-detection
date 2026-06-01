import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from ai_verification.services import AIVerifyOutput, detect_garbage_before, verify_cleanup
from .geocoding import detect_city_by_coordinates, detect_location_by_coordinates
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
    ResponsibilityZone,
    TerritoryType,
    VerificationResult,
    create_status_history_entry,
)
from .permissions import IsAdminRole, IsCitizen, IsCoordinator, IsDepartmentManager, IsOrgManager, IsWorker
from .serializers import (
    AdminSetStatusSerializer,
    AssignWorkerSerializer,
    ClassifyRequestSerializer,
    ConfirmPrimaryCheckSerializer,
    DepartmentAssignSerializer,
    ExternalTransferCreateSerializer,
    OrganizationAssignSerializer,
    RequestCompletedSerializer,
    RequestCreateSerializer,
    RequestDetailSerializer,
    RequestListSerializer,
    ReturnToWorkSerializer,
    UploadAfterPhotoSerializer,
    VerificationResultSerializer,
    VerifyRequestSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class RequestViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]

    ORDERING_MAP = {
        "created_at_desc": "-created_at",
        "created_at_asc": "created_at",
        "updated_at_desc": "-updated_at",
        "updated_at_asc": "updated_at",
        "title_asc": "title",
        "title_desc": "-title",
    }

    @staticmethod
    def _extract_precheck_details(request_obj):
        existing_details = (
            VerificationResult.objects.filter(request=request_obj)
            .values_list("details", flat=True)
            .first()
        )
        if not isinstance(existing_details, dict):
            return None
        if isinstance(existing_details.get("precheck"), dict):
            return existing_details["precheck"]
        if existing_details.get("stage") == "before":
            return existing_details
        return None

    def _compose_verification_details(self, request_obj, details):
        payload = dict(details or {})
        if payload.get("stage") == "before":
            return payload

        precheck_details = self._extract_precheck_details(request_obj)
        if precheck_details:
            payload["precheck"] = precheck_details
        return payload

    def _get_base_queryset(self):
        return Request.objects.select_related(
            "created_by",
            "assigned_worker",
            "assigned_worker__organization",
            "assigned_worker__department",
            "coordinator",
            "federal_subject",
            "municipality",
            "locality",
            "territory_type",
            "ownership_type",
            "responsible_organization",
            "responsible_department",
            "assigned_brigade",
            "assigned_brigade__organization",
            "assigned_brigade__department",
        ).prefetch_related("rework_events", "status_history", "assignments", "external_transfers")

    def _get_scoped_worker_queryset(self, request_obj=None):
        qs = User.objects.filter(is_active=True, role=User.Role.WORKER).select_related(
            "organization",
            "department",
        )
        user = self.request.user

        if user.role == User.Role.ORG_MANAGER:
            if not user.organization_id:
                return qs.none()
            qs = qs.filter(organization_id=user.organization_id)
        elif user.role == User.Role.DEPARTMENT_MANAGER:
            if not user.department_id or not user.organization_id:
                return qs.none()
            qs = qs.filter(
                organization_id=user.organization_id,
                department_id=user.department_id,
            )

        if request_obj and request_obj.responsible_organization_id:
            qs = qs.filter(organization_id=request_obj.responsible_organization_id)

        if request_obj and request_obj.responsible_department_id:
            qs = qs.filter(department_id=request_obj.responsible_department_id)

        return qs.order_by("username")

    def _get_scoped_brigade_queryset(self, request_obj=None):
        qs = Brigade.objects.filter(is_active=True).select_related("organization", "department", "supervisor")
        user = self.request.user

        if user.role == User.Role.ORG_MANAGER:
            if not user.organization_id:
                return qs.none()
            qs = qs.filter(organization_id=user.organization_id)
        elif user.role == User.Role.DEPARTMENT_MANAGER:
            if not user.department_id or not user.organization_id:
                return qs.none()
            qs = qs.filter(
                organization_id=user.organization_id,
                department_id=user.department_id,
            )

        if request_obj and request_obj.responsible_organization_id:
            qs = qs.filter(organization_id=request_obj.responsible_organization_id)

        if request_obj and request_obj.responsible_department_id:
            qs = qs.filter(department_id=request_obj.responsible_department_id)

        return qs.order_by("name")

    @staticmethod
    def _worker_matches_request_context(worker, request_obj):
        if request_obj.responsible_organization_id and worker.organization_id:
            if worker.organization_id != request_obj.responsible_organization_id:
                return False

        if request_obj.responsible_department_id and worker.department_id:
            if worker.department_id != request_obj.responsible_department_id:
                return False

        if request_obj.assigned_brigade_id:
            brigade = request_obj.assigned_brigade
            brigade_member_ids = set(brigade.members.values_list("id", flat=True))
            if brigade_member_ids and worker.id not in brigade_member_ids and worker.id != brigade.supervisor_id:
                return False

        return True

    def _get_multi_query_values(self, key):
        values = []
        for raw_value in self.request.query_params.getlist(key):
            for chunk in raw_value.split(","):
                value = chunk.strip()
                if value:
                    values.append(value)
        return values

    def _apply_list_filters(self, qs, *, default_ordering="-created_at", forced_statuses=None):
        query = (self.request.query_params.get("q") or "").strip()
        city = (self.request.query_params.get("city") or "").strip()
        created_from = parse_date((self.request.query_params.get("created_from") or "").strip())
        created_to = parse_date((self.request.query_params.get("created_to") or "").strip())
        updated_from = parse_date((self.request.query_params.get("updated_from") or "").strip())
        updated_to = parse_date((self.request.query_params.get("updated_to") or "").strip())
        assigned_worker = (self.request.query_params.get("assigned_worker") or "").strip()

        valid_statuses = dict(Request.Status.choices)
        valid_handling_modes = dict(Request.HandlingMode.choices)

        if forced_statuses is not None:
            status_values = [status_value for status_value in forced_statuses if status_value in valid_statuses]
        else:
            status_values = [
                status_value
                for status_value in self._get_multi_query_values("status")
                if status_value in valid_statuses
            ]

        handling_modes = [
            handling_mode
            for handling_mode in self._get_multi_query_values("handling_mode")
            if handling_mode in valid_handling_modes
        ]

        if status_values:
            qs = qs.filter(status__in=status_values)

        if handling_modes:
            qs = qs.filter(handling_mode__in=handling_modes)

        if query:
            lookup = (
                Q(title__icontains=query)
                | Q(address__icontains=query)
                | Q(city__icontains=query)
                | Q(created_by__username__icontains=query)
                | Q(assigned_worker__username__icontains=query)
                | Q(coordinator__username__icontains=query)
                | Q(responsible_organization__name__icontains=query)
                | Q(responsible_department__name__icontains=query)
                | Q(assigned_brigade__name__icontains=query)
            )
            normalized_id = query.lstrip("#")
            if normalized_id.isdigit():
                lookup |= Q(id=int(normalized_id))
            qs = qs.filter(lookup)

        if city:
            qs = qs.filter(city__icontains=city)

        if created_from:
            qs = qs.filter(created_at__date__gte=created_from)

        if created_to:
            qs = qs.filter(created_at__date__lte=created_to)

        if updated_from:
            qs = qs.filter(updated_at__date__gte=updated_from)

        if updated_to:
            qs = qs.filter(updated_at__date__lte=updated_to)

        if assigned_worker == "unassigned":
            qs = qs.filter(assigned_worker__isnull=True)
        elif assigned_worker.isdigit():
            qs = qs.filter(assigned_worker_id=int(assigned_worker))

        ordering_key = (self.request.query_params.get("ordering") or "").strip()
        ordering = self.ORDERING_MAP.get(ordering_key, default_ordering)
        return qs.order_by(ordering, "-id")

    def get_queryset(self):
        user = self.request.user
        qs = self._get_base_queryset()

        if user.role in ("COORDINATOR", "ADMIN"):
            scoped_qs = qs
        elif user.role == "ORG_MANAGER":
            if not user.organization_id:
                scoped_qs = qs.none()
            else:
                scoped_qs = qs.filter(
                    Q(responsible_organization_id=user.organization_id)
                    | Q(responsible_department__organization_id=user.organization_id)
                    | Q(assigned_brigade__organization_id=user.organization_id)
                ).distinct()
        elif user.role == "DEPARTMENT_MANAGER":
            if not user.department_id:
                scoped_qs = qs.none()
            else:
                scoped_qs = qs.filter(
                    Q(responsible_department_id=user.department_id)
                    | Q(assigned_brigade__department_id=user.department_id)
                    | Q(assigned_worker__department_id=user.department_id)
                ).distinct()
        elif user.role == "WORKER":
            scoped_qs = qs.filter(assigned_worker=user)
        else:
            scoped_qs = qs.filter(created_by=user)

        return self._apply_list_filters(scoped_qs)

    def get_serializer_class(self):
        if self.action == "create":
            return RequestCreateSerializer
        if self.action == "retrieve":
            return RequestDetailSerializer
        return RequestListSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsCitizen()]

        if self.action in ("classify", "confirm_primary_check", "external_transfer", "return_to_work", "verify"):
            return [IsAuthenticated(), IsCoordinator()]

        if self.action in ("organization_assign",):
            return [IsAuthenticated(), IsOrgManager()]

        if self.action in ("department_assign",):
            return [IsAuthenticated(), IsDepartmentManager()]

        if self.action in ("assign_worker", "set_status"):
            return [IsAuthenticated(), IsAdminRole()]

        if self.action in ("take_in_work", "upload_after_photo"):
            return [IsAuthenticated(), IsWorker()]

        return super().get_permissions()

    @staticmethod
    def _create_status_history_if_changed(req, previous_status, *, changed_by=None, comment=""):
        if previous_status != req.status:
            create_status_history_entry(req, req.status, changed_by=changed_by, comment=comment)

    @staticmethod
    def _mark_assignment_accepted(req, worker):
        assignment = (
            req.assignments.filter(assigned_worker=worker, accepted_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if assignment:
            assignment.accepted_at = timezone.now()
            assignment.save(update_fields=["accepted_at"])

    @staticmethod
    def _mark_assignment_completed(req, worker):
        assignment = (
            req.assignments.filter(assigned_worker=worker, completed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if assignment:
            assignment.completed_at = timezone.now()
            assignment.save(update_fields=["completed_at"])

    def perform_create(self, serializer):
        req = serializer.save(
            created_by=self.request.user,
            status=Request.Status.CREATED,
            handling_mode=Request.HandlingMode.CLEANUP,
        )
        create_status_history_entry(req, req.status, changed_by=self.request.user, comment="Заявка создана.")

        try:
            out = detect_garbage_before(req.before_photo.path)
            VerificationResult.objects.update_or_create(
                request=req,
                defaults={
                    "is_clean": out.is_clean,
                    "score": out.score,
                    "details": out.details,
                },
            )

            found_status = getattr(settings, "AI_ON_BEFORE_FOUND_STATUS", None)
            not_found_status = getattr(settings, "AI_ON_BEFORE_NOT_FOUND_STATUS", None)
            previous_status = req.status

            if out.is_clean is False and found_status in dict(Request.Status.choices):
                req.status = found_status
            elif out.is_clean is True and not_found_status in dict(Request.Status.choices):
                req.status = not_found_status

            req.save(update_fields=["status", "updated_at"])
            self._create_status_history_if_changed(
                req,
                previous_status,
                changed_by=self.request.user,
                comment="Статус обновлён по результату AI-предпроверки.",
            )
        except Exception as exc:
            logger.exception("AI pre-check failed for request %s", req.id)
            VerificationResult.objects.update_or_create(
                request=req,
                defaults={
                    "is_clean": False,
                    "score": None,
                    "details": {"stage": "before", "error": str(exc)},
                },
            )

    @action(detail=True, methods=["post"])
    def classify(self, request, pk=None):
        req = self.get_object()

        if req.status == Request.Status.COMPLETED:
            return Response({"error": "Завершённую заявку нельзя переклассифицировать"}, status=status.HTTP_400_BAD_REQUEST)

        ser = ClassifyRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        responsible_organization = data.get("responsible_organization")
        territory_type = data.get("territory_type")

        handling_mode = data.get("handling_mode")
        if handling_mode is None and territory_type and territory_type.requires_external_transfer:
            handling_mode = Request.HandlingMode.EXTERNAL_TRANSFER

        previous_status = req.status
        update_fields = ["updated_at"]

        for field_name in ("address", "federal_subject", "municipality", "locality", "territory_type", "ownership_type"):
            if field_name in data:
                setattr(req, field_name, data[field_name])
                update_fields.append(field_name)

        if handling_mode is not None:
            req.handling_mode = handling_mode
            update_fields.append("handling_mode")

        if "classification_comment" in data:
            req.classification_comment = data["classification_comment"]
            update_fields.append("classification_comment")

        req.responsible_organization = responsible_organization
        update_fields.append("responsible_organization")
        req.coordinator = request.user
        update_fields.append("coordinator")

        if req.status == Request.Status.CREATED:
            req.status = Request.Status.VERIFIED
            update_fields.append("status")

        req.save(update_fields=list(dict.fromkeys(update_fields)))

        if responsible_organization or req.classification_comment:
            RequestAssignment.objects.create(
                request=req,
                assignment_type=RequestAssignment.AssignmentType.ROUTING,
                assigned_by=request.user,
                assigned_organization=responsible_organization,
                comment=req.classification_comment or "Заявка классифицирована и маршрутизирована.",
            )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Заявка верифицирована после классификации.",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="confirm-primary-check")
    def confirm_primary_check(self, request, pk=None):
        req = self.get_object()

        if req.status != Request.Status.CREATED:
            return Response(
                {"error": "Ручное подтверждение доступно только для заявки после первичной AI-проверки."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = ConfirmPrimaryCheckSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.validated_data["comment"].strip()

        previous_status = req.status
        req.status = Request.Status.VERIFIED
        req.coordinator = request.user
        req.save(update_fields=["status", "coordinator", "updated_at"])

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment=f"Координатор вручную подтвердил заявку после первичной AI-проверки. Комментарий: {comment}",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="external-transfer")
    def external_transfer(self, request, pk=None):
        req = self.get_object()

        if req.status == Request.Status.COMPLETED:
            return Response({"error": "Завершённую заявку нельзя передать внешнему адресату"}, status=status.HTTP_400_BAD_REQUEST)

        ser = ExternalTransferCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        target_organization = data.get("target_organization")
        recipient_name = (data.get("recipient_name") or "").strip()
        recipient_contact = (data.get("recipient_contact") or "").strip()
        comment = (data.get("comment") or "").strip()

        previous_status = req.status
        update_fields = ["handling_mode", "status", "assigned_worker", "assigned_brigade", "updated_at"]

        req.handling_mode = Request.HandlingMode.EXTERNAL_TRANSFER
        req.status = Request.Status.TRANSFERRED
        req.assigned_worker = None
        req.assigned_brigade = None

        if target_organization:
            req.responsible_organization = target_organization
            req.responsible_department = None
            update_fields.extend(["responsible_organization", "responsible_department"])

        req.save(update_fields=list(dict.fromkeys(update_fields)))

        transfer = ExternalTransfer.objects.create(
            request=req,
            target_organization=target_organization,
            recipient_name=recipient_name or (target_organization.name if target_organization else ""),
            recipient_contact=recipient_contact,
            transfer_reason=data["transfer_reason"],
            comment=comment,
            outgoing_number=(data.get("outgoing_number") or "").strip(),
            created_by=request.user,
        )

        RequestAssignment.objects.create(
            request=req,
            assignment_type=RequestAssignment.AssignmentType.EXTERNAL_TRANSFER,
            assigned_by=request.user,
            assigned_organization=target_organization,
            comment=data["transfer_reason"],
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment=f"Заявка передана по принадлежности. Передача #{transfer.id}.",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def assign_worker(self, request, pk=None):
        req = self.get_object()

        if req.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER or req.status == Request.Status.TRANSFERRED:
            return Response(
                {"error": "Заявка уже передана внешнему адресату и не может быть назначена исполнителю"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = AssignWorkerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        worker_id = ser.validated_data["worker_id"]
        worker = self._get_scoped_worker_queryset(req).filter(id=worker_id).first()
        if not worker:
            return Response({"error": "Исполнитель не найден"}, status=status.HTTP_404_NOT_FOUND)

        if not self._worker_matches_request_context(worker, req):
            return Response(
                {"error": "Исполнитель не соответствует организации, подразделению или бригаде заявки."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if req.status == Request.Status.COMPLETED:
            return Response({"error": "Заявка уже завершена"}, status=status.HTTP_400_BAD_REQUEST)

        if req.status not in (
            Request.Status.CREATED,
            Request.Status.VERIFIED,
            Request.Status.IN_PROGRESS,
            Request.Status.ON_CHECK,
        ):
            return Response(
                {"error": f"Нельзя назначить исполнителя для статуса {req.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_status = req.status
        req.assigned_worker = worker
        req.handling_mode = Request.HandlingMode.CLEANUP
        if req.status in (Request.Status.CREATED, Request.Status.VERIFIED):
            req.status = Request.Status.VERIFIED
        req.save(update_fields=["assigned_worker", "handling_mode", "status", "updated_at"])

        RequestAssignment.objects.create(
            request=req,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=request.user,
            assigned_organization=req.responsible_organization,
            assigned_department=req.responsible_department,
            assigned_brigade=req.assigned_brigade,
            assigned_worker=worker,
            comment="Исполнитель назначен администратором по override.",
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Администратор выполнил override назначения исполнителя.",
        )

        return Response({"status": "Исполнитель назначен по admin override"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="organization-assign")
    def organization_assign(self, request, pk=None):
        req = self.get_object()

        if req.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER or req.status == Request.Status.TRANSFERRED:
            return Response(
                {"error": "Переданную заявку нельзя распределять внутри организации."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if req.status == Request.Status.COMPLETED:
            return Response(
                {"error": "Завершенную заявку нельзя переназначить внутри организации."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.organization_id or not request.user.organization:
            return Response(
                {"error": "Пользователь не привязан к организации."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        organization = request.user.organization
        belongs_to_user_org = any(
            [
                req.responsible_organization_id == organization.id,
                req.responsible_department and req.responsible_department.organization_id == organization.id,
                req.assigned_brigade and req.assigned_brigade.organization_id == organization.id,
                req.assigned_worker and req.assigned_worker.organization_id == organization.id,
            ]
        )
        if not belongs_to_user_org:
            return Response(
                {"error": "Заявка не относится к вашей организации."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = OrganizationAssignSerializer(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        department = data.get("responsible_department")
        previous_status = req.status
        previous_department_id = req.responsible_department_id

        req.responsible_organization = organization
        req.responsible_department = department
        req.assigned_brigade = None
        req.assigned_worker = None
        req.handling_mode = Request.HandlingMode.CLEANUP

        update_fields = [
            "updated_at",
            "responsible_organization",
            "responsible_department",
            "assigned_brigade",
            "assigned_worker",
            "handling_mode",
        ]
        if req.status in (Request.Status.CREATED, Request.Status.IN_PROGRESS, Request.Status.ON_CHECK):
            req.status = Request.Status.VERIFIED
            update_fields.append("status")

        req.save(update_fields=list(dict.fromkeys(update_fields)))

        assignment_type = RequestAssignment.AssignmentType.ROUTING
        if previous_department_id and previous_department_id != getattr(department, "id", None):
            assignment_type = RequestAssignment.AssignmentType.REASSIGNMENT

        RequestAssignment.objects.create(
            request=req,
            assignment_type=assignment_type,
            assigned_by=request.user,
            assigned_organization=organization,
            assigned_department=department,
            assigned_brigade=None,
            assigned_worker=None,
            comment=(data.get("comment") or "").strip()
            or "Заявка направлена в подразделение ответственной организации.",
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Руководитель организации назначил подразделение.",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

        organization = req.responsible_organization
        if request.user.role == User.Role.ORG_MANAGER:
            if not request.user.organization_id:
                return Response(
                    {"error": "Пользователь не привязан к организации."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            belongs_to_user_org = any(
                [
                    req.responsible_organization_id == request.user.organization_id,
                    req.responsible_department and req.responsible_department.organization_id == request.user.organization_id,
                    req.assigned_brigade and req.assigned_brigade.organization_id == request.user.organization_id,
                ]
            )
            if not belongs_to_user_org:
                return Response(
                    {"error": "Заявка не относится к вашей организации."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            organization = request.user.organization

        if not organization:
            return Response(
                {"error": "У заявки не определена ответственная организация."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrganizationAssignSerializer(
            data=request.data,
            context={
                "organization": organization,
                "worker_queryset": self._get_scoped_worker_queryset(req).filter(organization_id=organization.id),
            },
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        previous_worker = req.assigned_worker
        department = data.get("responsible_department")
        brigade = data.get("assigned_brigade")
        worker = data.get("assigned_worker")

        if brigade and not department and brigade.department_id:
            department = brigade.department

        previous_status = req.status
        update_fields = ["updated_at", "responsible_organization", "responsible_department", "assigned_brigade"]
        req.responsible_organization = organization
        req.responsible_department = department
        req.assigned_brigade = brigade

        if worker is not None:
            if not self._worker_matches_request_context(worker, req):
                return Response(
                    {"error": "Исполнитель не соответствует организации, подразделению или бригаде заявки."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            req.assigned_worker = worker
            update_fields.append("assigned_worker")

        if req.status == Request.Status.CREATED:
            req.status = Request.Status.VERIFIED
            update_fields.append("status")

        req.save(update_fields=list(dict.fromkeys(update_fields)))

        assignment_type = RequestAssignment.AssignmentType.ROUTING
        if worker is not None and previous_worker and previous_worker.id != worker.id:
            assignment_type = RequestAssignment.AssignmentType.REASSIGNMENT
        elif worker is not None:
            assignment_type = RequestAssignment.AssignmentType.WORKER

        assignment_comment = (
            (data.get("comment") or "").strip()
            or "Заявка распределена внутри ответственной организации."
        )

        RequestAssignment.objects.create(
            request=req,
            assignment_type=assignment_type,
            assigned_by=request.user,
            assigned_organization=organization,
            assigned_department=department,
            assigned_brigade=brigade,
            assigned_worker=worker or req.assigned_worker,
            comment=assignment_comment,
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Ответственная организация обновила маршрут исполнения.",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="department-assign")
    def department_assign(self, request, pk=None):
        req = self.get_object()

        if req.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER or req.status == Request.Status.TRANSFERRED:
            return Response(
                {"error": "Переданную заявку нельзя назначать на бригаду или исполнителя."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if req.status == Request.Status.COMPLETED:
            return Response(
                {"error": "Завершенную заявку нельзя переназначить на уровне подразделения."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.organization_id or not request.user.department_id or not request.user.department:
            return Response(
                {"error": "Пользователь не привязан к подразделению."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        department = request.user.department
        if req.responsible_department_id != department.id:
            return Response(
                {"error": "Заявка не относится к вашему подразделению."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DepartmentAssignSerializer(
            data=request.data,
            context={"department": department},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        brigade = data.get("assigned_brigade")
        worker = data.get("assigned_worker")
        previous_status = req.status
        previous_worker_id = req.assigned_worker_id
        previous_brigade_id = req.assigned_brigade_id

        req.responsible_organization = request.user.organization
        req.responsible_department = department
        req.assigned_brigade = brigade
        req.assigned_worker = worker
        req.handling_mode = Request.HandlingMode.CLEANUP

        update_fields = [
            "updated_at",
            "responsible_organization",
            "responsible_department",
            "assigned_brigade",
            "assigned_worker",
            "handling_mode",
        ]
        if req.status in (Request.Status.CREATED, Request.Status.IN_PROGRESS, Request.Status.ON_CHECK):
            req.status = Request.Status.VERIFIED
            update_fields.append("status")

        req.save(update_fields=list(dict.fromkeys(update_fields)))

        assignment_type = RequestAssignment.AssignmentType.ROUTING
        if worker is not None:
            assignment_type = (
                RequestAssignment.AssignmentType.REASSIGNMENT
                if previous_worker_id and previous_worker_id != worker.id
                else RequestAssignment.AssignmentType.WORKER
            )
        elif previous_brigade_id and previous_brigade_id != getattr(brigade, "id", None):
            assignment_type = RequestAssignment.AssignmentType.REASSIGNMENT

        RequestAssignment.objects.create(
            request=req,
            assignment_type=assignment_type,
            assigned_by=request.user,
            assigned_organization=req.responsible_organization,
            assigned_department=department,
            assigned_brigade=brigade,
            assigned_worker=worker,
            comment=(data.get("comment") or "").strip()
            or "Руководитель подразделения обновил назначение бригады/исполнителя.",
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Руководитель подразделения обновил внутреннее назначение.",
        )

        detail = RequestDetailSerializer(req, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def take_in_work(self, request, pk=None):
        req = self.get_object()

        if req.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER or req.status == Request.Status.TRANSFERRED:
            return Response({"error": "Эта заявка передана внешнему адресату"}, status=status.HTTP_400_BAD_REQUEST)

        if req.assigned_worker_id != request.user.id:
            return Response({"error": "Заявка не назначена вам"}, status=status.HTTP_403_FORBIDDEN)

        if req.status != Request.Status.VERIFIED:
            return Response({"error": "Заявка не готова к выполнению"}, status=status.HTTP_400_BAD_REQUEST)

        previous_status = req.status
        req.status = Request.Status.IN_PROGRESS
        req.save(update_fields=["status", "updated_at"])

        self._mark_assignment_accepted(req, request.user)
        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Исполнитель принял заявку в работу.",
        )

        return Response({"status": "Заявка принята в работу"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def upload_after_photo(self, request, pk=None):
        req = self.get_object()

        if req.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER or req.status == Request.Status.TRANSFERRED:
            return Response({"error": "Для переданной заявки нельзя загружать фото результата"}, status=status.HTTP_400_BAD_REQUEST)

        if req.assigned_worker_id != request.user.id:
            return Response({"error": "Заявка не назначена вам"}, status=status.HTTP_403_FORBIDDEN)

        if req.status != Request.Status.IN_PROGRESS:
            return Response(
                {"error": "Фото результата можно загрузить только для заявки 'В работе'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = UploadAfterPhotoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        previous_status = req.status
        req.after_photo = ser.validated_data["after_photo"]
        req.status = Request.Status.ON_CHECK
        req.save(update_fields=["after_photo", "status", "updated_at"])
        try:
            out = verify_cleanup(req.before_photo.path, req.after_photo.path)
        except Exception as exc:
            logger.exception("AI verification failed for request %s", req.id)
            out = AIVerifyOutput(is_clean=False, score=None, details={"error": str(exc)})
        vr, _ = VerificationResult.objects.update_or_create(
            request=req,
            defaults={
                "is_clean": out.is_clean,
                "score": out.score,
                "details": self._compose_verification_details(req, out.details),
            },
        )

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Исполнитель загрузил фото результата.",
        )

        return Response(
            {
                "status": "Фото загружено, заявка отправлена на проверку",
                "verification": VerificationResultSerializer(vr).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="return_to_work")
    def return_to_work(self, request, pk=None):
        req = self.get_object()

        if req.status == Request.Status.TRANSFERRED:
            return Response({"error": "Переданную заявку нельзя вернуть в работу"}, status=status.HTTP_400_BAD_REQUEST)

        ser = ReturnToWorkSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        comment = ser.validated_data["comment"]

        previous_worker = req.assigned_worker
        new_worker = None

        if False:
            """
                return Response({"error": "Исполнитель не найден"}, status=status.HTTP_404_NOT_FOUND)
            if not self._worker_matches_request_context(new_worker, req):
                return Response(
                    {"error": "Исполнитель не соответствует организации, подразделению или бригаде заявки."},
                    status=status.HTTP_400_BAD_REQUEST,
            """

        RequestRework.objects.create(
            request=req,
            created_by=request.user,
            comment=comment,
            previous_worker=previous_worker,
            new_worker=new_worker,
            previous_status=req.status,
        )

        if new_worker:
            RequestAssignment.objects.create(
                request=req,
                assignment_type=RequestAssignment.AssignmentType.REASSIGNMENT,
                assigned_by=request.user,
                assigned_organization=req.responsible_organization,
                assigned_department=req.responsible_department,
                assigned_brigade=req.assigned_brigade,
                assigned_worker=new_worker,
                comment=comment,
            )
            req.assigned_worker = new_worker

        previous_status = req.status
        req.status = Request.Status.IN_PROGRESS
        req.save(update_fields=["status", "updated_at"])

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment=comment,
        )

        return Response({"status": "Заявка возвращена на доработку"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        req = self.get_object()

        ser = AdminSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data["status"]

        previous_status = req.status
        req.status = new_status
        if new_status == Request.Status.TRANSFERRED:
            req.handling_mode = Request.HandlingMode.EXTERNAL_TRANSFER
            req.save(update_fields=["status", "handling_mode", "updated_at"])
        else:
            req.save(update_fields=["status", "updated_at"])

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Статус изменён администратором по override.",
        )

        return Response({"status": req.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        req = self.get_object()

        if request.user.role != "COORDINATOR":
            return Response({"error": "Нет прав на проверку"}, status=status.HTTP_403_FORBIDDEN)

        if req.status == Request.Status.TRANSFERRED:
            return Response({"error": "Переданная заявка не подлежит проверке результата уборки"}, status=status.HTTP_400_BAD_REQUEST)

        ser = VerifyRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        force = ser.validated_data["force"]

        if req.status != Request.Status.ON_CHECK and not force:
            return Response(
                {
                    "error": "Проверять можно только заявки в статусе 'На проверке'. Если нужно принудительно — отправьте {\"force\": true}.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not req.after_photo:
            return Response({"error": "Нет фото после уборки"}, status=status.HTTP_400_BAD_REQUEST)

        out = verify_cleanup(req.before_photo.path, req.after_photo.path)

        vr, _ = VerificationResult.objects.update_or_create(
            request=req,
            defaults={
                "is_clean": out.is_clean,
                "score": out.score,
                "details": self._compose_verification_details(req, out.details),
            },
        )

        previous_status = req.status
        if out.is_clean:
            req.status = Request.Status.COMPLETED
        else:
            req.status = Request.Status.IN_PROGRESS

        req.save(update_fields=["status", "updated_at"])

        if out.is_clean and req.assigned_worker_id:
            self._mark_assignment_completed(req, req.assigned_worker)

        self._create_status_history_if_changed(
            req,
            previous_status,
            changed_by=request.user,
            comment="Координатор завершил проверку результата.",
        )

        return Response(
            {
                "request_status": req.status,
                "verification": VerificationResultSerializer(vr).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def reference_options(self, request):
        user = request.user
        worker_qs = self._get_scoped_worker_queryset()
        organization_qs = Organization.objects.filter(is_active=True)
        department_qs = Department.objects.filter(is_active=True)
        brigade_qs = self._get_scoped_brigade_queryset()

        if user.role == User.Role.ORG_MANAGER:
            if not user.organization_id:
                organization_qs = organization_qs.none()
                department_qs = department_qs.none()
                brigade_qs = brigade_qs.none()
                worker_qs = worker_qs.none()
            else:
                organization_qs = organization_qs.filter(id=user.organization_id)
                department_qs = department_qs.filter(organization_id=user.organization_id)
                brigade_qs = brigade_qs.filter(organization_id=user.organization_id)
        elif user.role == User.Role.DEPARTMENT_MANAGER:
            if not user.organization_id or not user.department_id:
                organization_qs = organization_qs.none()
                department_qs = department_qs.none()
                brigade_qs = brigade_qs.none()
                worker_qs = worker_qs.none()
            else:
                organization_qs = organization_qs.filter(id=user.organization_id)
                department_qs = department_qs.filter(id=user.department_id)
                brigade_qs = brigade_qs.filter(
                    organization_id=user.organization_id,
                    department_id=user.department_id,
                )

        payload = {
            "workers": list(
                worker_qs.values(
                    "id",
                    "username",
                    "email",
                    "phone",
                    "city",
                    "organization_id",
                    "organization__name",
                    "department_id",
                    "department__name",
                )
            ),
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
            "organizations": list(
                organization_qs
                .select_related("organization_type")
                .order_by("name")
                .values(
                    "id",
                    "name",
                    "short_name",
                    "organization_type_id",
                    "organization_type__name",
                    "is_external",
                )
            ),
            "departments": list(
                department_qs
                .select_related("organization")
                .order_by("name")
                .values("id", "name", "organization_id", "organization__name", "department_type")
            ),
            "brigades": list(
                brigade_qs
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
                TerritoryType.objects.filter(is_active=True)
                .order_by("name")
                .values("id", "code", "name", "requires_external_transfer")
            ),
            "ownership_types": list(
                OwnershipType.objects.filter(is_active=True).order_by("name").values("id", "code", "name")
            ),
            "choices": {
                "request_status": [{"value": code, "label": label} for code, label in Request.Status.choices],
                "handling_mode": [{"value": code, "label": label} for code, label in Request.HandlingMode.choices],
            },
            "current_user": {
                "id": user.id,
                "role": user.role,
                "organization": user.organization_id,
                "organization_name": user.organization.name if user.organization_id else "",
                "department": user.department_id,
                "department_name": user.department.name if user.department_id else "",
            },
        }
        return Response(payload)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def completed(self, request):
        qs = self._apply_list_filters(
            self._get_base_queryset(),
            default_ordering="-updated_at",
            forced_statuses=[Request.Status.COMPLETED],
        )
        ser = RequestCompletedSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="detect-city")
    def detect_city(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (TypeError, ValueError):
            return Response({"error": "Invalid lat/lon"}, status=status.HTTP_400_BAD_REQUEST)

        location = detect_location_by_coordinates(lat_f, lon_f)
        return Response(
            {
                "city": location.get("city", ""),
                "address": location.get("address", ""),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def stats(self, request):
        qs = self._apply_list_filters(self._get_base_queryset(), default_ordering="-created_at")

        for field_name in (
            "federal_subject",
            "municipality",
            "locality",
            "territory_type",
            "ownership_type",
            "responsible_organization",
        ):
            raw_value = (request.query_params.get(field_name) or "").strip()
            if raw_value.isdigit():
                qs = qs.filter(**{f"{field_name}_id": int(raw_value)})

        total = qs.count()
        completed_qs = qs.filter(status=Request.Status.COMPLETED)
        transferred_qs = qs.filter(status=Request.Status.TRANSFERRED)
        active_qs = qs.exclude(status__in=(Request.Status.COMPLETED, Request.Status.TRANSFERRED))
        rework_requests_count = qs.filter(rework_events__isnull=False).distinct().count()

        by_status = list(qs.values("status").annotate(count=Count("id")).order_by("status"))
        by_handling_mode = list(
            qs.values("handling_mode").annotate(count=Count("id")).order_by("handling_mode")
        )
        by_city = list(
            qs.exclude(city="")
            .values("city")
            .annotate(count=Count("id"))
            .order_by("-count", "city")[:10]
        )
        by_territory_type = list(
            qs.values("territory_type", "territory_type__name")
            .annotate(count=Count("id"))
            .exclude(territory_type__isnull=True)
            .order_by("-count", "territory_type__name")[:10]
        )
        by_organization = list(
            qs.values("responsible_organization", "responsible_organization__name")
            .annotate(count=Count("id"))
            .exclude(responsible_organization__isnull=True)
            .order_by("-count", "responsible_organization__name")[:10]
        )
        by_municipality = list(
            qs.values("municipality", "municipality__name")
            .annotate(count=Count("id"))
            .exclude(municipality__isnull=True)
            .order_by("-count", "municipality__name")[:10]
        )
        timeline = list(
            qs.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        duration_expr = ExpressionWrapper(
            F("updated_at") - F("created_at"),
            output_field=DurationField(),
        )
        avg_duration = completed_qs.aggregate(avg=Avg(duration_expr)).get("avg")
        avg_hours = round(avg_duration.total_seconds() / 3600, 2) if avg_duration else None

        available_cities = list(
            Request.objects.exclude(city="")
            .values_list("city", flat=True)
            .distinct()
            .order_by("city")
        )

        return Response(
            {
                "filters": {
                    "q": (request.query_params.get("q") or "").strip() or None,
                    "city": (request.query_params.get("city") or "").strip() or None,
                    "status": self._get_multi_query_values("status"),
                    "handling_mode": self._get_multi_query_values("handling_mode"),
                    "created_from": (request.query_params.get("created_from") or "").strip() or None,
                    "created_to": (request.query_params.get("created_to") or "").strip() or None,
                    "updated_from": (request.query_params.get("updated_from") or "").strip() or None,
                    "updated_to": (request.query_params.get("updated_to") or "").strip() or None,
                    "assigned_worker": (request.query_params.get("assigned_worker") or "").strip() or None,
                    "federal_subject": (request.query_params.get("federal_subject") or "").strip() or None,
                    "municipality": (request.query_params.get("municipality") or "").strip() or None,
                    "locality": (request.query_params.get("locality") or "").strip() or None,
                    "territory_type": (request.query_params.get("territory_type") or "").strip() or None,
                    "ownership_type": (request.query_params.get("ownership_type") or "").strip() or None,
                    "responsible_organization": (request.query_params.get("responsible_organization") or "").strip() or None,
                },
                "available_filters": {
                    "cities": available_cities,
                    "statuses": [
                        {"value": value, "label": label}
                        for value, label in Request.Status.choices
                    ],
                    "handling_modes": [
                        {"value": value, "label": label}
                        for value, label in Request.HandlingMode.choices
                    ],
                    "workers": list(
                        User.objects.filter(role="WORKER", is_active=True)
                        .order_by("username")
                        .values("id", "username", "city")
                    ),
                    "federal_subjects": list(
                        FederalSubject.objects.filter(is_active=True).order_by("name").values("id", "name")
                    ),
                    "municipalities": list(
                        Municipality.objects.filter(is_active=True)
                        .order_by("name")
                        .values("id", "name", "federal_subject_id")
                    ),
                    "localities": list(
                        Locality.objects.filter(is_active=True)
                        .order_by("name")
                        .values("id", "name", "municipality_id")
                    ),
                    "territory_types": list(
                        TerritoryType.objects.filter(is_active=True).order_by("name").values("id", "name")
                    ),
                    "ownership_types": list(
                        OwnershipType.objects.filter(is_active=True).order_by("name").values("id", "name")
                    ),
                    "organizations": list(
                        Organization.objects.filter(is_active=True).order_by("name").values("id", "name", "short_name")
                    ),
                },
                "total": total,
                "active": active_qs.count(),
                "by_status": by_status,
                "by_handling_mode": by_handling_mode,
                "by_city": by_city,
                "by_territory_type": by_territory_type,
                "by_organization": by_organization,
                "by_municipality": by_municipality,
                "timeline": [
                    {
                        "period": item["month"].date().isoformat() if item["month"] else None,
                        "count": item["count"],
                    }
                    for item in timeline
                ],
                "completed": completed_qs.count(),
                "transferred": transferred_qs.count(),
                "rework_requests": rework_requests_count,
                "completion_rate": round((completed_qs.count() / total * 100), 2) if total else 0,
                "transfer_rate": round((transferred_qs.count() / total * 100), 2) if total else 0,
                "avg_completion_hours": avg_hours,
            }
        )
