from functools import lru_cache
import json
import logging
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen


logger = logging.getLogger(__name__)


@lru_cache(maxsize=256)
def _reverse_geocode(lat: float, lon: float) -> dict:
    query = urlencode(
        {
            "format": "jsonv2",
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
            "zoom": 10,
            "addressdetails": 1,
            "accept-language": "ru,en",
        }
    )
    url = f"https://nominatim.openstreetmap.org/reverse?{query}"
    req = URLRequest(
        url,
        headers={
            "User-Agent": "garbage-control/1.0 (city-detection)",
        },
    )
    with urlopen(req, timeout=4) as resp:
        return json.loads(resp.read().decode("utf-8"))


def detect_city_by_coordinates(lat: float, lon: float) -> str:
    """
    Best-effort reverse geocoding.
    Returns empty string if city cannot be detected.
    """
    try:
        data = _reverse_geocode(float(lat), float(lon))
        address = data.get("address") or {}
        for key in ("city", "town", "village", "municipality", "county", "state"):
            value = address.get(key)
            if value:
                return str(value)[:120].strip()
    except Exception as exc:
        logger.warning("City detection failed for lat=%s lon=%s: %s", lat, lon, exc)
    return ""
