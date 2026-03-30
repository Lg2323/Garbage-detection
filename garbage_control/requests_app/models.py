from django.conf import settings
from django.contrib.gis.db import models

User = settings.AUTH_USER_MODEL


class FederalSubject(models.Model):
    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=160, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Субъект РФ"
        verbose_name_plural = "Субъекты РФ"
        ordering = ("name",)

    def __str__(self):
        return self.name


class Municipality(models.Model):
    class Kind(models.TextChoices):
        MUNICIPAL_DISTRICT = "MUNICIPAL_DISTRICT", "Муниципальный район"
        CITY_DISTRICT = "CITY_DISTRICT", "Городской округ"
        URBAN_SETTLEMENT = "URBAN_SETTLEMENT", "Городское поселение"
        RURAL_SETTLEMENT = "RURAL_SETTLEMENT", "Сельское поселение"
        INTRACITY_DISTRICT = "INTRACITY_DISTRICT", "Внутригородской район"
        OTHER = "OTHER", "Иное"

    federal_subject = models.ForeignKey(
        FederalSubject,
        on_delete=models.CASCADE,
        related_name="municipalities",
    )
    name = models.CharField(max_length=180)
    kind = models.CharField(max_length=32, choices=Kind.choices, default=Kind.CITY_DISTRICT)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Муниципальное образование"
        verbose_name_plural = "Муниципальные образования"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("federal_subject", "name", "kind"),
                name="uniq_municipality_per_subject",
            )
        ]

    def __str__(self):
        return self.name


class Locality(models.Model):
    class Kind(models.TextChoices):
        CITY = "CITY", "Город"
        TOWN = "TOWN", "Посёлок городского типа"
        SETTLEMENT = "SETTLEMENT", "Посёлок"
        VILLAGE = "VILLAGE", "Село"
        HAMLET = "HAMLET", "Деревня"
        OTHER = "OTHER", "Иное"

    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.CASCADE,
        related_name="localities",
    )
    name = models.CharField(max_length=180)
    kind = models.CharField(max_length=24, choices=Kind.choices, default=Kind.CITY)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Населённый пункт"
        verbose_name_plural = "Населённые пункты"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("municipality", "name", "kind"),
                name="uniq_locality_per_municipality",
            )
        ]

    def __str__(self):
        return self.name


class OrganizationType(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Тип организации"
        verbose_name_plural = "Типы организаций"
        ordering = ("name",)

    def __str__(self):
        return self.name


class Organization(models.Model):
    name = models.CharField(max_length=255, unique=True)
    short_name = models.CharField(max_length=120, blank=True, default="")
    organization_type = models.ForeignKey(
        OrganizationType,
        on_delete=models.PROTECT,
        related_name="organizations",
    )
    federal_subject = models.ForeignKey(
        FederalSubject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organizations",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organizations",
    )
    locality = models.ForeignKey(
        Locality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organizations",
    )
    address = models.CharField(max_length=255, blank=True, default="")
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    is_external = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Организация"
        verbose_name_plural = "Организации"
        ordering = ("name",)

    def __str__(self):
        return self.short_name or self.name


class Department(models.Model):
    class DepartmentType(models.TextChoices):
        DISPATCH = "DISPATCH", "Диспетчеризация"
        TERRITORIAL = "TERRITORIAL", "Территориальный участок"
        CLEANUP = "CLEANUP", "Уборка"
        ADMINISTRATION = "ADMINISTRATION", "Администрирование"
        OTHER = "OTHER", "Иное"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="departments",
    )
    parent_department = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_departments",
    )
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=40, blank=True, default="")
    department_type = models.CharField(
        max_length=24,
        choices=DepartmentType.choices,
        default=DepartmentType.OTHER,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Подразделение"
        verbose_name_plural = "Подразделения"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "name"),
                name="uniq_department_per_org",
            )
        ]

    def __str__(self):
        return f"{self.organization}: {self.name}"


class Brigade(models.Model):
    class BrigadeType(models.TextChoices):
        CLEANUP = "CLEANUP", "Уборочная бригада"
        CONTRACTOR = "CONTRACTOR", "Подрядная бригада"
        MOBILE = "MOBILE", "Мобильная группа"
        OTHER = "OTHER", "Иное"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="brigades",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brigades",
    )
    name = models.CharField(max_length=180)
    brigade_type = models.CharField(max_length=24, choices=BrigadeType.choices, default=BrigadeType.CLEANUP)
    supervisor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_brigades",
    )
    members = models.ManyToManyField(User, related_name="brigades", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Бригада"
        verbose_name_plural = "Бригады"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "name"),
                name="uniq_brigade_per_org",
            )
        ]

    def __str__(self):
        return f"{self.organization}: {self.name}"


