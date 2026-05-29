import shutil
import tempfile
from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from ai_verification.services import AIVerifyOutput
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
    RequestStatusHistory,
    TerritoryType,
    VerificationResult,
    create_status_history_entry,
)
from users.models import User


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="garbage_test_media_requests_")


def make_test_image(name="test.jpg", color=(40, 110, 200)):
    buffer = BytesIO()
    Image.new("RGB", (32, 32), color).save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class RequestWorkflowApiTests(APITestCase):
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
            name="МБУ Департамент экологии и благоустройства АМР",
            short_name="МБУ Экология АМР",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )
        self.other_organization = Organization.objects.create(
            name="ООО Подрядчик Экосервис",
            short_name="Экосервис",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )

        self.department = Department.objects.create(
            organization=self.organization,
            name="Северный территориальный участок",
            department_type=Department.DepartmentType.TERRITORIAL,
        )
        self.other_department = Department.objects.create(
            organization=self.other_organization,
            name="Контрактный участок",
            department_type=Department.DepartmentType.CLEANUP,
        )

        self.territory_type = (
            TerritoryType.objects.filter(code="municipal").first()
            or TerritoryType.objects.filter(name="Муниципальная территория").first()
        )
        if self.territory_type is None:
            self.territory_type = TerritoryType.objects.create(
                code="municipal",
                name="Муниципальная территория",
                requires_external_transfer=False,
            )

        self.private_territory_type = (
            TerritoryType.objects.filter(code="private").first()
            or TerritoryType.objects.filter(name="Частная территория").first()
        )
        if self.private_territory_type is None:
            self.private_territory_type = TerritoryType.objects.create(
                code="private",
                name="Частная территория",
                requires_external_transfer=True,
            )

        self.ownership_type = (
            OwnershipType.objects.filter(code="municipal").first()
            or OwnershipType.objects.filter(name="Муниципальная собственность").first()
        )
        if self.ownership_type is None:
            self.ownership_type = OwnershipType.objects.create(
                code="municipal",
                name="Муниципальная собственность",
            )

        self.citizen = User.objects.create_user(
            username="citizen_test",
            password="Test12345!",
            role=User.Role.CITIZEN,
            city="Альметьевск",
        )
        self.coordinator = User.objects.create_user(
            username="coord_test",
            password="Test12345!",
            role=User.Role.COORDINATOR,
            city="Альметьевск",
        )
        self.org_manager = User.objects.create_user(
            username="org_manager_test",
            password="Test12345!",
            role=User.Role.ORG_MANAGER,
            city="Альметьевск",
            organization=self.organization,
            department=self.department,
        )
        self.department_manager = User.objects.create_user(
            username="department_manager_test",
            password="Test12345!",
            role=User.Role.DEPARTMENT_MANAGER,
            city="Альметьевск",
            organization=self.organization,
            department=self.department,
        )
        self.worker = User.objects.create_user(
            username="worker_test",
            password="Test12345!",
            role=User.Role.WORKER,
            city="Альметьевск",
            organization=self.organization,
            department=self.department,
        )
        self.other_worker = User.objects.create_user(
            username="worker_other_test",
            password="Test12345!",
            role=User.Role.WORKER,
            city="Альметьевск",
            organization=self.other_organization,
            department=self.other_department,
        )

        self.brigade = Brigade.objects.create(
            organization=self.organization,
            department=self.department,
            name="Бригада северного участка",
            supervisor=self.worker,
        )
        self.brigade.members.add(self.worker)

        self.coordinator_client = APIClient()
        self.coordinator_client.force_authenticate(self.coordinator)
        self.org_manager_client = APIClient()
        self.org_manager_client.force_authenticate(self.org_manager)
        self.department_manager_client = APIClient()
        self.department_manager_client.force_authenticate(self.department_manager)
        self.worker_client = APIClient()
        self.worker_client.force_authenticate(self.worker)
        self.other_worker_client = APIClient()
        self.other_worker_client.force_authenticate(self.other_worker)
        self.citizen_client = APIClient()
        self.citizen_client.force_authenticate(self.citizen)

    def create_request(
        self,
        *,
        status_value=Request.Status.CREATED,
        handling_mode=Request.HandlingMode.CLEANUP,
        assigned_worker=None,
        include_after_photo=False,
        territory_type=None,
        responsible_organization=None,
        responsible_department=None,
        assigned_brigade=None,
    ):
        request_obj = Request.objects.create(
            title="Несанкционированная свалка у контейнерной площадки",
            address="ул. Ленина, 25",
            location=Point(49.90, 54.90, srid=4326),
            city="Альметьевск",
            status=status_value,
            handling_mode=handling_mode,
            created_by=self.citizen,
            coordinator=self.coordinator,
            assigned_worker=assigned_worker,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            territory_type=territory_type or self.territory_type,
            ownership_type=self.ownership_type,
            responsible_organization=responsible_organization,
            responsible_department=responsible_department,
            assigned_brigade=assigned_brigade,
            classification_comment="Убрать навалы мусора и вывезти мешки.",
            before_photo=make_test_image("before.jpg"),
            after_photo=make_test_image("after.jpg", color=(120, 180, 120)) if include_after_photo else None,
        )
        create_status_history_entry(request_obj, request_obj.status, changed_by=self.citizen, comment="Тестовая инициализация.")
        return request_obj

    @override_settings(AI_ON_BEFORE_FOUND_STATUS=Request.Status.VERIFIED)
    @patch("requests_app.views.detect_garbage_before")
    @patch("requests_app.serializers.detect_city_by_coordinates")
    def test_citizen_can_create_request(self, mock_detect_city, mock_detect_before):
        mock_detect_city.return_value = "Альметьевск"
        mock_detect_before.return_value = AIVerifyOutput(
            is_clean=False,
            score=0.97,
            details={"detected": True},
        )

        response = self.citizen_client.post(
            "/api/requests/",
            {
                "title": "Свалка во дворе дома",
                "address": "ул. Тукая, 3",
                "latitude": "54.900100",
                "longitude": "49.900100",
                "city": "",
                "before_photo": make_test_image("create_before.jpg"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        request_obj = Request.objects.get(title="Свалка во дворе дома")
        self.assertEqual(request_obj.created_by, self.citizen)
        self.assertEqual(request_obj.city, "Альметьевск")
        self.assertEqual(request_obj.status, Request.Status.VERIFIED)
        self.assertTrue(RequestStatusHistory.objects.filter(request=request_obj).exists())
        self.assertTrue(VerificationResult.objects.filter(request=request_obj).exists())

    def test_coordinator_can_classify_request_and_create_routing_assignment(self):
        request_obj = self.create_request()

        response = self.coordinator_client.post(
            f"/api/requests/{request_obj.id}/classify/",
            {
                "address": "ул. Ленина, 25",
                "federal_subject": self.subject.id,
                "municipality": self.municipality.id,
                "locality": self.locality.id,
                "territory_type": self.territory_type.id,
                "ownership_type": self.ownership_type.id,
                "handling_mode": Request.HandlingMode.CLEANUP,
                "responsible_organization": self.organization.id,
                "classification_comment": "Закрепить за северным участком.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.VERIFIED)
        self.assertEqual(request_obj.responsible_organization, self.organization)
        self.assertIsNone(request_obj.responsible_department)
        self.assertIsNone(request_obj.assigned_brigade)
        self.assertTrue(
            RequestAssignment.objects.filter(
                request=request_obj,
                assignment_type=RequestAssignment.AssignmentType.ROUTING,
                assigned_organization=self.organization,
            ).exists()
        )

    def test_org_manager_sees_only_requests_of_his_organization(self):
        own_request = self.create_request(
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        self.create_request(
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.other_organization,
            responsible_department=self.other_department,
        )

        response = self.org_manager_client.get("/api/requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertEqual(returned_ids, {own_request.id})

    def test_coordinator_cannot_assign_worker_directly(self):
        request_obj = self.create_request(
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_brigade=self.brigade,
        )

        response = self.coordinator_client.post(
            f"/api/requests/{request_obj.id}/assign_worker/",
            {"worker_id": self.worker.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_org_manager_assigns_department_and_department_manager_assigns_worker(self):
        request_obj = self.create_request(
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
        )

        org_response = self.org_manager_client.post(
            f"/api/requests/{request_obj.id}/organization-assign/",
            {
                "responsible_department": self.department.id,
                "comment": "Назначить исполнителя северного участка.",
            },
            format="json",
        )
        department_response = self.department_manager_client.post(
            f"/api/requests/{request_obj.id}/department-assign/",
            {
                "assigned_brigade": self.brigade.id,
                "assigned_worker": self.worker.id,
                "comment": "Assign brigade and worker.",
            },
            format="json",
        )

        self.assertEqual(org_response.status_code, status.HTTP_200_OK)
        self.assertEqual(department_response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.responsible_department, self.department)
        self.assertEqual(request_obj.assigned_brigade, self.brigade)
        self.assertEqual(request_obj.assigned_worker, self.worker)
        self.assertTrue(
            RequestAssignment.objects.filter(
                request=request_obj,
                assignment_type=RequestAssignment.AssignmentType.WORKER,
                assigned_worker=self.worker,
            ).exists()
        )

    def test_worker_cannot_take_request_assigned_to_another_worker(self):
        request_obj = self.create_request(
            status_value=Request.Status.VERIFIED,
            assigned_worker=self.worker,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_brigade=self.brigade,
        )

        response = self.other_worker_client.post(f"/api/requests/{request_obj.id}/take_in_work/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.VERIFIED)

    @patch("requests_app.views.verify_cleanup")
    def test_worker_can_take_request_and_upload_after_photo(self, mock_verify_cleanup):
        mock_verify_cleanup.return_value = AIVerifyOutput(
            is_clean=False,
            score=0.44,
            details={"difference_detected": True},
        )
        request_obj = self.create_request(
            status_value=Request.Status.VERIFIED,
            assigned_worker=self.worker,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_brigade=self.brigade,
        )
        RequestAssignment.objects.create(
            request=request_obj,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=self.coordinator,
            assigned_organization=self.organization,
            assigned_department=self.department,
            assigned_brigade=self.brigade,
            assigned_worker=self.worker,
            comment="Назначено исполнителю.",
        )

        take_response = self.worker_client.post(f"/api/requests/{request_obj.id}/take_in_work/")
        self.assertEqual(take_response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.IN_PROGRESS)

        upload_response = self.worker_client.post(
            f"/api/requests/{request_obj.id}/upload_after_photo/",
            {"after_photo": make_test_image("upload_after.jpg", color=(120, 160, 140))},
            format="multipart",
        )
        self.assertEqual(upload_response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.ON_CHECK)
        self.assertTrue(bool(request_obj.after_photo))

    @patch("requests_app.views.verify_cleanup")
    def test_ai_verification_keeps_primary_precheck_details(self, mock_verify_cleanup):
        mock_verify_cleanup.side_effect = [
            AIVerifyOutput(
                is_clean=False,
                score=0.60,
                details={"before_count": 5, "after_count": 2, "reduction": 0.60},
            ),
            AIVerifyOutput(
                is_clean=True,
                score=1.0,
                details={"before_count": 5, "after_count": 0, "reduction": 1.0},
            ),
        ]
        request_obj = self.create_request(
            status_value=Request.Status.IN_PROGRESS,
            assigned_worker=self.worker,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_brigade=self.brigade,
        )
        VerificationResult.objects.create(
            request=request_obj,
            is_clean=False,
            details={"stage": "before", "before_count": 5, "conf_threshold": 0.25},
        )

        upload_response = self.worker_client.post(
            f"/api/requests/{request_obj.id}/upload_after_photo/",
            {"after_photo": make_test_image("upload_after_with_precheck.jpg", color=(120, 160, 140))},
            format="multipart",
        )

        self.assertEqual(upload_response.status_code, status.HTTP_200_OK)
        verification = VerificationResult.objects.get(request=request_obj)
        self.assertEqual(verification.details["precheck"]["before_count"], 5)
        self.assertEqual(verification.details["after_count"], 2)

        verify_response = self.coordinator_client.post(
            f"/api/requests/{request_obj.id}/verify/",
            {},
            format="json",
        )

        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        verification.refresh_from_db()
        self.assertEqual(verification.details["precheck"]["before_count"], 5)
        self.assertEqual(verification.details["after_count"], 0)

    @patch("requests_app.views.verify_cleanup")
    def test_coordinator_can_verify_request_and_complete_it(self, mock_verify_cleanup):
        mock_verify_cleanup.return_value = AIVerifyOutput(
            is_clean=True,
            score=0.99,
            details={"cleanup_confirmed": True},
        )
        request_obj = self.create_request(
            status_value=Request.Status.ON_CHECK,
            assigned_worker=self.worker,
            include_after_photo=True,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_brigade=self.brigade,
        )
        assignment = RequestAssignment.objects.create(
            request=request_obj,
            assignment_type=RequestAssignment.AssignmentType.WORKER,
            assigned_by=self.coordinator,
            assigned_organization=self.organization,
            assigned_department=self.department,
            assigned_brigade=self.brigade,
            assigned_worker=self.worker,
            comment="Назначено исполнителю.",
        )

        response = self.coordinator_client.post(f"/api/requests/{request_obj.id}/verify/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        assignment.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.COMPLETED)
        self.assertIsNotNone(assignment.completed_at)

    def test_coordinator_can_transfer_request_to_external_responsible_body(self):
        request_obj = self.create_request(
            status_value=Request.Status.VERIFIED,
            territory_type=self.private_territory_type,
            responsible_organization=self.organization,
        )

        response = self.coordinator_client.post(
            f"/api/requests/{request_obj.id}/external-transfer/",
            {
                "target_organization": self.other_organization.id,
                "recipient_name": "",
                "recipient_contact": "+7-900-000-00-00",
                "transfer_reason": "Участок относится к частной территории.",
                "comment": "Передано по принадлежности.",
                "outgoing_number": "ИС-2026-001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.TRANSFERRED)
        self.assertEqual(request_obj.handling_mode, Request.HandlingMode.EXTERNAL_TRANSFER)
        self.assertTrue(ExternalTransfer.objects.filter(request=request_obj).exists())
