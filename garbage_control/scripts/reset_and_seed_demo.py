from pathlib import Path
from shutil import copy2

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.utils import timezone

from requests_app.models import Request, VerificationResult


MEDIA_ROOT = Path("media")
BEFORE_DIR = MEDIA_ROOT / "requests" / "before"
AFTER_DIR = MEDIA_ROOT / "requests" / "after"
AFTER_DIR.mkdir(parents=True, exist_ok=True)


def _image_candidates() -> list[Path]:
    exts = (".jpg", ".jpeg", ".png", ".webp")
    return [p for p in sorted(BEFORE_DIR.iterdir()) if p.is_file() and p.suffix.lower() in exts]


def _copy_after_image(src: Path, index: int) -> str:
    dst_name = f"after_seed_{index}{src.suffix.lower()}"
    dst_rel = Path("requests") / "after" / dst_name
    dst_abs = MEDIA_ROOT / dst_rel
    copy2(src, dst_abs)
    return str(dst_rel).replace("\\", "/")


def run() -> None:
    images = _image_candidates()
    if len(images) < 5:
        raise RuntimeError("Нужно минимум 5 изображений в media/requests/before для заполнения.")

    User = get_user_model()

    users = [
        {
            "username": "citizen_anna",
            "email": "anna.ivanova@example.com",
            "phone": "+7-912-555-11-01",
            "city": "Москва",
            "role": "CITIZEN",
            "is_staff": False,
            "is_superuser": False,
            "first_name": "Анна",
            "last_name": "Иванова",
        },
        {
            "username": "citizen_pavel",
            "email": "pavel.smirnov@example.com",
            "phone": "+7-912-555-11-02",
            "city": "Москва",
            "role": "CITIZEN",
            "is_staff": False,
            "is_superuser": False,
            "first_name": "Павел",
            "last_name": "Смирнов",
        },
        {
            "username": "worker_oleg",
            "email": "oleg.petrov@example.com",
            "phone": "+7-912-555-11-03",
            "city": "Москва",
            "role": "WORKER",
            "is_staff": False,
            "is_superuser": False,
            "first_name": "Олег",
            "last_name": "Петров",
        },
        {
            "username": "coord_irina",
            "email": "irina.kuznetsova@example.com",
            "phone": "+7-912-555-11-04",
            "city": "Москва",
            "role": "COORDINATOR",
            "is_staff": True,
            "is_superuser": False,
            "first_name": "Ирина",
            "last_name": "Кузнецова",
        },
        {
            "username": "admin_maria",
            "email": "maria.admin@example.com",
            "phone": "+7-912-555-11-05",
            "city": "Москва",
            "role": "ADMIN",
            "is_staff": True,
            "is_superuser": True,
            "first_name": "Мария",
            "last_name": "Соколова",
        },
    ]

    created_users = {}
    for payload in users:
        user = User(**payload)
        user.set_password("Test12345!")
        user.save()
        created_users[user.username] = user

    citizen_1 = created_users["citizen_anna"]
    citizen_2 = created_users["citizen_pavel"]
    worker = created_users["worker_oleg"]
    coordinator = created_users["coord_irina"]

    request_specs = [
        {
            "title": "Переполненная урна у остановки «Площадь Ленина», мусор разлетается по тротуару",
            "status": Request.Status.CREATED,
            "city": "Москва",
            "created_by": citizen_1,
            "assigned_worker": None,
            "coordinator": None,
            "lat": 55.7558,
            "lon": 37.6176,
            "score": None,
            "is_clean": False,
            "details": {"stage": "before", "before_count": 7, "after_count": 0, "reduction": 0.0},
            "with_after": False,
            "days_ago": 4,
        },
        {
            "title": "Свалка пакетов и бутылок вдоль забора детской площадки на ул. Гагарина",
            "status": Request.Status.VERIFIED,
            "city": "Москва",
            "created_by": citizen_2,
            "assigned_worker": worker,
            "coordinator": coordinator,
            "lat": 55.7522,
            "lon": 37.6156,
            "score": None,
            "is_clean": False,
            "details": {"stage": "before", "before_count": 6, "after_count": 0, "reduction": 0.0},
            "with_after": False,
            "days_ago": 3,
        },
        {
            "title": "Скопление строительного мусора у контейнерной площадки во дворе дома 18",
            "status": Request.Status.IN_PROGRESS,
            "city": "Москва",
            "created_by": citizen_1,
            "assigned_worker": worker,
            "coordinator": coordinator,
            "lat": 55.7489,
            "lon": 37.6203,
            "score": None,
            "is_clean": False,
            "details": {"stage": "before", "before_count": 8, "after_count": 0, "reduction": 0.0},
            "with_after": False,
            "days_ago": 2,
        },
        {
            "title": "Кучи листвы и пластиковых бутылок на входе в городской парк",
            "status": Request.Status.ON_CHECK,
            "city": "Москва",
            "created_by": citizen_2,
            "assigned_worker": worker,
            "coordinator": coordinator,
            "lat": 55.7601,
            "lon": 37.6094,
            "score": 0.58,
            "is_clean": False,
            "details": {"before_count": 12, "after_count": 5, "reduction": 0.58},
            "with_after": True,
            "days_ago": 1,
        },
        {
            "title": "Разбросанный мелкий мусор у входа в подземный переход на проспекте Мира",
            "status": Request.Status.COMPLETED,
            "city": "Москва",
            "created_by": citizen_1,
            "assigned_worker": worker,
            "coordinator": coordinator,
            "lat": 55.7798,
            "lon": 37.6333,
            "score": 0.92,
            "is_clean": True,
            "details": {"before_count": 13, "after_count": 1, "reduction": 0.92},
            "with_after": True,
            "days_ago": 0,
        },
    ]

    created_requests = []
    now = timezone.now()
    for idx, spec in enumerate(request_specs, start=1):
        before_img = images[idx - 1]
        before_rel = str(Path("requests") / "before" / before_img.name).replace("\\", "/")
        after_rel = _copy_after_image(before_img, idx) if spec["with_after"] else None

        req = Request.objects.create(
            title=spec["title"],
            location=Point(spec["lon"], spec["lat"]),
            status=spec["status"],
            city=spec["city"],
            created_by=spec["created_by"],
            assigned_worker=spec["assigned_worker"],
            coordinator=spec["coordinator"],
            before_photo=before_rel,
            after_photo=after_rel,
        )

        created_at = now - timezone.timedelta(days=spec["days_ago"], hours=2)
        updated_at = now - timezone.timedelta(days=spec["days_ago"])
        Request.objects.filter(pk=req.pk).update(created_at=created_at, updated_at=updated_at)

        VerificationResult.objects.create(
            request=req,
            is_clean=spec["is_clean"],
            score=spec["score"],
            details=spec["details"],
        )
        created_requests.append(req)

    print("Seed done.")
    print(f"users={User.objects.count()} requests={Request.objects.count()} verifications={VerificationResult.objects.count()}")
    print("login password for all users: Test12345!")


run()
