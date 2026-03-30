from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from shutil import copy2

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.db import transaction
from django.utils import timezone

from requests_app.models import (
    Brigade,
    Department,
    ExternalTransfer,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OrganizationType,
    OwnershipType,
    Request,
    RequestAssignment,
    RequestRework,
    RequestStatusHistory,
    ResponsibilityZone,
    TerritoryType,
    VerificationResult,
)


PASSWORD = "Test12345!"
MEDIA_ROOT = Path("media")
BEFORE_DIR = MEDIA_ROOT / "requests" / "before"
AFTER_DIR = MEDIA_ROOT / "requests" / "after"


def image_candidates() -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    return [path for path in sorted(BEFORE_DIR.iterdir()) if path.is_file() and path.suffix.lower() in exts]


def cleanup_generated_after_images() -> None:
    AFTER_DIR.mkdir(parents=True, exist_ok=True)
    for path in AFTER_DIR.glob("after_seed_*"):
        path.unlink(missing_ok=True)


def copy_after_image(src: Path, index: int, slug: str) -> str:
    dst_name = f"after_seed_{index:02d}_{slug}{src.suffix.lower()}"
    dst_rel = Path("requests") / "after" / dst_name
    dst_abs = MEDIA_ROOT / dst_rel
    copy2(src, dst_abs)
    return str(dst_rel).replace("\\", "/")


def rectangle_geometry(lon: float, lat: float, lon_delta: float, lat_delta: float) -> MultiPolygon:
    polygon = Polygon(
        (
            (lon - lon_delta, lat - lat_delta),
            (lon + lon_delta, lat - lat_delta),
            (lon + lon_delta, lat + lat_delta),
            (lon - lon_delta, lat + lat_delta),
            (lon - lon_delta, lat - lat_delta),
        )
    )
    polygon.srid = 4326
    geometry = MultiPolygon(polygon)
    geometry.srid = 4326
    return geometry


def set_timestamps(model, obj, **values):
    model.objects.filter(pk=obj.pk).update(**values)
    for field, value in values.items():
        setattr(obj, field, value)
    return obj


def create_status_entry(request_obj, status_value, created_at, *, changed_by=None, comment=""):
    entry = RequestStatusHistory.objects.create(
        request=request_obj,
        status=status_value,
        changed_by=changed_by,
        comment=comment,
    )
    return set_timestamps(RequestStatusHistory, entry, created_at=created_at)


def create_assignment(
    request_obj,
    assignment_type,
    created_at,
    *,
    assigned_by=None,
    organization=None,
    department=None,
    brigade=None,
    worker=None,
    comment="",
    accepted_at=None,
    completed_at=None,
):
    assignment = RequestAssignment.objects.create(
        request=request_obj,
        assignment_type=assignment_type,
        assigned_by=assigned_by,
        assigned_organization=organization,
        assigned_department=department,
        assigned_brigade=brigade,
        assigned_worker=worker,
        comment=comment,
        accepted_at=accepted_at,
        completed_at=completed_at,
    )
    return set_timestamps(RequestAssignment, assignment, created_at=created_at)


def create_verification(request_obj, created_at, *, is_clean, score, details):
    verification = VerificationResult.objects.create(
        request=request_obj,
        is_clean=is_clean,
        score=score,
        details=details,
    )
    return set_timestamps(VerificationResult, verification, created_at=created_at)


def create_rework(request_obj, created_at, *, created_by, comment, previous_worker=None, new_worker=None, previous_status=""):
    rework = RequestRework.objects.create(
        request=request_obj,
        created_by=created_by,
        comment=comment,
        previous_worker=previous_worker,
        new_worker=new_worker,
        previous_status=previous_status,
    )
    return set_timestamps(RequestRework, rework, created_at=created_at)


def create_transfer(request_obj, created_at, *, created_by, target_organization=None, recipient_name="", recipient_contact="", transfer_reason="", comment="", outgoing_number="", status=ExternalTransfer.TransferStatus.SENT, closed_at=None):
    transfer = ExternalTransfer.objects.create(
        request=request_obj,
        target_organization=target_organization,
        recipient_name=recipient_name,
        recipient_contact=recipient_contact,
        transfer_reason=transfer_reason,
        comment=comment,
        outgoing_number=outgoing_number,
        status=status,
        created_by=created_by,
        closed_at=closed_at,
    )
    return set_timestamps(ExternalTransfer, transfer, sent_at=created_at)


