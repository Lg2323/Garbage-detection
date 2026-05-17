import shutil
import tempfile
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

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
    Route,
    RoutePoint,
    TerritoryType,
    create_status_history_entry,
)
from requests_app.services.routing import RoadRouteBuildError, build_osrm_route
from users.models import User


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="garbage_test_media_routes_")


def make_test_image(name="test.jpg", color=(40, 110, 200)):
    buffer = BytesIO()
    Image.new("RGB", (32, 32), color).save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@override_settings(OSRM_BASE_URL="https://osrm.test")
class OsrmRoutingServiceTests(SimpleTestCase):
    def make_point(self, lon, lat):
        return SimpleNamespace(location=Point(lon, lat, srid=4326))

    def make_osrm_response(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "code": "Ok",
            "routes": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[49.1, 55.7], [49.2, 55.8]],
                    },
                    "distance": 1234.5,
                    "duration": 456.7,
                }
            ],
        }
        return response

    @patch("requests_app.services.routing.requests.get")
    def test_build_osrm_route_formats_coordinates_as_lon_lat(self, mocked_get):
        mocked_get.return_value = self.make_osrm_response()

        build_osrm_route([self.make_point(49.1, 55.7), self.make_point(49.2, 55.8)])

        url = mocked_get.call_args.args[0]
        self.assertIn("/route/v1/driving/49.1,55.7;49.2,55.8", url)
        self.assertEqual(mocked_get.call_args.kwargs["params"]["geometries"], "geojson")
        self.assertEqual(mocked_get.call_args.kwargs["timeout"], 10)

    @patch("requests_app.services.routing.requests.get")
    def test_build_osrm_route_returns_geometry_distance_duration(self, mocked_get):
        mocked_get.return_value = self.make_osrm_response()

        result = build_osrm_route([self.make_point(49.1, 55.7), self.make_point(49.2, 55.8)])

        self.assertEqual(result["geometry"]["type"], "LineString")
        self.assertEqual(result["distance_meters"], 1234.5)
        self.assertEqual(result["duration_seconds"], 456.7)

    @patch("requests_app.services.routing.requests.get")
    def test_build_osrm_route_raises_clear_error_on_osrm_error(self, mocked_get):
        response = Mock(status_code=200)
        response.json.return_value = {"code": "NoRoute", "message": "No route found"}
        mocked_get.return_value = response

        with self.assertRaisesRegex(RoadRouteBuildError, "No route found"):
            build_osrm_route([self.make_point(49.1, 55.7), self.make_point(49.2, 55.8)])


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class RouteApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.subject, _ = FederalSubject.objects.get_or_create(code="16", defaults={"name": "Татарстан"})
        self.municipality, _ = Municipality.objects.get_or_create(
            federal_subject=self.subject,
            name="Альметьевский район",
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

        self.territory_type = (
            TerritoryType.objects.filter(code="municipal_land").first()
            or TerritoryType.objects.filter(name="Муниципальная территория").first()
        )
        if self.territory_type is None:
            self.territory_type = TerritoryType.objects.create(
                code="municipal_land",
                name="Муниципальная территория",
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
        self.organization = Organization.objects.create(
            name="Eco Service Main",
            short_name="Eco Main",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )
        self.other_organization = Organization.objects.create(
            name="Eco Service Secondary",
            short_name="Eco Secondary",
            organization_type=self.organization_type,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
        )
        self.department = Department.objects.create(
            organization=self.organization,
            name="North Department",
            department_type=Department.DepartmentType.CLEANUP,
        )
        self.second_department = Department.objects.create(
            organization=self.organization,
            name="South Department",
            department_type=Department.DepartmentType.CLEANUP,
        )
        self.other_department = Department.objects.create(
            organization=self.other_organization,
            name="Other Department",
            department_type=Department.DepartmentType.CLEANUP,
        )

        self.citizen = User.objects.create_user(
            username="citizen_user",
            password="Test12345!",
            role=User.Role.CITIZEN,
        )
        self.coordinator = User.objects.create_user(
            username="coordinator_user",
            password="Test12345!",
            role=User.Role.COORDINATOR,
        )
        self.org_manager = User.objects.create_user(
            username="org_manager_user",
            password="Test12345!",
            role=User.Role.ORG_MANAGER,
            organization=self.organization,
            department=self.department,
        )
        self.department_manager = User.objects.create_user(
            username="department_manager_user",
            password="Test12345!",
            role=User.Role.DEPARTMENT_MANAGER,
            organization=self.organization,
            department=self.department,
        )
        self.worker = User.objects.create_user(
            username="worker_user",
            password="Test12345!",
            role=User.Role.WORKER,
            organization=self.organization,
            department=self.department,
        )

        self.brigade = Brigade.objects.create(
            organization=self.organization,
            department=self.department,
            name="North Brigade",
            brigade_type=Brigade.BrigadeType.CLEANUP,
            supervisor=self.worker,
        )
        self.brigade.members.add(self.worker)

    def auth_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def create_request(
        self,
        *,
        title,
        status_value,
        responsible_organization,
        responsible_department,
        assigned_worker=None,
    ):
        request_obj = Request.objects.create(
            title=title,
            address="Lenina street, 25",
            location=Point(49.90, 54.90, srid=4326),
            city="Almetyevsk",
            status=status_value,
            handling_mode=Request.HandlingMode.CLEANUP,
            created_by=self.citizen,
            assigned_worker=assigned_worker,
            coordinator=self.coordinator,
            federal_subject=self.subject,
            municipality=self.municipality,
            locality=self.locality,
            territory_type=self.territory_type,
            ownership_type=self.ownership_type,
            responsible_organization=responsible_organization,
            responsible_department=responsible_department,
            before_photo=make_test_image(f"{title}.jpg"),
        )
        create_status_history_entry(
            request_obj,
            request_obj.status,
            changed_by=self.citizen,
            comment="Initial status for route tests.",
        )
        return request_obj

    def create_route_with_points(self, *, requests, assigned_worker=None, brigade=None):
        route = Route.objects.create(
            organization=self.organization,
            department=self.department,
            brigade=brigade,
            assigned_worker=assigned_worker,
            created_by=self.org_manager,
            name="Morning cleanup route",
            status=Route.Status.ASSIGNED if assigned_worker or brigade else Route.Status.DRAFT,
        )
        for order_number, request_obj in enumerate(requests, start=1):
            RoutePoint.objects.create(
                route=route,
                request=request_obj,
                order_number=order_number,
                address=request_obj.address,
                location=request_obj.location,
            )
        return route

    def apply_mock_road_geometry(self, route, points):
        route.route_geometry = {
            "type": "LineString",
            "coordinates": [[49.90, 54.90], [49.91, 54.91]],
        }
        route.distance_meters = 2500.0
        route.duration_seconds = 600.0
        route.save(
            update_fields=[
                "route_geometry",
                "distance_meters",
                "duration_seconds",
                "updated_at",
            ]
        )
        return route

    def test_org_manager_available_requests_are_limited_to_own_organization(self):
        own_request = self.create_request(
            title="Own organization request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        self.create_request(
            title="Other organization request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.other_organization,
            responsible_department=self.other_department,
        )

        response = self.auth_client(self.org_manager).get("/api/routes/available-requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(own_request.id, returned_ids)
        self.assertTrue(all(item["responsible_organization"] == self.organization.id for item in response.data))

    def test_department_manager_sees_only_own_department_requests(self):
        own_request = self.create_request(
            title="Own department request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        self.create_request(
            title="Second department request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.second_department,
        )

        response = self.auth_client(self.department_manager).get("/api/routes/available-requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(own_request.id, returned_ids)
        self.assertTrue(all(item["responsible_department"] == self.department.id for item in response.data))

    def test_coordinator_cannot_create_route(self):
        request_one = self.create_request(
            title="Route request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Route request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )

        response = self.auth_client(self.coordinator).post(
            "/api/routes/",
            {
                "name": "Coordinator route",
                "request_ids": [request_one.id, request_two.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("requests_app.route_serializers.update_route_road_geometry")
    def test_org_manager_can_create_route_from_two_requests(self, mocked_update_road_geometry):
        mocked_update_road_geometry.side_effect = self.apply_mock_road_geometry
        request_one = self.create_request(
            title="Route request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Route request two",
            status_value=Request.Status.IN_PROGRESS,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )

        response = self.auth_client(self.org_manager).post(
            "/api/routes/",
            {
                "name": "North line",
                "request_ids": [request_one.id, request_two.id],
                "comment": "Morning run",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        route = Route.objects.get(pk=response.data["id"])
        self.assertEqual(route.organization, self.organization)
        self.assertEqual(route.department, self.department)
        self.assertEqual(route.points.count(), 2)

    @patch("requests_app.route_serializers.update_route_road_geometry")
    def test_route_creation_saves_road_geometry(self, mocked_update_road_geometry):
        mocked_update_road_geometry.side_effect = self.apply_mock_road_geometry
        request_one = self.create_request(
            title="Road geometry request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Road geometry request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )

        response = self.auth_client(self.org_manager).post(
            "/api/routes/",
            {
                "name": "Road geometry route",
                "request_ids": [request_one.id, request_two.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        route = Route.objects.get(pk=response.data["id"])
        self.assertEqual(route.route_geometry["type"], "LineString")
        self.assertEqual(route.distance_meters, 2500.0)
        self.assertEqual(response.data["distance_km"], 2.5)
        self.assertEqual(response.data["duration_minutes"], 10.0)

    def test_org_manager_cannot_add_foreign_request(self):
        own_request = self.create_request(
            title="Own request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        foreign_request = self.create_request(
            title="Foreign request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.other_organization,
            responsible_department=self.other_department,
        )

        response = self.auth_client(self.org_manager).post(
            "/api/routes/",
            {
                "name": "Invalid route",
                "request_ids": [own_request.id, foreign_request.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("request_ids", response.data)

    def test_completed_request_cannot_be_added_to_route(self):
        active_request = self.create_request(
            title="Active request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        completed_request = self.create_request(
            title="Completed request",
            status_value=Request.Status.COMPLETED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )

        response = self.auth_client(self.org_manager).post(
            "/api/routes/",
            {
                "name": "Completed forbidden route",
                "request_ids": [active_request.id, completed_request.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("request_ids", response.data)

    @patch("requests_app.route_serializers.update_route_road_geometry")
    def test_route_points_are_created_with_order_numbers(self, mocked_update_road_geometry):
        mocked_update_road_geometry.side_effect = self.apply_mock_road_geometry
        request_one = self.create_request(
            title="Point order one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Point order two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )

        response = self.auth_client(self.org_manager).post(
            "/api/routes/",
            {
                "name": "Ordered route",
                "request_ids": [request_one.id, request_two.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        route = Route.objects.get(pk=response.data["id"])
        self.assertEqual(list(route.points.values_list("order_number", flat=True)), [1, 2])

    def test_worker_sees_assigned_route(self):
        request_one = self.create_request(
            title="Worker route request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        request_two = self.create_request(
            title="Worker route request two",
            status_value=Request.Status.IN_PROGRESS,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        route = self.create_route_with_points(requests=[request_one, request_two], assigned_worker=self.worker)

        response = self.auth_client(self.worker).get("/api/routes/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(route.id, returned_ids)

    @patch("requests_app.route_views.update_route_road_geometry")
    def test_rebuild_road_route_updates_geometry(self, mocked_update_road_geometry):
        mocked_update_road_geometry.side_effect = self.apply_mock_road_geometry
        request_one = self.create_request(
            title="Rebuild request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Rebuild request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        route = self.create_route_with_points(requests=[request_one, request_two])

        response = self.auth_client(self.org_manager).post(f"/api/routes/{route.id}/rebuild-road-route/")

        route.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(route.route_geometry["type"], "LineString")
        self.assertEqual(response.data["distance_km"], 2.5)

    def test_coordinator_cannot_rebuild_road_route(self):
        request_one = self.create_request(
            title="Coordinator rebuild request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        request_two = self.create_request(
            title="Coordinator rebuild request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        route = self.create_route_with_points(requests=[request_one, request_two])

        response = self.auth_client(self.coordinator).post(f"/api/routes/{route.id}/rebuild-road-route/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_worker_cannot_rebuild_road_route(self):
        request_one = self.create_request(
            title="Worker rebuild request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        request_two = self.create_request(
            title="Worker rebuild request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        route = self.create_route_with_points(requests=[request_one, request_two], assigned_worker=self.worker)

        response = self.auth_client(self.worker).post(f"/api/routes/{route.id}/rebuild-road-route/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_org_manager_cannot_rebuild_foreign_route(self):
        request_one = self.create_request(
            title="Foreign rebuild request one",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.other_organization,
            responsible_department=self.other_department,
        )
        request_two = self.create_request(
            title="Foreign rebuild request two",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.other_organization,
            responsible_department=self.other_department,
        )
        route = Route.objects.create(
            organization=self.other_organization,
            department=self.other_department,
            created_by=self.org_manager,
            name="Foreign road route",
            status=Route.Status.DRAFT,
        )
        for order_number, request_obj in enumerate([request_one, request_two], start=1):
            RoutePoint.objects.create(
                route=route,
                request=request_obj,
                order_number=order_number,
                address=request_obj.address,
                location=request_obj.location,
            )

        response = self.auth_client(self.org_manager).post(f"/api/routes/{route.id}/rebuild-road-route/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_rebuild_road_route_with_one_point_returns_400(self):
        request_one = self.create_request(
            title="Single point route request",
            status_value=Request.Status.VERIFIED,
            responsible_organization=self.organization,
            responsible_department=self.department,
        )
        route = self.create_route_with_points(requests=[request_one])

        response = self.auth_client(self.org_manager).post(f"/api/routes/{route.id}/rebuild-road-route/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_complete_route_returns_400_when_not_all_requests_completed(self):
        request_one = self.create_request(
            title="Completed request in route",
            status_value=Request.Status.COMPLETED,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        request_two = self.create_request(
            title="Incomplete request in route",
            status_value=Request.Status.IN_PROGRESS,
            responsible_organization=self.organization,
            responsible_department=self.department,
            assigned_worker=self.worker,
        )
        route = self.create_route_with_points(requests=[request_one, request_two], assigned_worker=self.worker)

        response = self.auth_client(self.worker).post(f"/api/routes/{route.id}/complete/")

        route.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(route.status, Route.Status.ASSIGNED)
        self.assertIn("Нельзя завершить маршрут", response.data["error"])
