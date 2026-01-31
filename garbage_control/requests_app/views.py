from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, ExpressionWrapper, F, DurationField
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    VerifyRequestSerializer,
    VerificationResultSerializer,
    AdminSetStatusSerializer,
    RequestDetailSerializer,
    RequestCompletedSerializer,
)
from ai_verification.services import verify_cleanup
from .models import Request,VerificationResult
from .serializers import (
    RequestCreateSerializer,
    RequestListSerializer,
    AssignWorkerSerializer,
    UploadAfterPhotoSerializer,
)
from .permissions import IsCitizenOrAdmin, IsCoordinatorOrAdmin, IsWorker, IsAdminRole

User = get_user_model()

class RequestViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]

    # ---------- Queryset по ролям ----------
    def get_queryset(self):
        # Role-based access: coordinators/admins see all, workers see assigned, citizens see own.
        user = self.request.user
        qs = Request.objects.all().order_by("-created_at")

        # фильтры
        status_q = self.request.query_params.get("status")
        q = self.request.query_params.get("q")

        if status_q:
            qs = qs.filter(status=status_q)

        if q:
            qs = qs.filter(title__icontains=q)

        if user.role in ("COORDINATOR", "ADMIN"):
            return qs

        if user.role == "WORKER":
            return qs.filter(assigned_worker=user)

        return qs.filter(created_by=user)

    # ---------- Сериализаторы ----------
    def get_serializer_class(self):
        if self.action == 'create':
            return RequestCreateSerializer
        if self.action == 'retrieve':
            return RequestDetailSerializer
        return RequestListSerializer

    # ---------- Permissions по действиям ----------
    def get_permissions(self):
        # Map permissions to actions to keep rules in one place.
        if self.action == 'create':
            return [IsAuthenticated(), IsCitizenOrAdmin()]

        if self.action in ('assign_worker',):
            return [IsAuthenticated(), IsCoordinatorOrAdmin()]

        if self.action in ('take_in_work', 'upload_after_photo'):
            return [IsAuthenticated(), IsWorker()]

        if self.action in ('set_status',):
            return [IsAuthenticated(), IsAdminRole()]

        return super().get_permissions()

    # ---------- Create ----------
    def perform_create(self, serializer):
        # Enforce creator and initial status server-side.
        serializer.save(created_by=self.request.user, status=Request.Status.CREATED)

    # ---------- Координатор назначает исполнителя ----------
    @action(detail=True, methods=['post'])
    def assign_worker(self, request, pk=None):
        req = self.get_object()

        ser = AssignWorkerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        worker_id = ser.validated_data['worker_id']

        worker = User.objects.filter(id=worker_id, role='WORKER').first()
        if not worker:
            return Response({'error': 'Исполнитель не найден'}, status=status.HTTP_404_NOT_FOUND)

        # Нормальная логика: назначать можно только "CREATED" или уже "VERIFIED" (переназначение)
        if req.status == Request.Status.COMPLETED:
            return Response({'error': 'Заявка уже завершена'}, status=status.HTTP_400_BAD_REQUEST)

        if req.status not in (Request.Status.CREATED, Request.Status.VERIFIED):
            return Response(
                {'error': f'Нельзя назначить исполнителя для статуса {req.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )


        req.assigned_worker = worker
        req.coordinator = request.user
        req.status = Request.Status.VERIFIED
        req.save(update_fields=['assigned_worker', 'coordinator', 'status', 'updated_at'])

        return Response({'status': 'Исполнитель назначен'}, status=status.HTTP_200_OK)

    # ---------- Исполнитель принимает заявку ----------
    @action(detail=True, methods=['post'])
    def take_in_work(self, request, pk=None):
        req = self.get_object()

        if req.assigned_worker_id != request.user.id:
            return Response({'error': 'Заявка не назначена вам'}, status=status.HTTP_403_FORBIDDEN)

        if req.status != Request.Status.VERIFIED:
            return Response({'error': 'Заявка не готова к выполнению'}, status=status.HTTP_400_BAD_REQUEST)

        req.status = Request.Status.IN_PROGRESS
        req.save(update_fields=['status', 'updated_at'])

        return Response({'status': 'Заявка принята в работу'}, status=status.HTTP_200_OK)

    # ---------- Исполнитель загружает фото "после" ----------
    @action(detail=True, methods=['post'])
    def upload_after_photo(self, request, pk=None):
        # Only assigned worker can upload the after photo.
        req = self.get_object()

        if req.assigned_worker_id != request.user.id:
            return Response({'error': 'Заявка не назначена вам'}, status=status.HTTP_403_FORBIDDEN)

        if req.status != Request.Status.IN_PROGRESS:
            return Response({'error': 'Фото результата можно загрузить только для заявки "В работе"'},
                            status=status.HTTP_400_BAD_REQUEST)

        ser = UploadAfterPhotoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        req.after_photo = ser.validated_data['after_photo']
        # Move to ON_CHECK so the result can be verified.
        req.status = Request.Status.ON_CHECK
        req.save(update_fields=['after_photo', 'status', 'updated_at'])
        out = verify_cleanup(req.before_photo.path, req.after_photo.path)
        vr, _ = VerificationResult.objects.update_or_create(
            request=req,
            defaults={
                'is_clean': out.is_clean,
                'score': out.score,
                'details': out.details,
            }
        )

        return Response(
            {
                'status': 'Photo uploaded, request sent for review',
                'verification': VerificationResultSerializer(vr).data,
            },
            status=status.HTTP_200_OK
        )


    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        req = self.get_object()

        ser = AdminSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data["status"]

        req.status = new_status
        req.save(update_fields=["status", "updated_at"])

        return Response({"status": req.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        # Verification can be triggered only by coordinator/admin.
        """
        Запуск ИИ-проверки результата уборки.
        По-хорошему это действие координатора (или сервиса), а не исполнителя.
        """
        req = self.get_object()

        # Права: координатор или ADMIN
        if request.user.role not in ('COORDINATOR', 'ADMIN'):
            return Response({'error': 'Нет прав на проверку'}, status=status.HTTP_403_FORBIDDEN)

        ser = VerifyRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        force = ser.validated_data['force']

        if req.status != Request.Status.ON_CHECK and not force:
            return Response(
                {'error': 'Проверять можно только заявки в статусе "На проверке". '
                          'Если надо принудительно — отправь {"force": true}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not req.after_photo:
            return Response({'error': 'Нет фото после уборки'}, status=status.HTTP_400_BAD_REQUEST)

        # ИИ-верификация (пока заглушка)
        out = verify_cleanup(req.before_photo.path, req.after_photo.path)

        # Сохраняем/обновляем результат
        vr, _ = VerificationResult.objects.update_or_create(
            request=req,
            defaults={
                'is_clean': out.is_clean,
                'score': out.score,
                'details': out.details,
            }
        )

        # Меняем статус строго по результату
        if out.is_clean:
            req.status = Request.Status.COMPLETED
        else:
            # Вариант логики: вернуть в работу
            req.status = Request.Status.IN_PROGRESS

        req.save(update_fields=['status', 'updated_at'])

        return Response(
            {
                'request_status': req.status,
                'verification': VerificationResultSerializer(vr).data
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def completed(self, request):
        qs = Request.objects.filter(status=Request.Status.COMPLETED).order_by("-updated_at")
        ser = RequestCompletedSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        # Aggregate totals and average completion time (completed only).
        qs = Request.objects.all()
        total = qs.count()
        by_status = list(qs.values("status").annotate(count=Count("id")).order_by("status"))

        completed_qs = qs.filter(status=Request.Status.COMPLETED)
        duration_expr = ExpressionWrapper(
            F("updated_at") - F("created_at"),
            output_field=DurationField(),
        )
        avg_duration = completed_qs.aggregate(avg=Avg(duration_expr)).get("avg")
        avg_hours = round(avg_duration.total_seconds() / 3600, 2) if avg_duration else None

        return Response(
            {
                "total": total,
                "by_status": by_status,
                "completed": completed_qs.count(),
                "completion_rate": round((completed_qs.count() / total * 100), 2) if total else 0,
                "avg_completion_hours": avg_hours,
            }
        )
