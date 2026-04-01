from unittest.mock import patch

import pytest
from rest_framework import status

from ai_verification.services import AIVerifyOutput
from requests_app.models import Request


pytestmark = pytest.mark.django_db


def test_citizen_can_create_request(citizen, make_client, image_file):
    client = make_client(citizen)

    with patch("requests_app.serializers.detect_city_by_coordinates", return_value="Almetyevsk"), patch(
        "requests_app.views.detect_garbage_before",
        return_value=AIVerifyOutput(is_clean=False, score=0.98, details={"detected": True}),
    ):
        response = client.post(
            "/api/requests/",
            {
                "title": "Garbage near house",
                "address": "Lenina street, 5",
                "latitude": "54.900100",
                "longitude": "49.900100",
                "city": "",
                "before_photo": image_file("create-before.jpg"),
            },
            format="multipart",
        )

    assert response.status_code == status.HTTP_201_CREATED
    created_request = Request.objects.get(title="Garbage near house")
    assert created_request.created_by == citizen


def test_citizen_cannot_classify_request(citizen, make_client, create_request):
    request_obj = create_request(created_by=citizen)
    client = make_client(citizen)

    response = client.post(
        f"/api/requests/{request_obj.id}/classify/",
        {"classification_comment": "Attempted by citizen."},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_worker_cannot_perform_coordinator_classification(worker, make_client, create_request):
    request_obj = create_request(status=Request.Status.VERIFIED, assigned_worker=worker)
    client = make_client(worker)

    response = client.post(
        f"/api/requests/{request_obj.id}/classify/",
        {"classification_comment": "Attempted by worker."},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_coordinator_can_classify_request(
    coordinator,
    make_client,
    create_request,
    federal_subject,
    municipality,
    locality,
    territory_type,
    ownership_type,
    organization,
    department,
    brigade,
):
    request_obj = create_request()
    client = make_client(coordinator)

    response = client.post(
        f"/api/requests/{request_obj.id}/classify/",
        {
            "address": "Lenina street, 25",
            "federal_subject": federal_subject.id,
            "municipality": municipality.id,
            "locality": locality.id,
            "territory_type": territory_type.id,
            "ownership_type": ownership_type.id,
            "handling_mode": Request.HandlingMode.CLEANUP,
            "responsible_organization": organization.id,
            "responsible_department": department.id,
            "assigned_brigade": brigade.id,
            "classification_comment": "Classified by coordinator.",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    request_obj.refresh_from_db()
    assert request_obj.status == Request.Status.VERIFIED
    assert request_obj.responsible_organization == organization
    assert request_obj.responsible_department == department
    assert request_obj.assigned_brigade == brigade


def test_org_manager_can_assign_inside_his_organization(
    org_manager,
    make_client,
    create_request,
    organization,
    department,
    brigade,
    worker,
):
    request_obj = create_request(
        status=Request.Status.VERIFIED,
        responsible_organization=organization,
    )
    client = make_client(org_manager)

    response = client.post(
        f"/api/requests/{request_obj.id}/organization-assign/",
        {
            "responsible_department": department.id,
            "assigned_brigade": brigade.id,
            "assigned_worker": worker.id,
            "comment": "Assigned by org manager.",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    request_obj.refresh_from_db()
    assert request_obj.assigned_worker == worker
    assert request_obj.responsible_department == department


def test_worker_can_take_in_work_only_his_own_request(
    worker,
    other_worker,
    make_client,
    create_request,
    organization,
    department,
    brigade,
):
    own_request = create_request(
        status=Request.Status.VERIFIED,
        assigned_worker=worker,
        responsible_organization=organization,
        responsible_department=department,
        assigned_brigade=brigade,
    )
    foreign_request = create_request(
        title="Assigned to another worker",
        status=Request.Status.VERIFIED,
        assigned_worker=other_worker,
        responsible_organization=organization,
        responsible_department=department,
        assigned_brigade=brigade,
    )
    own_client = make_client(worker)
    foreign_client = make_client(other_worker)

    own_response = own_client.post(f"/api/requests/{own_request.id}/take_in_work/")
    foreign_response = foreign_client.post(f"/api/requests/{own_request.id}/take_in_work/")

    assert own_response.status_code == status.HTTP_200_OK
    own_request.refresh_from_db()
    assert own_request.status == Request.Status.IN_PROGRESS
    assert foreign_response.status_code == status.HTTP_404_NOT_FOUND
    foreign_request.refresh_from_db()
    assert foreign_request.status == Request.Status.VERIFIED


def test_admin_can_change_request_status(admin_user, make_client, create_request):
    request_obj = create_request(status=Request.Status.VERIFIED)
    client = make_client(admin_user)

    response = client.post(
        f"/api/requests/{request_obj.id}/set_status/",
        {"status": Request.Status.TRANSFERRED},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    request_obj.refresh_from_db()
    assert request_obj.status == Request.Status.TRANSFERRED
    assert request_obj.handling_mode == Request.HandlingMode.EXTERNAL_TRANSFER