class TerritoryType(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True, default="")
    requires_external_transfer = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Тип территории"
        verbose_name_plural = "Типы территорий"
        ordering = ("name",)

    def __str__(self):
        return self.name


class OwnershipType(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Тип собственности"
        verbose_name_plural = "Типы собственности"
        ordering = ("name",)

    def __str__(self):
        return self.name


class ResponsibilityZone(models.Model):
    name = models.CharField(max_length=180)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="responsibility_zones",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    brigade = models.ForeignKey(
        Brigade,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    federal_subject = models.ForeignKey(
        FederalSubject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    locality = models.ForeignKey(
        Locality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    territory_type = models.ForeignKey(
        TerritoryType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsibility_zones",
    )
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    comment = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Зона ответственности"
        verbose_name_plural = "Зоны ответственности"
        ordering = ("name",)

    def __str__(self):
        return self.name


class Request(models.Model):
    class Status(models.TextChoices):
        CREATED = "CREATED", "Создана"
        VERIFIED = "VERIFIED", "Верифицирована"
        IN_PROGRESS = "IN_PROGRESS", "В работе"
        ON_CHECK = "ON_CHECK", "На проверке"
        COMPLETED = "COMPLETED", "Завершена"
        TRANSFERRED = "TRANSFERRED", "Передана по принадлежности"

    class HandlingMode(models.TextChoices):
        CLEANUP = "CLEANUP", "Уборка"
        EXTERNAL_TRANSFER = "EXTERNAL_TRANSFER", "Внешняя передача"

    title = models.CharField(max_length=255, verbose_name="Описание")
    address = models.CharField(max_length=255, blank=True, default="")

    location = models.PointField(geography=True, verbose_name="Геопозиция")
    city = models.CharField(max_length=120, blank=True, default="", db_index=True)
    federal_subject = models.ForeignKey(
        FederalSubject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    locality = models.ForeignKey(
        Locality,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    territory_type = models.ForeignKey(
        TerritoryType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    ownership_type = models.ForeignKey(
        OwnershipType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    handling_mode = models.CharField(
        max_length=32,
        choices=HandlingMode.choices,
        default=HandlingMode.CLEANUP,
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_requests")
    responsible_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_requests",
    )
    responsible_department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    assigned_brigade = models.ForeignKey(
        Brigade,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
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
    classification_comment = models.TextField(blank=True, default="")

    before_photo = models.ImageField(upload_to="requests/before/")
    after_photo = models.ImageField(upload_to="requests/after/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"
        indexes = [
            models.Index(fields=("status", "created_at"), name="request_status_created_idx"),
            models.Index(fields=("handling_mode", "created_at"), name="request_handling_created_idx"),
        ]

    def __str__(self):
        return f"#{self.pk} {self.title}"


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


class RequestStatusHistory(models.Model):
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="status_history")
    status = models.CharField(max_length=20, choices=Request.Status.choices)
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="request_status_changes",
    )
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "История статусов заявки"
        verbose_name_plural = "История статусов заявок"
        ordering = ("-created_at",)


class RequestAssignment(models.Model):
    class AssignmentType(models.TextChoices):
        ROUTING = "ROUTING", "Маршрутизация"
        WORKER = "WORKER", "Назначение исполнителя"
        REASSIGNMENT = "REASSIGNMENT", "Переназначение"
        EXTERNAL_TRANSFER = "EXTERNAL_TRANSFER", "Внешняя передача"

    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="assignments")
    assignment_type = models.CharField(max_length=24, choices=AssignmentType.choices, default=AssignmentType.ROUTING)
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_request_assignments",
    )
    assigned_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    assigned_department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    assigned_brigade = models.ForeignKey(
        Brigade,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    assigned_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="request_assignments",
    )
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Назначение заявки"
        verbose_name_plural = "Назначения заявок"
        ordering = ("-created_at",)


class ExternalTransfer(models.Model):
    class TransferStatus(models.TextChoices):
        SENT = "SENT", "Отправлено"
        ACCEPTED = "ACCEPTED", "Принято"
        CLOSED = "CLOSED", "Закрыто"

    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="external_transfers")
    target_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="external_transfers",
    )
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    recipient_contact = models.CharField(max_length=255, blank=True, default="")
    transfer_reason = models.TextField()
    comment = models.TextField(blank=True, default="")
    outgoing_number = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=16, choices=TransferStatus.choices, default=TransferStatus.SENT)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_external_transfers",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Внешняя передача"
        verbose_name_plural = "Внешние передачи"
        ordering = ("-sent_at",)


def create_status_history_entry(request_obj, status, *, changed_by=None, comment=""):
    return RequestStatusHistory.objects.create(
        request=request_obj,
        status=status,
        changed_by=changed_by,
        comment=comment,
    )
