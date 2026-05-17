import requests
from django.conf import settings


class RoadRouteBuildError(Exception):
    """Raised when a road route cannot be built by OSRM."""


def build_osrm_route(points):
    point_list = list(points)
    if len(point_list) < 2:
        raise RoadRouteBuildError("Для построения дорожного маршрута нужны минимум две точки.")

    coordinates = ";".join(_format_coordinate(point) for point in point_list)
    base_url = settings.OSRM_BASE_URL.rstrip("/")
    url = f"{base_url}/route/v1/driving/{coordinates}"

    try:
        response = requests.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise RoadRouteBuildError("сервис OSRM недоступен") from exc

    if response.status_code < 200 or response.status_code >= 300:
        raise RoadRouteBuildError(f"OSRM вернул HTTP {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise RoadRouteBuildError("OSRM вернул некорректный JSON") from exc

    if payload.get("code") != "Ok":
        message = payload.get("message") or payload.get("code") or "неизвестная ошибка"
        raise RoadRouteBuildError(f"OSRM не построил маршрут: {message}")

    routes = payload.get("routes") or []
    if not routes:
        raise RoadRouteBuildError("OSRM не вернул маршрут")

    route = routes[0]
    geometry = route.get("geometry")
    if not geometry or geometry.get("type") != "LineString" or not geometry.get("coordinates"):
        raise RoadRouteBuildError("OSRM вернул маршрут без GeoJSON LineString")

    return {
        "geometry": geometry,
        "distance_meters": float(route.get("distance") or 0),
        "duration_seconds": float(route.get("duration") or 0),
    }


def update_route_road_geometry(route, points):
    result = build_osrm_route(points)
    route.route_geometry = result["geometry"]
    route.distance_meters = result["distance_meters"]
    route.duration_seconds = result["duration_seconds"]
    route.save(
        update_fields=[
            "route_geometry",
            "distance_meters",
            "duration_seconds",
            "updated_at",
        ]
    )
    return route


def _format_coordinate(point):
    location = getattr(point, "location", None)
    if location is None:
        raise RoadRouteBuildError("у точки маршрута нет координат")

    return f"{float(location.x)},{float(location.y)}"
