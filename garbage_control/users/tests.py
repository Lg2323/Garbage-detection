import shutil
import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from requests_app.models import (
    Department,
    FederalSubject,
    Locality,
    Municipality,
    Organization,
    OrganizationType,
    Request,
    RequestAssignment,
    RequestRework,
)
from users.models import User


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="garbage_test_media_users_")


def make_test_image(name="test.jpg", color=(25, 120, 80)):
    buffer = BytesIO()
    Image.new("RGB", (24, 24), color).save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class AuthAndUserApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.subject, _ = FederalSubject.objects.get_or_create(
            code="16",
            defaults={"name": "Республика Татарстан"},
        )
        self.municipality, _ = Municipality.objects.get_or_create(
            federal_subject=self.subject,
            name="Альметьевский муниципальный район",
            kind=Municipality.Kind.MUNICIPAL_DISTRICT,
        )
        self.locality, _ = Locality.objects.get_or_create(
            municipality=self.municipality,
            name="Альметьевск",
            kind=Locality.Kind.CITY,
        )
        self.organization_type = (
            OrganizationType.objects.filter(code="municipal_service").first()
            or OrganizationType.objects.filter(name="Муниципальная служба").first()
        )
        if self.organization_type is None:
            self.organization_type = OrganizationType.objects.create(
                code="municipal_service",
                name="Муниципальная служба",
            )
        self.organization = Organization.objects.create(
            name="МБУ Департамент экологии Альметьевска",
            short_name="МБУ Экология Альметьевск",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )
        self.other_organization = Organization.objects.create(
            name="МБУ Благоустройство Казани",
            short_name="МБУ Казань",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )
        self.department = Department.objects.create(
            organization=self.organization,
            name="Северный участок",
            department_type=Department.DepartmentType.TERRITORIAL,
        )
        self.other_department = Department.objects.create(
            organization=self.other_organization,
            name="Центральный участок",
            department_type=Department.DepartmentType.TERRITORIAL,
        )

    def test_register_creates_new_citizen(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new_citizen",
                "first_name": "Ильдар",
                "last_name": "Сафин",
                "email": "new_citizen@example.com",
                "phone": "+79000000001",
                "city": "Альметьевск",
                "password": "Test12345!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="new_citizen")
        self.assertEqual(user.role, User.Role.CITIZEN)
        self.assertTrue(user.check_password("Test12345!"))

    def test_login_returns_access_token_and_refresh_cookie(self):
        User.objects.create_user(
            username="citizen_login",
            email="citizen_login@example.com",
            password="Test12345!",
            role=User.Role.CITIZEN,
        )

        response = self.client.post(
            "/api/auth/login/",
            {"username": "citizen_login", "password": "Test12345!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh_token", response.cookies)

    def test_org_manager_sees_only_workers_of_his_organization(self):
        manager = User.objects.create_user(
            username="org_manager_1",
            password="Test12345!",
            role=User.Role.ORG_MANAGER,
            organization=self.organization,
            department=self.department,
        )
        worker_in_org = User.objects.create_user(
            username="worker_in_org",
            password="Test12345!",
            role=User.Role.WORKER,
            organization=self.organization,
            department=self.department,
        )
        User.objects.create_user(
            username="worker_other_org",
            password="Test12345!",
            role=User.Role.WORKER,
            organization=self.other_organization,
            department=self.other_department,
        )

        client = APIClient()
        client.force_authenticate(user=manager)
        response = client.get("/api/auth/workers/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {item["username"] for item in response.data}
        self.assertEqual(usernames, {worker_in_org.username})

    def test_me_submitted_requests_returns_only_current_user_requests(self):
        citizen = User.objects.create_user(
            username="citizen_owner",
            password="Test12345!",
            role=User.Role.CITIZEN,
        )
        other_citizen = User.objects.create_user(
            username="citizen_other",
            password="Test12345!",
            role=User.Role.CITIZEN,
        )

        Request.objects.create(
            title="Свалка у контейнерной площадки",
            address="ул. Ленина, 10",
            location=Point(49.90, 54.90, srid=4326),
            city="Альметьевск",
            created_by=citizen,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("owner_before.jpg"),
        )
        Request.objects.create(
            title="Свалка в лесополосе",
            address="лесополоса у трассы",
            location=Point(49.91, 54.91, srid=4326),
            city="Альметьевск",
            created_by=other_citizen,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("other_before.jpg"),
        )

        client = APIClient()
        client.force_authenticate(user=citizen)
        response = client.get("/api/auth/me/submitted-requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["created_by"], citizen.id)

    def test_admin_stats_include_efficiency_and_worker_load(self):
        admin = User.objects.create_user(
            username="admin_stats",
            password="Test12345!",
            role=User.Role.ADMIN,
        )
        citizen = User.objects.create_user(
            username="citizen_stats",
            password="Test12345!",
            role=User.Role.CITIZEN,
        )
        worker_busy = User.objects.create_user(
            username="worker_busy",
            password="Test12345!",
            role=User.Role.WORKER,
            organization=self.organization,
            department=self.department,
        )
        worker_done = User.objects.create_user(
            username="worker_done",
            password="Test12345!",
            role=User.Role.WORKER,
            organization=self.organization,
            department=self.department,
        )

        request_in_progress = Request.objects.create(
            title="Активная заявка",
            address="ул. Ленина, 15",
            location=Point(49.90, 54.90, srid=4326),
            city="Альметьевск",
            status=Request.Status.IN_PROGRESS,
            created_by=citizen,
            assigned_worker=worker_busy,
            responsible_organization=self.organization,
            responsible_department=self.department,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("active_before.jpg"),
        )
        request_on_check = Request.objects.create(
            title="Заявка на проверке",
            address="ул. Мира, 8",
            location=Point(49.91, 54.91, srid=4326),
            city="Альметьевск",
            status=Request.Status.ON_CHECK,
            created_by=citizen,
            assigned_worker=worker_busy,
            responsible_organization=self.organization,
            responsible_department=self.department,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("check_before.jpg"),
        )
        request_unassigned = Request.objects.create(
            title="Нераспределенная заявка",
            address="пр. Победы, 3",
            location=Point(49.92, 54.92, srid=4326),
            city="Альметьевск",
            status=Request.Status.VERIFIED,
            created_by=citizen,
            responsible_organization=self.organization,
            responsible_department=self.department,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("queue_before.jpg"),
        )
        request_completed = Request.objects.create(
            title="Завершенная заявка",
            address="ул. Гагарина, 2",
            location=Point(49.93, 54.93, srid=4326),
            city="Альметьевск",
            status=Request.Status.COMPLETED,
            created_by=citizen,
            assigned_worker=worker_done,
            responsible_organization=self.organization,
            responsible_department=self.department,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            before_photo=make_test_image("done_before.jpg"),
        )
        Request.objects.filter(id=request_completed.id).update(
            created_at=request_completed.created_at - timedelta(hours=5),
            updated_at=request_completed.created_at,
        )

        RequestAssignment.objects.create(
            request=request_in_progress,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=admin,
            assigned_organization=self.organization,
            assigned_department=self.department,
            assigned_worker=worker_busy,
            comment="Назначено на исполнение.",
        )
        RequestAssignment.objects.create(
            request=request_on_check,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=admin,
            assigned_organization=self.organization,
            assigned_department=self.department,
            assigned_worker=worker_busy,
            comment="Ожидает проверки.",
        )
        completed_assignment = RequestAssignment.objects.create(
            request=request_completed,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=admin,
            assigned_organization=self.organization,
            assigned_department=self.department,
            assigned_worker=worker_done,
            comment="Работа завершена.",
            accepted_at=request_completed.created_at - timedelta(hours=3),
            completed_at=request_completed.created_at,
        )
        RequestAssignment.objects.filter(id=completed_assignment.id).update(
            created_at=request_completed.created_at - timedelta(hours=4),
            accepted_at=request_completed.created_at - timedelta(hours=3),
            completed_at=request_completed.created_at,
        )

        RequestRework.objects.create(
            request=request_on_check,
            created_by=admin,
            comment="Нужна доработка после проверки.",
            previous_worker=worker_busy,
            previous_status=Request.Status.ON_CHECK,
        )

        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get("/api/admin/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("request_efficiency", response.data)
        self.assertIn("worker_load", response.data)
        self.assertEqual(response.data["request_efficiency"]["active_requests"], 3)
        self.assertEqual(response.data["request_efficiency"]["waiting_for_start"], 1)
        self.assertEqual(response.data["request_efficiency"]["on_check_requests"], 1)
        self.assertEqual(response.data["request_efficiency"]["unassigned_requests"], 1)
        self.assertEqual(response.data["request_efficiency"]["rework_requests"], 1)
        self.assertEqual(response.data["request_efficiency"]["avg_completion_hours"], 5.0)

        worker_rows = {item["username"]: item for item in response.data["worker_load"]}
        self.assertEqual(worker_rows["worker_busy"]["active_requests"], 2)
        self.assertEqual(worker_rows["worker_busy"]["in_progress_requests"], 1)
        self.assertEqual(worker_rows["worker_busy"]["on_check_requests"], 1)
        self.assertEqual(worker_rows["worker_done"]["completed_requests"], 1)
        self.assertEqual(worker_rows["worker_done"]["avg_completion_hours"], 3.0)

        self.assertEqual(response.data["worker_load_summary"]["active_workers"], 1)
        self.assertEqual(response.data["worker_load_summary"]["workers_with_on_check"], 1)
        self.assertEqual(response.data["organization_backlog"][0]["active_requests"], 3)
