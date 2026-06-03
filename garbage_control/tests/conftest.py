from io import BytesIO
from datetime import timedelta

import pytest
from PIL import Image
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

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
    TerritoryType,
    create_status_history_entry,
)
from users.models import User


@pytest.fixture(autouse=True)
def test_settings(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.DEFAULT_FROM_EMAIL = "noreply@example.com"
    settings.FRONTEND_BASE_URL = "http://frontend.test"
    return settings


@pytest.fixture
def password():
    return "Test12345!"


@pytest.fixture
def image_file():
    def factory(name="test.jpg", color=(40, 110, 200)):
        buffer = BytesIO()
        Image.new("RGB", (32, 32), color).save(buffer, format="JPEG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")

    return factory


@pytest.fixture
def make_client():
    def factory(user=None, token=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user=user)
        if token is not None:
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    return factory


@pytest.fixture
def federal_subject(db):
    return FederalSubject.objects.create(code="16", name="Tatarstan")


@pytest.fixture
def municipality(db, federal_subject):
    return Municipality.objects.create(
        federal_subject=federal_subject,
        name="Almetyevsk District",
        kind=Municipality.Kind.MUNICIPAL_DISTRICT,
    )


@pytest.fixture
def locality(db, municipality):
    return Locality.objects.create(
        municipality=municipality,
        name="Almetyevsk",
        kind=Locality.Kind.CITY,
    )


@pytest.fixture
def organization_type(db):
    return OrganizationType.objects.get_or_create(
        code="MUNICIPAL_SERVICE",
        defaults={
            "name": "Municipal Service",
            "description": "Municipal cleanup service.",
            "is_active": True,
        },
    )[0]


@pytest.fixture
def territory_type(db):
    return TerritoryType.objects.get_or_create(
        code="MUNICIPAL_LAND",
        defaults={
            "name": "Municipal Land",
            "description": "Municipal territory.",
            "requires_external_transfer": False,
            "is_active": True,
        },
    )[0]


@pytest.fixture
def external_territory_type(db):
    return TerritoryType.objects.get_or_create(
        code="PRIVATE_LAND",
        defaults={
            "name": "Private Land",
            "description": "Private territory.",
            "requires_external_transfer": True,
            "is_active": True,
        },
    )[0]


@pytest.fixture
def ownership_type(db):
    return OwnershipType.objects.get_or_create(
        code="MUNICIPAL",
        defaults={
            "name": "Municipal Ownership",
            "description": "Municipal ownership.",
            "is_active": True,
        },
    )[0]


@pytest.fixture
def organization(db, organization_type, federal_subject, municipality, locality):
    return Organization.objects.create(
        name="Eco Service Main",
        short_name="Eco Main",
        organization_type=organization_type,
        federal_subject=federal_subject,
        municipality=municipality,
        locality=locality,
    )


@pytest.fixture
def other_organization(db, organization_type, federal_subject, municipality, locality):
    return Organization.objects.create(
        name="Eco Service Secondary",
        short_name="Eco Secondary",
        organization_type=organization_type,
        federal_subject=federal_subject,
        municipality=municipality,
        locality=locality,
    )


@pytest.fixture
def department(db, organization):
    return Department.objects.create(
        organization=organization,
        name="North Department",
        department_type=Department.DepartmentType.TERRITORIAL,
    )


@pytest.fixture
def other_department(db, other_organization):
    return Department.objects.create(
        organization=other_organization,
        name="South Department",
        department_type=Department.DepartmentType.CLEANUP,
    )


@pytest.fixture
def citizen(db, password):
    return User.objects.create_user(
        username="citizen_user",
        email="citizen@example.com",
        password=password,
        role=User.Role.CITIZEN,
        city="Almetyevsk",
    )


@pytest.fixture
def coordinator(db, password):
    return User.objects.create_user(
        username="coordinator_user",
        email="coordinator@example.com",
        password=password,
        role=User.Role.COORDINATOR,
        city="Almetyevsk",
    )


@pytest.fixture
def admin_user(db, password):
    return User.objects.create_user(
        username="admin_user",
        email="admin@example.com",
        password=password,
        role=User.Role.ADMIN,
        city="Almetyevsk",
    )


@pytest.fixture
def worker(db, password, organization, department):
    return User.objects.create_user(
        username="worker_user",
        email="worker@example.com",
        password=password,
        role=User.Role.WORKER,
        city="Almetyevsk",
        organization=organization,
        department=department,
    )


@pytest.fixture
def other_worker(db, password, other_organization, other_department):
    return User.objects.create_user(
        username="other_worker_user",
        email="other-worker@example.com",
        password=password,
        role=User.Role.WORKER,
        city="Almetyevsk",
        organization=other_organization,
        department=other_department,
    )


@pytest.fixture
def org_manager(db, password, organization, department):
    return User.objects.create_user(
        username="org_manager_user",
        email="org-manager@example.com",
        password=password,
        role=User.Role.ORG_MANAGER,
        city="Almetyevsk",
        organization=organization,
        department=department,
    )


@pytest.fixture
def department_manager(db, password, organization, department):
    return User.objects.create_user(
        username="department_manager_user",
        email="department-manager@example.com",
        password=password,
        role=User.Role.DEPARTMENT_MANAGER,
        city="Almetyevsk",
        organization=organization,
        department=department,
    )


@pytest.fixture
def brigade(db, organization, department, worker):
    brigade = Brigade.objects.create(
        organization=organization,
        department=department,
        name="North Brigade",
        brigade_type=Brigade.BrigadeType.CLEANUP,
        supervisor=worker,
    )
    brigade.members.add(worker)
    return brigade


@pytest.fixture
def create_request(
    db,
    citizen,
    coordinator,
    federal_subject,
    municipality,
    locality,
    territory_type,
    ownership_type,
    image_file,
):
    def factory(
        *,
        title="Illegal dump near containers",
        status=Request.Status.CREATED,
        handling_mode=Request.HandlingMode.CLEANUP,
        created_by=None,
        assigned_worker=None,
        include_after_photo=False,
        territory=None,
        responsible_organization=None,
        responsible_department=None,
        assigned_brigade=None,
        coordinator_user=None,
        city="Almetyevsk",
        address="Lenina street, 25",
    ):
        request_obj = Request.objects.create(
            title=title,
            address=address,
            location=Point(49.90, 54.90, srid=4326),
            city=city,
            status=status,
            handling_mode=handling_mode,
            created_by=created_by or citizen,
            assigned_worker=assigned_worker,
            coordinator=coordinator_user or coordinator,
            federal_subject=federal_subject,
            municipality=municipality,
            locality=locality,
            territory_type=territory or territory_type,
            ownership_type=ownership_type,
            responsible_organization=responsible_organization,
            responsible_department=responsible_department,
            assigned_brigade=assigned_brigade,
            classification_comment="Route to responsible team.",
            before_photo=image_file("before.jpg"),
            after_photo=image_file("after.jpg", color=(120, 180, 120)) if include_after_photo else None,
        )
        create_status_history_entry(
            request_obj,
            request_obj.status,
            changed_by=request_obj.created_by,
            comment="Initial test status.",
        )
        return request_obj

    return factory


@pytest.fixture
def completed_request(create_request):
    request_obj = create_request(status=Request.Status.COMPLETED)
    now = timezone.now()
    Request.objects.filter(pk=request_obj.pk).update(
        created_at=now - timedelta(hours=6),
        updated_at=now - timedelta(hours=1),
    )
    request_obj.refresh_from_db()
    return request_obj
