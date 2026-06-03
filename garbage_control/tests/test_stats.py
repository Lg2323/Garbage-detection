from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from requests_app.models import Request, RequestRework


pytestmark = pytest.mark.django_db


def test_stats_endpoint_returns_expected_fields_and_aggregated_values(
    admin_user,
    citizen,
    worker,
    create_request,
    make_client,
    organization,
    department,
    territory_type,
):
    create_request(
        title="In progress request",
        status=Request.Status.IN_PROGRESS,
        assigned_worker=worker,
        responsible_organization=organization,
        responsible_department=department,
        city="Almetyevsk",
    )
    on_check_request = create_request(
        title="On check request",
        status=Request.Status.ON_CHECK,
        assigned_worker=worker,
        responsible_organization=organization,
        responsible_department=department,
        city="Almetyevsk",
    )
    completed_request = create_request(
        title="Completed request",
        status=Request.Status.COMPLETED,
        assigned_worker=worker,
        responsible_organization=organization,
        responsible_department=department,
        city="Kazan",
    )
    create_request(
        title="Transferred request",
        status=Request.Status.TRANSFERRED,
        handling_mode=Request.HandlingMode.EXTERNAL_TRANSFER,
        created_by=citizen,
        city="Kazan",
        territory=territory_type,
        responsible_organization=organization,
        responsible_department=department,
    )

    now = timezone.now()
    Request.objects.filter(pk=completed_request.pk).update(
        created_at=now - timedelta(hours=6),
        updated_at=now - timedelta(hours=1),
    )
    RequestRework.objects.create(
        request=on_check_request,
        created_by=admin_user,
        comment="Need rework after inspection.",
        previous_worker=worker,
        previous_status=Request.Status.ON_CHECK,
    )

    client = make_client(admin_user)
    response = client.get("/api/requests/stats/")
    by_status = {row["status"]: row["count"] for row in response.data["by_status"]}
    by_city = {row["city"]: row["count"] for row in response.data["by_city"]}
    timeline = response.data["timeline"]

    assert response.status_code == status.HTTP_200_OK
    assert response.data["total"] == 4
    assert response.data["active"] == 2
    assert response.data["completed"] == 1
    assert response.data["transferred"] == 1
    assert response.data["rework_requests"] == 1
    assert response.data["completion_rate"] == 25.0
    assert response.data["transfer_rate"] == 25.0
    assert response.data["avg_completion_hours"] == 5.0
    assert by_status[Request.Status.IN_PROGRESS] == 1
    assert by_status[Request.Status.ON_CHECK] == 1
    assert by_status[Request.Status.COMPLETED] == 1
    assert by_status[Request.Status.TRANSFERRED] == 1
    assert by_city["Almetyevsk"] == 2
    assert by_city["Kazan"] == 2
    assert len(timeline) == 1
    assert timeline[0]["count"] == 4
    assert "filters" in response.data
    assert "available_filters" in response.data
    assert "by_handling_mode" in response.data
    assert "by_organization" in response.data
    assert "by_municipality" in response.data
