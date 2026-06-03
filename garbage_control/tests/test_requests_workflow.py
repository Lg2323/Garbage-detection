from unittest.mock import patch

import pytest
from rest_framework import status

from ai_verification.services import AIVerifyOutput
from requests_app.models import Request, RequestAssignment, VerificationResult


pytestmark = pytest.mark.django_db


def test_create_request_runs_ai_precheck_and_creates_verification(citizen, make_client, image_file, locality):
    client = make_client(citizen)

    with patch("requests_app.serializers.detect_city_by_coordinates", return_value="Almetyevsk"), patch(
        "requests_app.views.detect_garbage_before",
        return_value=AIVerifyOutput(is_clean=False, score=0.91, details={"before_detected": True}),
    ) as mock_detect_before:
        response = client.post(
            "/api/requests/",
            {
                "title": "Overflowed waste site",
                "address": "Mira street, 10",
                "latitude": "54.900100",
                "longitude": "49.900100",
                "city": "",
                "before_photo": image_file("workflow-before.jpg"),
            },
            format="multipart",
        )

    assert response.status_code == status.HTTP_201_CREATED
    created_request = Request.objects.get(title="Overflowed waste site")
    verification = VerificationResult.objects.get(request=created_request)
    assert created_request.status == Request.Status.VERIFIED
    assert created_request.city == locality.name
    assert created_request.locality_id == locality.id
    assert created_request.municipality_id == locality.municipality_id
    assert created_request.federal_subject_id == locality.municipality.federal_subject_id
    assert verification.is_clean is False
    assert verification.score == 0.91
    mock_detect_before.assert_called_once()


def test_full_request_workflow_completes_request(
    citizen,
    coordinator,
    org_manager,
    department_manager,
    worker,
    make_client,
    image_file,
    federal_subject,
    municipality,
    locality,
    territory_type,
    ownership_type,
    organization,
    department,
    brigade,
):
    citizen_client = make_client(citizen)
    coordinator_client = make_client(coordinator)
    org_manager_client = make_client(org_manager)
    department_manager_client = make_client(department_manager)
    worker_client = make_client(worker)

    with patch("requests_app.serializers.detect_city_by_coordinates", return_value="Almetyevsk"), patch(
        "requests_app.views.detect_garbage_before",
        return_value=AIVerifyOutput(is_clean=False, score=0.99, details={"before_detected": True}),
    ):
        create_response = citizen_client.post(
            "/api/requests/",
            {
                "title": "Workflow request",
                "address": "Lenina street, 12",
                "latitude": "54.900100",
                "longitude": "49.900100",
                "city": "",
                "before_photo": image_file("before-workflow.jpg"),
            },
            format="multipart",
        )

    request_id = create_response.data["id"]
    classify_response = coordinator_client.post(
        f"/api/requests/{request_id}/classify/",
        {
            "address": "Lenina street, 12",
            "federal_subject": federal_subject.id,
            "municipality": municipality.id,
            "locality": locality.id,
            "territory_type": territory_type.id,
            "ownership_type": ownership_type.id,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "responsible_organization": organization.id,
            "classification_comment": "Route request to cleanup brigade.",
        },
        format="json",
    )
    org_assign_response = org_manager_client.post(
        f"/api/requests/{request_id}/organization-assign/",
        {
            "responsible_department": department.id,
            "comment": "Route request to department.",
        },
        format="json",
    )
    department_assign_response = department_manager_client.post(
        f"/api/requests/{request_id}/department-assign/",
        {
            "assigned_brigade": brigade.id,
            "assigned_worker": worker.id,
            "comment": "Assign cleanup crew.",
        },
        format="json",
    )
    take_response = worker_client.post(f"/api/requests/{request_id}/take_in_work/")

    with patch(
        "requests_app.views.verify_cleanup",
        side_effect=[
            AIVerifyOutput(is_clean=False, score=0.40, details={"stage": "upload"}),
            AIVerifyOutput(is_clean=True, score=0.97, details={"stage": "verify"}),
        ],
    ):
        upload_response = worker_client.post(
            f"/api/requests/{request_id}/upload_after_photo/",
            {"after_photo": image_file("after-workflow.jpg", color=(110, 170, 110))},
            format="multipart",
        )
        verify_response = coordinator_client.post(
            f"/api/requests/{request_id}/verify/",
            {},
            format="json",
        )

    request_obj = Request.objects.get(pk=request_id)
    assignments = RequestAssignment.objects.filter(request=request_obj)
    verification = VerificationResult.objects.get(request=request_obj)

    assert create_response.status_code == status.HTTP_201_CREATED
    assert classify_response.status_code == status.HTTP_200_OK
    assert org_assign_response.status_code == status.HTTP_200_OK
    assert department_assign_response.status_code == status.HTTP_200_OK
    assert take_response.status_code == status.HTTP_200_OK
    assert upload_response.status_code == status.HTTP_200_OK
    assert verify_response.status_code == status.HTTP_200_OK
    assert request_obj.status == Request.Status.COMPLETED
    assert request_obj.assigned_worker == worker
    assert request_obj.after_photo
    assert assignments.filter(assignment_type=RequestAssignment.AssignmentType.ROUTING).exists()
    assert assignments.filter(assignment_type=RequestAssignment.AssignmentType.WORKER).exists()
    assert verification.is_clean is True
    assert verify_response.data["request_status"] == Request.Status.COMPLETED


def test_verify_returns_request_to_in_progress_when_cleanup_not_confirmed(
    coordinator,
    worker,
    make_client,
    create_request,
    organization,
    department,
    brigade,
):
    request_obj = create_request(
        status=Request.Status.ON_CHECK,
        assigned_worker=worker,
        include_after_photo=True,
        responsible_organization=organization,
        responsible_department=department,
        assigned_brigade=brigade,
    )
    RequestAssignment.objects.create(
        request=request_obj,
        assignment_type=RequestAssignment.AssignmentType.WORKER,
        assigned_by=coordinator,
        assigned_organization=organization,
        assigned_department=department,
        assigned_brigade=brigade,
        assigned_worker=worker,
        comment="Assigned for cleanup.",
    )
    client = make_client(coordinator)

    with patch(
        "requests_app.views.verify_cleanup",
        return_value=AIVerifyOutput(is_clean=False, score=0.25, details={"cleanup_failed": True}),
    ):
        response = client.post(
            f"/api/requests/{request_obj.id}/verify/",
            {},
            format="json",
        )

    request_obj.refresh_from_db()
    verification = VerificationResult.objects.get(request=request_obj)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["request_status"] == Request.Status.IN_PROGRESS
    assert request_obj.status == Request.Status.IN_PROGRESS
    assert verification.is_clean is False