@transaction.atomic
def run() -> None:
    cleanup_generated_after_images()
    images = image_candidates()
    if len(images) < 12:
        raise RuntimeError("Нужно минимум 12 изображений в media/requests/before для реалистичного заполнения.")

    User = get_user_model()
    now = timezone.now().replace(minute=0, second=0, microsecond=0)

    organization_types = {item.code: item for item in OrganizationType.objects.all()}
    territory_types = {item.code: item for item in TerritoryType.objects.all()}
    ownership_types = {item.code: item for item in OwnershipType.objects.all()}

    subjects = {}
    for code, name in (
        ("16", "Республика Татарстан"),
        ("77", "город Москва"),
    ):
        subjects[code] = FederalSubject.objects.create(code=code, name=name)

    municipalities = {}
    municipality_specs = [
        ("almet", subjects["16"], "Альметьевский муниципальный район", Municipality.Kind.MUNICIPAL_DISTRICT),
        ("kazan", subjects["16"], "город Казань", Municipality.Kind.CITY_DISTRICT),
        ("moscow", subjects["77"], "город Москва", Municipality.Kind.CITY_DISTRICT),
    ]
    for key, federal_subject, name, kind in municipality_specs:
        municipalities[key] = Municipality.objects.create(
            federal_subject=federal_subject,
            name=name,
            kind=kind,
        )

    localities = {}
    locality_specs = [
        ("almetyevsk", municipalities["almet"], "Альметьевск", Locality.Kind.CITY),
        ("maktama", municipalities["almet"], "Нижняя Мактама", Locality.Kind.SETTLEMENT),
        ("kazan", municipalities["kazan"], "Казань", Locality.Kind.CITY),
        ("moscow", municipalities["moscow"], "Москва", Locality.Kind.CITY),
    ]
    for key, municipality, name, kind in locality_specs:
        localities[key] = Locality.objects.create(
            municipality=municipality,
            name=name,
            kind=kind,
        )

    user_specs = [
        ("admin_elena", "Елена", "Волкова", "ADMIN", "Москва", "+7-905-100-00-01", True, True),
        ("coord_almet", "Ирина", "Хасанова", "COORDINATOR", "Альметьевск", "+7-905-100-00-02", True, False),
        ("coord_kazan", "Руслан", "Ахметов", "COORDINATOR", "Казань", "+7-905-100-00-03", True, False),
        ("coord_moscow", "Марина", "Павлова", "COORDINATOR", "Москва", "+7-905-100-00-04", True, False),
        ("org_almet_service", "Павел", "Шарапов", "ORG_MANAGER", "Альметьевск", "+7-905-100-00-05", False, False),
        ("org_almet_contractor", "Георгий", "Никонов", "ORG_MANAGER", "Альметьевск", "+7-905-100-00-06", False, False),
        ("org_kazan_service", "Линар", "Багаутдинов", "ORG_MANAGER", "Казань", "+7-905-100-00-07", False, False),
        ("org_kazan_contractor", "Альберт", "Саматов", "ORG_MANAGER", "Казань", "+7-905-100-00-08", False, False),
        ("org_moscow_service", "Игорь", "Пахомов", "ORG_MANAGER", "Москва", "+7-905-100-00-09", False, False),
        ("almet_worker_1", "Олег", "Петров", "WORKER", "Альметьевск", "+7-905-100-00-11", False, False),
        ("almet_worker_2", "Ильдар", "Шакиров", "WORKER", "Альметьевск", "+7-905-100-00-12", False, False),
        ("almet_worker_3", "Денис", "Гордеев", "WORKER", "Альметьевск", "+7-905-100-00-13", False, False),
        ("almet_worker_4", "Роман", "Юдин", "WORKER", "Альметьевск", "+7-905-100-00-14", False, False),
        ("almet_contractor_1", "Айдар", "Сафиуллин", "WORKER", "Альметьевск", "+7-905-100-00-15", False, False),
        ("almet_contractor_2", "Марат", "Сафин", "WORKER", "Альметьевск", "+7-905-100-00-16", False, False),
        ("kazan_worker_1", "Артем", "Федоров", "WORKER", "Казань", "+7-905-100-00-21", False, False),
        ("kazan_worker_2", "Рамиль", "Валеев", "WORKER", "Казань", "+7-905-100-00-22", False, False),
        ("kazan_contractor_1", "Виталий", "Гусев", "WORKER", "Казань", "+7-905-100-00-23", False, False),
        ("kazan_contractor_2", "Тагир", "Мусин", "WORKER", "Казань", "+7-905-100-00-24", False, False),
        ("moscow_worker_1", "Сергей", "Крылов", "WORKER", "Москва", "+7-905-100-00-31", False, False),
        ("moscow_worker_2", "Алексей", "Руднев", "WORKER", "Москва", "+7-905-100-00-32", False, False),
        ("moscow_yard_1", "Никита", "Поляков", "WORKER", "Москва", "+7-905-100-00-33", False, False),
        ("citizen_aliya", "Алия", "Ибрагимова", "CITIZEN", "Альметьевск", "+7-905-200-00-01", False, False),
        ("citizen_timur", "Тимур", "Вахитов", "CITIZEN", "Альметьевск", "+7-905-200-00-02", False, False),
        ("citizen_ilnur", "Ильнур", "Закиров", "CITIZEN", "Нижняя Мактама", "+7-905-200-00-03", False, False),
        ("citizen_elmira", "Эльмира", "Гараева", "CITIZEN", "Казань", "+7-905-200-00-04", False, False),
        ("citizen_roman", "Роман", "Анисимов", "CITIZEN", "Казань", "+7-905-200-00-05", False, False),
        ("citizen_svetlana", "Светлана", "Жданова", "CITIZEN", "Москва", "+7-905-200-00-06", False, False),
        ("citizen_egor", "Егор", "Кузьмин", "CITIZEN", "Москва", "+7-905-200-00-07", False, False),
    ]

    users = {}
    for username, first_name, last_name, role, city, phone, is_staff, is_superuser in user_specs:
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password=PASSWORD,
            first_name=first_name,
            last_name=last_name,
            role=role,
            city=city,
            phone=phone,
        )
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.save(update_fields=["is_staff", "is_superuser"])
        users[username] = user

    organization_specs = [
        {
            "key": "almet_service",
            "name": "МБУ Департамент экологии и благоустройства Альметьевского района",
            "short_name": "МБУ ДЭБ АМР",
            "org_type": "MUNICIPAL_SERVICE",
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "address": "Альметьевск, ул. Ленина, 39",
            "phone": "+7-8553-45-10-01",
            "email": "deb-amr@example.com",
            "is_external": False,
        },
        {
            "key": "almet_contractor",
            "name": "ООО Чистый Альметьевск",
            "short_name": "Чистый Альметьевск",
            "org_type": "CONTRACTOR",
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "address": "Альметьевск, Индустриальная зона, база 4",
            "phone": "+7-8553-45-10-02",
            "email": "contractor-almet@example.com",
            "is_external": False,
        },
        {
            "key": "almet_admin",
            "name": "Исполнительный комитет Альметьевского муниципального района",
            "short_name": "Исполком АМР",
            "org_type": "DISTRICT_ADMINISTRATION",
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "address": "Альметьевск, ул. Гагарина, 12",
            "phone": "+7-8553-45-10-03",
            "email": "ispolkom-amr@example.com",
            "is_external": False,
        },
        {
            "key": "tat_road_service",
            "name": "ГАУ Автодор-Восток",
            "short_name": "Автодор-Восток",
            "org_type": "ROAD_SERVICE",
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "address": "Альметьевск, Объездная дорога, 2",
            "phone": "+7-8553-45-10-04",
            "email": "road-east@example.com",
            "is_external": True,
        },
        {
            "key": "tatneft_owner",
            "name": "АО Татнефть-Логистика",
            "short_name": "Татнефть-Логистика",
            "org_type": "PROPERTY_OWNER",
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "address": "Альметьевск, ул. Советская, 180",
            "phone": "+7-8553-45-10-05",
            "email": "owner-tatneft@example.com",
            "is_external": True,
        },
        {
            "key": "kazan_service",
            "name": "МКУ Комитет внешнего благоустройства Казани",
            "short_name": "Благоустройство Казань",
            "org_type": "MUNICIPAL_SERVICE",
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "address": "Казань, ул. Кремлевская, 3",
            "phone": "+7-843-245-10-01",
            "email": "beauty-kazan@example.com",
            "is_external": False,
        },
        {
            "key": "kazan_contractor",
            "name": "ООО ЭкоСервис Поволжье",
            "short_name": "ЭкоСервис Поволжье",
            "org_type": "CONTRACTOR",
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "address": "Казань, ул. Родины, 12к2",
            "phone": "+7-843-245-10-02",
            "email": "ecoservice-kazan@example.com",
            "is_external": False,
        },
        {
            "key": "kazan_owner",
            "name": "ООО Речной терминал Казань",
            "short_name": "Речной терминал",
            "org_type": "PROPERTY_OWNER",
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "address": "Казань, Портовая, 1",
            "phone": "+7-843-245-10-03",
            "email": "owner-pier@example.com",
            "is_external": True,
        },
        {
            "key": "moscow_service",
            "name": "ГБУ Жилищник района Тверской",
            "short_name": "Жилищник Тверской",
            "org_type": "MUNICIPAL_SERVICE",
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "address": "Москва, 1-я Тверская-Ямская, 18",
            "phone": "+7-495-345-10-01",
            "email": "zhilishnik-tverskoy@example.com",
            "is_external": False,
        },
        {
            "key": "moscow_roads",
            "name": "ГБУ Автомобильные дороги ЦАО",
            "short_name": "Автодороги ЦАО",
            "org_type": "ROAD_SERVICE",
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "address": "Москва, Сущевский Вал, 15",
            "phone": "+7-495-345-10-02",
            "email": "roads-cao@example.com",
            "is_external": True,
        },
        {
            "key": "mall_owner",
            "name": "ООО Северная Галерея",
            "short_name": "Северная Галерея",
            "org_type": "PROPERTY_OWNER",
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "address": "Москва, Ленинградский проспект, 75",
            "phone": "+7-495-345-10-03",
            "email": "mall-owner@example.com",
            "is_external": True,
        },
    ]

    organizations = {}
    for spec in organization_specs:
        organizations[spec["key"]] = Organization.objects.create(
            name=spec["name"],
            short_name=spec["short_name"],
            organization_type=organization_types[spec["org_type"]],
            federal_subject=subjects[spec["subject"]],
            municipality=municipalities[spec["municipality"]],
            locality=localities[spec["locality"]],
            address=spec["address"],
            contact_phone=spec["phone"],
            email=spec["email"],
            is_external=spec["is_external"],
        )

    department_specs = [
        ("almet_dispatch", "almet_service", None, "Диспетчерский центр", "ALM-DISP", Department.DepartmentType.DISPATCH),
        ("almet_north", "almet_service", None, "Северный участок", "ALM-N", Department.DepartmentType.TERRITORIAL),
        ("almet_center", "almet_service", None, "Центральный участок", "ALM-C", Department.DepartmentType.TERRITORIAL),
        ("almet_industrial", "almet_contractor", None, "Промышленный участок", "ALM-I", Department.DepartmentType.TERRITORIAL),
        ("kazan_dispatch", "kazan_service", None, "Диспетчерская смена", "KZN-DISP", Department.DepartmentType.DISPATCH),
        ("kazan_center", "kazan_service", None, "Центральный сектор", "KZN-C", Department.DepartmentType.TERRITORIAL),
        ("kazan_embankment", "kazan_contractor", None, "Набережная и береговая линия", "KZN-W", Department.DepartmentType.TERRITORIAL),
        ("moscow_dispatch", "moscow_service", None, "Единая диспетчерская", "MSK-DISP", Department.DepartmentType.DISPATCH),
        ("moscow_center", "moscow_service", None, "Центральный сектор", "MSK-C", Department.DepartmentType.TERRITORIAL),
        ("moscow_yard", "moscow_service", None, "Дворовые территории", "MSK-Y", Department.DepartmentType.CLEANUP),
    ]

    departments = {}
    for key, org_key, parent_key, name, code, department_type in department_specs:
        departments[key] = Department.objects.create(
            organization=organizations[org_key],
            parent_department=departments.get(parent_key),
            name=name,
            code=code,
            department_type=department_type,
        )

    brigade_specs = [
        ("almet_north_team", "almet_service", "almet_north", "Бригада Север-1", Brigade.BrigadeType.CLEANUP, "almet_worker_1", ["almet_worker_1", "almet_worker_2"]),
        ("almet_center_team", "almet_service", "almet_center", "Бригада Центр-1", Brigade.BrigadeType.CLEANUP, "almet_worker_3", ["almet_worker_3", "almet_worker_4"]),
        ("almet_industry_team", "almet_contractor", "almet_industrial", "Индустриальная бригада", Brigade.BrigadeType.CONTRACTOR, "almet_contractor_1", ["almet_contractor_1", "almet_contractor_2"]),
        ("kazan_center_team", "kazan_service", "kazan_center", "Бригада Центр-Казань", Brigade.BrigadeType.CLEANUP, "kazan_worker_1", ["kazan_worker_1", "kazan_worker_2"]),
        ("kazan_embankment_team", "kazan_contractor", "kazan_embankment", "Береговая бригада", Brigade.BrigadeType.CONTRACTOR, "kazan_contractor_1", ["kazan_contractor_1", "kazan_contractor_2"]),
        ("moscow_center_team", "moscow_service", "moscow_center", "Бригада Тверская-1", Brigade.BrigadeType.CLEANUP, "moscow_worker_1", ["moscow_worker_1", "moscow_worker_2"]),
        ("moscow_yard_team", "moscow_service", "moscow_yard", "Дворовая бригада", Brigade.BrigadeType.MOBILE, "moscow_yard_1", ["moscow_yard_1"]),
    ]

    brigades = {}
    for key, org_key, dep_key, name, brigade_type, supervisor_key, member_keys in brigade_specs:
        brigade = Brigade.objects.create(
            organization=organizations[org_key],
            department=departments[dep_key],
            name=name,
            brigade_type=brigade_type,
            supervisor=users[supervisor_key],
        )
        brigade.members.set([users[item] for item in member_keys])
        brigades[key] = brigade

    user_affiliations = {
        "org_almet_service": ("almet_service", "almet_dispatch"),
        "org_almet_contractor": ("almet_contractor", "almet_industrial"),
        "org_kazan_service": ("kazan_service", "kazan_dispatch"),
        "org_kazan_contractor": ("kazan_contractor", "kazan_embankment"),
        "org_moscow_service": ("moscow_service", "moscow_dispatch"),
        "almet_worker_1": ("almet_service", "almet_north"),
        "almet_worker_2": ("almet_service", "almet_north"),
        "almet_worker_3": ("almet_service", "almet_center"),
        "almet_worker_4": ("almet_service", "almet_center"),
        "almet_contractor_1": ("almet_contractor", "almet_industrial"),
        "almet_contractor_2": ("almet_contractor", "almet_industrial"),
        "kazan_worker_1": ("kazan_service", "kazan_center"),
        "kazan_worker_2": ("kazan_service", "kazan_center"),
        "kazan_contractor_1": ("kazan_contractor", "kazan_embankment"),
        "kazan_contractor_2": ("kazan_contractor", "kazan_embankment"),
        "moscow_worker_1": ("moscow_service", "moscow_center"),
        "moscow_worker_2": ("moscow_service", "moscow_center"),
        "moscow_yard_1": ("moscow_service", "moscow_yard"),
    }

    for username, (organization_key, department_key) in user_affiliations.items():
        user = users[username]
        user.organization = organizations[organization_key]
        user.department = departments[department_key]
        user.save(update_fields=["organization", "department"])

    zone_specs = [
        ("Север Альметьевска", "almet_service", "almet_north", "almet_north_team", "16", "almet", "almetyevsk", "MUNICIPAL_LAND", 52.304, 54.920, 0.035, 0.025, "Жилая северная часть города и прилегающие дворы."),
        ("Центр Альметьевска", "almet_service", "almet_center", "almet_center_team", "16", "almet", "almetyevsk", "MUNICIPAL_LAND", 52.296, 54.904, 0.028, 0.020, "Центральные улицы, скверы и контейнерные площадки."),
        ("Промышленная зона Альметьевска", "almet_contractor", "almet_industrial", "almet_industry_team", "16", "almet", "almetyevsk", "MUNICIPAL_LAND", 52.321, 54.892, 0.030, 0.018, "Промышленная зона и площадки возле складов."),
        ("Нижняя Мактама", "almet_service", "almet_north", "almet_north_team", "16", "almet", "maktama", "MUNICIPAL_LAND", 52.339, 54.863, 0.022, 0.015, "Поселок и подъездные дороги."),
        ("Центр Казани", "kazan_service", "kazan_center", "kazan_center_team", "16", "kazan", "kazan", "MUNICIPAL_LAND", 49.117, 55.790, 0.032, 0.020, "Центральные улицы, общественные пространства."),
        ("Набережная Казани", "kazan_contractor", "kazan_embankment", "kazan_embankment_team", "16", "kazan", "kazan", "MUNICIPAL_LAND", 49.093, 55.800, 0.030, 0.018, "Набережная, портовая зона и береговые площадки."),
        ("Тверской район Москвы", "moscow_service", "moscow_center", "moscow_center_team", "77", "moscow", "moscow", "MUNICIPAL_LAND", 37.612, 55.763, 0.030, 0.018, "Центральные улицы и общественные зоны района."),
        ("Дворовые территории Москвы", "moscow_service", "moscow_yard", "moscow_yard_team", "77", "moscow", "moscow", "MUNICIPAL_LAND", 37.634, 55.752, 0.026, 0.016, "Дворы, контейнерные площадки и проходы."),
        ("Альметьевские дороги", "tat_road_service", None, None, "16", "almet", "almetyevsk", "ROAD_INFRASTRUCTURE", 52.278, 54.910, 0.040, 0.020, "Полоса отвода дорог и развязки возле города."),
        ("Дороги ЦАО", "moscow_roads", None, None, "77", "moscow", "moscow", "ROAD_INFRASTRUCTURE", 37.621, 55.748, 0.030, 0.016, "Участки вдоль магистралей и проезжей части."),
    ]

    for name, org_key, dep_key, brigade_key, subject_key, municipality_key, locality_key, territory_key, lon, lat, lon_delta, lat_delta, comment in zone_specs:
        ResponsibilityZone.objects.create(
            name=name,
            organization=organizations[org_key],
            department=departments.get(dep_key) if dep_key else None,
            brigade=brigades.get(brigade_key) if brigade_key else None,
            federal_subject=subjects[subject_key],
            municipality=municipalities[municipality_key],
            locality=localities[locality_key],
            territory_type=territory_types[territory_key],
            geometry=rectangle_geometry(lon, lat, lon_delta, lat_delta),
            comment=comment,
        )

    request_specs = [
        {
            "slug": "almet_containers",
            "title": "Скопление бытового мусора у контейнерной площадки на ул. Ленина, 24",
            "address": "Альметьевск, ул. Ленина, 24",
            "city": "Альметьевск",
            "lat": 54.9012,
            "lon": 52.2969,
            "created_by": "citizen_aliya",
            "coordinator": "coord_almet",
            "status": Request.Status.COMPLETED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "almet_service",
            "department": "almet_center",
            "brigade": "almet_center_team",
            "worker": "almet_worker_3",
            "days_ago": 126,
            "updated_after_hours": 22,
            "classification_comment": "Муниципальная контейнерная площадка, заявка направлена в центральный участок МБУ.",
            "verification": {"is_clean": True, "score": 0.97, "details": {"before_count": 14, "after_count": 0, "reduction": 1.0}},
        },
        {
            "slug": "almet_park",
            "title": "Мусор и сухие ветки у входа в городской парк на улице Белоглазова",
            "address": "Альметьевск, ул. Белоглазова, вход в парк",
            "city": "Альметьевск",
            "lat": 54.9151,
            "lon": 52.3070,
            "created_by": "citizen_timur",
            "coordinator": "coord_almet",
            "status": Request.Status.COMPLETED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "almet_service",
            "department": "almet_north",
            "brigade": "almet_north_team",
            "worker": "almet_worker_1",
            "days_ago": 103,
            "updated_after_hours": 18,
            "classification_comment": "Общественное пространство в зоне ответственности северного участка.",
            "verification": {"is_clean": True, "score": 0.94, "details": {"before_count": 11, "after_count": 1, "reduction": 0.91}},
        },
        {
            "slug": "almet_square",
            "title": "Мешки и пластиковая тара возле сквера Нефтяников после выходных",
            "address": "Альметьевск, сквер Нефтяников",
            "city": "Альметьевск",
            "lat": 54.9088,
            "lon": 52.2987,
            "created_by": "citizen_aliya",
            "coordinator": "coord_almet",
            "status": Request.Status.ON_CHECK,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "almet_service",
            "department": "almet_center",
            "brigade": "almet_center_team",
            "worker": "almet_worker_4",
            "days_ago": 31,
            "updated_after_hours": 26,
            "classification_comment": "После первичной уборки требуется контроль качества и досбор мелкого мусора.",
            "verification": {"is_clean": False, "score": 0.61, "details": {"before_count": 18, "after_count": 7, "reduction": 0.61}},
            "rework": {"created_by": "coord_almet", "previous_worker": "almet_worker_3", "new_worker": "almet_worker_4", "comment": "После первой уборки остались мешки за лавками."},
        },
        {
            "slug": "almet_industrial",
            "title": "Скопление строительного мусора у складов в промышленной зоне",
            "address": "Альметьевск, Промышленная зона, склад 7",
            "city": "Альметьевск",
            "lat": 54.8918,
            "lon": 52.3194,
            "created_by": "citizen_timur",
            "coordinator": "coord_almet",
            "status": Request.Status.IN_PROGRESS,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MIXED",
            "organization": "almet_contractor",
            "department": "almet_industrial",
            "brigade": "almet_industry_team",
            "worker": "almet_contractor_1",
            "days_ago": 14,
            "updated_after_hours": 11,
            "classification_comment": "Крупногабаритный мусор, назначен подрядчик с погрузкой и вывозом.",
        },
        {
            "slug": "almet_verified",
            "title": "Переполненная урна и россыпь пакетов у дома на проспекте Строителей",
            "address": "Альметьевск, проспект Строителей, 29",
            "city": "Альметьевск",
            "lat": 54.9185,
            "lon": 52.3029,
            "created_by": "citizen_timur",
            "coordinator": "coord_almet",
            "status": Request.Status.VERIFIED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "almet_service",
            "department": "almet_north",
            "brigade": None,
            "worker": None,
            "days_ago": 8,
            "updated_after_hours": 5,
            "classification_comment": "Муниципальный двор, ожидает назначения на ближайший маршрут бригады.",
        },
        {
            "slug": "almet_created",
            "title": "Мелкий мусор возле остановки «Драмтеатр» после вечернего трафика",
            "address": "Альметьевск, остановка «Драмтеатр»",
            "city": "Альметьевск",
            "lat": 54.9049,
            "lon": 52.2932,
            "created_by": "citizen_aliya",
            "coordinator": None,
            "status": Request.Status.CREATED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": None,
            "ownership": None,
            "organization": None,
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 2,
            "updated_after_hours": 2,
            "classification_comment": "",
        },
        {
            "slug": "almet_private",
            "title": "Свалка на закрытой площадке у складов частной логистической базы",
            "address": "Альметьевск, ул. Советская, 180",
            "city": "Альметьевск",
            "lat": 54.8935,
            "lon": 52.3148,
            "created_by": "citizen_timur",
            "coordinator": "coord_almet",
            "status": Request.Status.TRANSFERRED,
            "handling_mode": Request.HandlingMode.EXTERNAL_TRANSFER,
            "subject": "16",
            "municipality": "almet",
            "locality": "almetyevsk",
            "territory": "PRIVATE_LAND",
            "ownership": "PRIVATE",
            "organization": "tatneft_owner",
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 19,
            "updated_after_hours": 7,
            "classification_comment": "Частная территория, сформирована передача балансодержателю.",
            "external_transfer": {
                "target_org": "tatneft_owner",
                "recipient_name": "АО Татнефть-Логистика",
                "recipient_contact": "owner-tatneft@example.com",
                "reason": "Частная территория складской базы. Требуется самостоятельная уборка собственником.",
                "comment": "К письму приложены фотофиксация и координаты участка.",
                "status": ExternalTransfer.TransferStatus.ACCEPTED,
                "close_after_hours": None,
            },
        },
        {
            "slug": "almet_road",
            "title": "Мусор вдоль обочины на выезде к объездной дороге и развязке",
            "address": "Альметьевск, выезд на объездную дорогу",
            "city": "Альметьевск",
            "lat": 54.9104,
            "lon": 52.2728,
            "created_by": "citizen_ilnur",
            "coordinator": "coord_almet",
            "status": Request.Status.TRANSFERRED,
            "handling_mode": Request.HandlingMode.EXTERNAL_TRANSFER,
            "subject": "16",
            "municipality": "almet",
            "locality": None,
            "territory": "ROAD_INFRASTRUCTURE",
            "ownership": "REGIONAL",
            "organization": "tat_road_service",
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 24,
            "updated_after_hours": 6,
            "classification_comment": "Полоса отвода региональной дороги, обращение направлено дорожной службе.",
            "external_transfer": {
                "target_org": "tat_road_service",
                "recipient_name": "ГАУ Автодор-Восток",
                "recipient_contact": "roads@autodor-vostok.local",
                "reason": "Захламление полосы отвода региональной дороги.",
                "comment": "Передано по подведомственности в дорожную службу.",
                "status": ExternalTransfer.TransferStatus.CLOSED,
                "close_after_hours": 24,
            },
        },
        {
            "slug": "maktama_verified",
            "title": "Разбросанный мусор у въезда в Нижнюю Мактаму после ярмарки",
            "address": "Нижняя Мактама, въезд со стороны трассы",
            "city": "Нижняя Мактама",
            "lat": 54.8634,
            "lon": 52.3384,
            "created_by": "citizen_ilnur",
            "coordinator": "coord_almet",
            "status": Request.Status.VERIFIED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "almet",
            "locality": "maktama",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "almet_service",
            "department": "almet_north",
            "brigade": None,
            "worker": None,
            "days_ago": 11,
            "updated_after_hours": 4,
            "classification_comment": "Поселковая территория, заявка в очереди на пакетный выезд бригады.",
        },
        {
            "slug": "kazan_completed",
            "title": "Бытовой мусор и картон возле контейнерной площадки на ул. Чистопольская",
            "address": "Казань, ул. Чистопольская, 12",
            "city": "Казань",
            "lat": 55.8200,
            "lon": 49.1207,
            "created_by": "citizen_elmira",
            "coordinator": "coord_kazan",
            "status": Request.Status.COMPLETED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "kazan_service",
            "department": "kazan_center",
            "brigade": "kazan_center_team",
            "worker": "kazan_worker_1",
            "days_ago": 87,
            "updated_after_hours": 20,
            "classification_comment": "Муниципальная площадка, закрыта после стандартного выезда.",
            "verification": {"is_clean": True, "score": 0.95, "details": {"before_count": 16, "after_count": 1, "reduction": 0.94}},
        },
        {
            "slug": "kazan_embankment",
            "title": "Пластиковые бутылки и мешки вдоль пешеходной зоны на набережной",
            "address": "Казань, набережная у Кремля",
            "city": "Казань",
            "lat": 55.7991,
            "lon": 49.0936,
            "created_by": "citizen_roman",
            "coordinator": "coord_kazan",
            "status": Request.Status.IN_PROGRESS,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "kazan_contractor",
            "department": "kazan_embankment",
            "brigade": "kazan_embankment_team",
            "worker": "kazan_contractor_1",
            "days_ago": 13,
            "updated_after_hours": 9,
            "classification_comment": "Участок длинный, уборка разбита на два маршрута подрядчика.",
        },
        {
            "slug": "kazan_stop",
            "title": "Мелкий мусор и переполненная урна у остановки «Площадь Тукая»",
            "address": "Казань, площадь Тукая",
            "city": "Казань",
            "lat": 55.7866,
            "lon": 49.1243,
            "created_by": "citizen_elmira",
            "coordinator": "coord_kazan",
            "status": Request.Status.VERIFIED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "kazan_service",
            "department": "kazan_center",
            "brigade": None,
            "worker": None,
            "days_ago": 5,
            "updated_after_hours": 3,
            "classification_comment": "Подтверждено оператором, включено в ближайший маршрут по центру.",
        },
        {
            "slug": "kazan_created",
            "title": "Пакеты и одноразовая посуда у двора на улице Аделя Кутуя",
            "address": "Казань, ул. Аделя Кутуя, 8",
            "city": "Казань",
            "lat": 55.7824,
            "lon": 49.1853,
            "created_by": "citizen_roman",
            "coordinator": None,
            "status": Request.Status.CREATED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "territory": None,
            "ownership": None,
            "organization": None,
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 1,
            "updated_after_hours": 1,
            "classification_comment": "",
        },
        {
            "slug": "kazan_private",
            "title": "Навал строительных отходов возле огражденного речного терминала",
            "address": "Казань, Портовая, 1",
            "city": "Казань",
            "lat": 55.7737,
            "lon": 49.0920,
            "created_by": "citizen_elmira",
            "coordinator": "coord_kazan",
            "status": Request.Status.TRANSFERRED,
            "handling_mode": Request.HandlingMode.EXTERNAL_TRANSFER,
            "subject": "16",
            "municipality": "kazan",
            "locality": "kazan",
            "territory": "PRIVATE_LAND",
            "ownership": "PRIVATE",
            "organization": "kazan_owner",
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 27,
            "updated_after_hours": 5,
            "classification_comment": "Огражденная территория речного терминала, направлено собственнику.",
            "external_transfer": {
                "target_org": "kazan_owner",
                "recipient_name": "ООО Речной терминал Казань",
                "recipient_contact": "owner-pier@example.com",
                "reason": "Частная огражденная территория речного терминала.",
                "comment": "Ожидается подтверждение от собственника.",
                "status": ExternalTransfer.TransferStatus.SENT,
                "close_after_hours": None,
            },
        },
        {
            "slug": "moscow_underpass",
            "title": "Мелкий мусор и листва у входа в подземный переход на Тверской",
            "address": "Москва, Тверская улица, 10",
            "city": "Москва",
            "lat": 55.7585,
            "lon": 37.6131,
            "created_by": "citizen_svetlana",
            "coordinator": "coord_moscow",
            "status": Request.Status.COMPLETED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "moscow_service",
            "department": "moscow_center",
            "brigade": "moscow_center_team",
            "worker": "moscow_worker_1",
            "days_ago": 76,
            "updated_after_hours": 14,
            "classification_comment": "Стандартная уборка центральной пешеходной зоны.",
            "verification": {"is_clean": True, "score": 0.93, "details": {"before_count": 9, "after_count": 1, "reduction": 0.89}},
        },
        {
            "slug": "moscow_yard_check",
            "title": "Переполненная урна и мусор у детской площадки во дворе дома",
            "address": "Москва, 2-я Брестская, 21",
            "city": "Москва",
            "lat": 55.7735,
            "lon": 37.5860,
            "created_by": "citizen_egor",
            "coordinator": "coord_moscow",
            "status": Request.Status.ON_CHECK,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "moscow_service",
            "department": "moscow_yard",
            "brigade": "moscow_yard_team",
            "worker": "moscow_yard_1",
            "days_ago": 22,
            "updated_after_hours": 19,
            "classification_comment": "Повторный контроль после жалобы жильцов на неполную уборку.",
            "verification": {"is_clean": False, "score": 0.73, "details": {"before_count": 15, "after_count": 4, "reduction": 0.73}},
            "rework": {"created_by": "coord_moscow", "previous_worker": "moscow_worker_2", "new_worker": "moscow_yard_1", "comment": "После первого выезда осталась зона вокруг песочницы."},
        },
        {
            "slug": "moscow_playground",
            "title": "Навал пакетов и коробок возле контейнерной площадки во дворе",
            "address": "Москва, Новослободская, 48",
            "city": "Москва",
            "lat": 55.7841,
            "lon": 37.5989,
            "created_by": "citizen_svetlana",
            "coordinator": "coord_moscow",
            "status": Request.Status.IN_PROGRESS,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "territory": "MUNICIPAL_LAND",
            "ownership": "MUNICIPAL",
            "organization": "moscow_service",
            "department": "moscow_yard",
            "brigade": "moscow_yard_team",
            "worker": "moscow_worker_2",
            "days_ago": 7,
            "updated_after_hours": 8,
            "classification_comment": "Уборка поставлена на ближайший дворовый маршрут.",
        },
        {
            "slug": "moscow_created",
            "title": "Бросовый мусор и стаканчики у остановки на Ленинградском проспекте",
            "address": "Москва, Ленинградский проспект, остановка у дома 28",
            "city": "Москва",
            "lat": 55.7827,
            "lon": 37.5778,
            "created_by": "citizen_egor",
            "coordinator": None,
            "status": Request.Status.CREATED,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "territory": None,
            "ownership": None,
            "organization": None,
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 3,
            "updated_after_hours": 1,
            "classification_comment": "",
        },
        {
            "slug": "moscow_road",
            "title": "Мусор вдоль проезжей части и на разделительной полосе у эстакады",
            "address": "Москва, Третье транспортное кольцо, съезд к Беговой",
            "city": "Москва",
            "lat": 55.7752,
            "lon": 37.5538,
            "created_by": "citizen_svetlana",
            "coordinator": "coord_moscow",
            "status": Request.Status.TRANSFERRED,
            "handling_mode": Request.HandlingMode.EXTERNAL_TRANSFER,
            "subject": "77",
            "municipality": "moscow",
            "locality": None,
            "territory": "ROAD_INFRASTRUCTURE",
            "ownership": "STATE",
            "organization": "moscow_roads",
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 16,
            "updated_after_hours": 4,
            "classification_comment": "Участок магистрали передан в профильную дорожную службу.",
            "external_transfer": {
                "target_org": "moscow_roads",
                "recipient_name": "ГБУ Автомобильные дороги ЦАО",
                "recipient_contact": "roads-cao@example.com",
                "reason": "Полоса отвода магистрали и проезжая часть.",
                "comment": "Передано для включения в дорожный маршрут уборки.",
                "status": ExternalTransfer.TransferStatus.ACCEPTED,
                "close_after_hours": None,
            },
        },
        {
            "slug": "moscow_private",
            "title": "Мусор у служебного входа торгового центра на частной территории",
            "address": "Москва, Ленинградский проспект, 75",
            "city": "Москва",
            "lat": 55.8055,
            "lon": 37.5163,
            "created_by": "citizen_egor",
            "coordinator": "coord_moscow",
            "status": Request.Status.TRANSFERRED,
            "handling_mode": Request.HandlingMode.EXTERNAL_TRANSFER,
            "subject": "77",
            "municipality": "moscow",
            "locality": "moscow",
            "territory": "PRIVATE_LAND",
            "ownership": "PRIVATE",
            "organization": "mall_owner",
            "department": None,
            "brigade": None,
            "worker": None,
            "days_ago": 12,
            "updated_after_hours": 5,
            "classification_comment": "Частная территория торгового центра, оформлена передача собственнику.",
            "external_transfer": {
                "target_org": "mall_owner",
                "recipient_name": "ООО Северная Галерея",
                "recipient_contact": "mall-owner@example.com",
                "reason": "Частная зона обслуживания торгового центра.",
                "comment": "Собственник подтвердил получение обращения.",
                "status": ExternalTransfer.TransferStatus.CLOSED,
                "close_after_hours": 36,
            },
        },
    ]

    status_comments = {
        Request.Status.CREATED: "Заявка создана гражданином через веб-интерфейс.",
        Request.Status.VERIFIED: "Оператор проверил данные и подтвердил корректность обращения.",
        Request.Status.IN_PROGRESS: "Заявка передана исполнителю и включена в работу.",
        Request.Status.ON_CHECK: "Исполнитель загрузил фото после уборки, заявка ожидает проверки.",
        Request.Status.COMPLETED: "Проверка завершена, нарушение устранено.",
        Request.Status.TRANSFERRED: "Обращение передано по принадлежности ответственному адресату.",
    }

    requests_created = []
    for index, spec in enumerate(request_specs, start=1):
        before_src = images[(index - 1) % len(images)]
        before_rel = str(Path("requests") / "before" / before_src.name).replace("\\", "/")
        has_after = spec.get("verification") is not None
        after_rel = copy_after_image(before_src, index, spec["slug"]) if has_after else None

        created_at = now - timedelta(days=spec["days_ago"], hours=4)
        updated_at = created_at + timedelta(hours=spec["updated_after_hours"])

        request_obj = Request.objects.create(
            title=spec["title"],
            address=spec["address"],
            location=Point(spec["lon"], spec["lat"]),
            city=spec["city"],
            federal_subject=subjects[spec["subject"]],
            municipality=municipalities[spec["municipality"]],
            locality=localities.get(spec["locality"]) if spec["locality"] else None,
            territory_type=territory_types.get(spec["territory"]) if spec.get("territory") else None,
            ownership_type=ownership_types.get(spec["ownership"]) if spec.get("ownership") else None,
            handling_mode=spec["handling_mode"],
            status=spec["status"],
            created_by=users[spec["created_by"]],
            responsible_organization=organizations.get(spec["organization"]) if spec.get("organization") else None,
            responsible_department=departments.get(spec["department"]) if spec.get("department") else None,
            assigned_brigade=brigades.get(spec["brigade"]) if spec.get("brigade") else None,
            assigned_worker=users.get(spec["worker"]) if spec.get("worker") else None,
            coordinator=users.get(spec["coordinator"]) if spec.get("coordinator") else None,
            classification_comment=spec.get("classification_comment", ""),
            before_photo=before_rel,
            after_photo=after_rel,
        )
        set_timestamps(Request, request_obj, created_at=created_at, updated_at=updated_at)

        status_flow = [Request.Status.CREATED]
        if spec["status"] == Request.Status.VERIFIED:
            status_flow += [Request.Status.VERIFIED]
        elif spec["status"] == Request.Status.IN_PROGRESS:
            status_flow += [Request.Status.VERIFIED, Request.Status.IN_PROGRESS]
        elif spec["status"] == Request.Status.ON_CHECK:
            status_flow += [Request.Status.VERIFIED, Request.Status.IN_PROGRESS, Request.Status.ON_CHECK]
        elif spec["status"] == Request.Status.COMPLETED:
            status_flow += [
                Request.Status.VERIFIED,
                Request.Status.IN_PROGRESS,
                Request.Status.ON_CHECK,
                Request.Status.COMPLETED,
            ]
        elif spec["status"] == Request.Status.TRANSFERRED:
            status_flow += [Request.Status.VERIFIED, Request.Status.TRANSFERRED]

        status_times = {}
        latest_time = created_at - timedelta(minutes=1)
        for status_value in status_flow:
            if status_value == Request.Status.CREATED:
                step_time = created_at
                actor = users[spec["created_by"]]
            elif status_value == Request.Status.VERIFIED:
                step_time = created_at + timedelta(hours=2)
                actor = users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"]
            elif status_value == Request.Status.IN_PROGRESS:
                step_time = created_at + timedelta(hours=6)
                actor = users.get(spec["worker"]) if spec.get("worker") else users.get(spec["coordinator"]) or users["admin_elena"]
            elif status_value == Request.Status.ON_CHECK:
                step_time = max(created_at + timedelta(hours=12), updated_at - timedelta(hours=2))
                actor = users.get(spec["worker"]) if spec.get("worker") else users.get(spec["coordinator"]) or users["admin_elena"]
            else:
                step_time = updated_at
                actor = users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"]

            if step_time <= latest_time:
                step_time = latest_time + timedelta(minutes=30)

            latest_time = step_time
            status_times[status_value] = step_time
            create_status_entry(
                request_obj,
                status_value,
                step_time,
                changed_by=actor,
                comment=status_comments[status_value],
            )

        routing_time = status_times.get(Request.Status.VERIFIED)
        if routing_time and spec.get("organization"):
            create_assignment(
                request_obj,
                RequestAssignment.AssignmentType.ROUTING,
                routing_time,
                assigned_by=users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"],
                organization=organizations.get(spec["organization"]),
                department=departments.get(spec["department"]) if spec.get("department") else None,
                brigade=brigades.get(spec["brigade"]) if spec.get("brigade") else None,
                comment="Маршрутизация после классификации обращения.",
            )

        in_progress_time = status_times.get(Request.Status.IN_PROGRESS)
        if in_progress_time and spec.get("worker"):
            completed_assignment_time = status_times.get(Request.Status.ON_CHECK) or status_times.get(Request.Status.COMPLETED)
            create_assignment(
                request_obj,
                RequestAssignment.AssignmentType.WORKER,
                in_progress_time,
                assigned_by=users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"],
                organization=organizations.get(spec["organization"]) if spec.get("organization") else None,
                department=departments.get(spec["department"]) if spec.get("department") else None,
                brigade=brigades.get(spec["brigade"]) if spec.get("brigade") else None,
                worker=users.get(spec["worker"]),
                comment="Назначение исполнителя на уборку.",
                accepted_at=in_progress_time + timedelta(minutes=45),
                completed_at=completed_assignment_time,
            )

        if spec.get("rework"):
            rework_time = status_times.get(Request.Status.ON_CHECK, updated_at - timedelta(hours=3))
            rework = spec["rework"]
            create_rework(
                request_obj,
                rework_time,
                created_by=users[rework["created_by"]],
                comment=rework["comment"],
                previous_worker=users.get(rework.get("previous_worker")) if rework.get("previous_worker") else None,
                new_worker=users.get(rework.get("new_worker")) if rework.get("new_worker") else None,
                previous_status=Request.Status.ON_CHECK,
            )
            create_assignment(
                request_obj,
                RequestAssignment.AssignmentType.REASSIGNMENT,
                rework_time + timedelta(minutes=15),
                assigned_by=users[rework["created_by"]],
                organization=organizations.get(spec["organization"]) if spec.get("organization") else None,
                department=departments.get(spec["department"]) if spec.get("department") else None,
                brigade=brigades.get(spec["brigade"]) if spec.get("brigade") else None,
                worker=users.get(rework.get("new_worker")) if rework.get("new_worker") else None,
                comment="Повторное назначение после возврата на доработку.",
            )

        if spec.get("verification"):
            verification_time = status_times.get(Request.Status.ON_CHECK, updated_at - timedelta(hours=1))
            create_verification(
                request_obj,
                verification_time,
                is_clean=spec["verification"]["is_clean"],
                score=spec["verification"]["score"],
                details=spec["verification"]["details"],
            )

        if spec.get("external_transfer"):
            transfer_spec = spec["external_transfer"]
            transfer_time = status_times.get(Request.Status.TRANSFERRED, updated_at)
            closed_at = (
                transfer_time + timedelta(hours=transfer_spec["close_after_hours"])
                if transfer_spec.get("close_after_hours")
                else None
            )
            create_transfer(
                request_obj,
                transfer_time,
                created_by=users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"],
                target_organization=organizations.get(transfer_spec["target_org"]) if transfer_spec.get("target_org") else None,
                recipient_name=transfer_spec.get("recipient_name", ""),
                recipient_contact=transfer_spec.get("recipient_contact", ""),
                transfer_reason=transfer_spec["reason"],
                comment=transfer_spec.get("comment", ""),
                outgoing_number=f"ИС-ЭКО/{now.year}/{index:03d}",
                status=transfer_spec["status"],
                closed_at=closed_at,
            )
            create_assignment(
                request_obj,
                RequestAssignment.AssignmentType.EXTERNAL_TRANSFER,
                transfer_time,
                assigned_by=users.get(spec["coordinator"]) if spec.get("coordinator") else users["admin_elena"],
                organization=organizations.get(transfer_spec["target_org"]) if transfer_spec.get("target_org") else None,
                comment="Передача обращения по внешней принадлежности.",
                completed_at=closed_at,
            )

        requests_created.append(request_obj)

    print("Database seeded with realistic demo data.")
    print(f"Federal subjects: {FederalSubject.objects.count()}")
    print(f"Municipalities: {Municipality.objects.count()}")
    print(f"Localities: {Locality.objects.count()}")
    print(f"Users: {User.objects.count()}")
    print(f"Organizations: {Organization.objects.count()}")
    print(f"Departments: {Department.objects.count()}")
    print(f"Brigades: {Brigade.objects.count()}")
    print(f"Responsibility zones: {ResponsibilityZone.objects.count()}")
    print(f"Requests: {Request.objects.count()}")
    print(f"Status history entries: {RequestStatusHistory.objects.count()}")
    print(f"Assignments: {RequestAssignment.objects.count()}")
    print(f"Reworks: {RequestRework.objects.count()}")
    print(f"External transfers: {ExternalTransfer.objects.count()}")
    print(f"Verification results: {VerificationResult.objects.count()}")
    print("Common password for all seeded users: Test12345!")


run()
