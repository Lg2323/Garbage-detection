from django.conf import settings
from django.contrib.gis.db import models

User = settings.AUTH_USER_MODEL


class Request(models.Model):
    class Status(models.TextChoices):
        CREATED = "CREATED", "Создана"
        VERIFIED = "VERIFIED", "Верифицирована"
        IN_PROGRESS = "IN_PROGRESS", "В работе"
        ON_CHECK = "ON_CHECK", "На проверке"
        COMPLETED = "COMPLETED", "Завершена"

    title = models.CharField(max_length=255, verbose_name="Описание")

    location = models.PointField(geography=True, verbose_name="Геопозиция")
    city = models.CharField(max_length=120, blank=True, default="")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_requests")
    assigned_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_requests",
    )
    coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_requests",
    )

    before_photo = models.ImageField(upload_to="requests/before/")
    after_photo = models.ImageField(upload_to="requests/after/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"


class RequestRework(models.Model):
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="rework_events")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_rework_events")
    comment = models.TextField()
    previous_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rework_events_previous_worker",
    )
    new_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rework_events_new_worker",
    )
    previous_status = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Возврат на доработку"
        verbose_name_plural = "Возвраты на доработку"
        ordering = ("-created_at",)


class VerificationResult(models.Model):
    request = models.OneToOneField(Request, on_delete=models.CASCADE, related_name="verification")
    is_clean = models.BooleanField(default=False)
    score = models.FloatField(null=True, blank=True)
    details = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Результат проверки"
        verbose_name_plural = "Результаты проверки"

    def __str__(self):
        return f"Проверка заявки #{self.request_id}: clean={self.is_clean}"
