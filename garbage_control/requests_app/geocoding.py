from functools import lru_cache
import json
import logging
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=256)
def _reverse_geocode(lat: float, lon: float) -> dict:
    api_key = (getattr(settings, "YANDEX_GEOCODER_API_KEY", "") or "").strip()
    if not api_key:
        query = urlencode(
            {
                "format": "jsonv2",
                "lat": f"{lat:.6f}",
                "lon": f"{lon:.6f}",
                "accept-language": "ru",
                "addressdetails": 1,
            }
        )
        url = f"https://nominatim.openstreetmap.org/reverse?{query}"
        req = URLRequest(
            url,
            headers={
                "User-Agent": "garbage-control/1.0 (city-detection-fallback)",
            },
        )
        with urlopen(req, timeout=4) as resp:
            return {"provider": "nominatim", "data": json.loads(resp.read().decode("utf-8"))}

    query = urlencode(
        {
            "apikey": api_key,
            "format": "json",
            "geocode": f"{lon:.6f},{lat:.6f}",
            "lang": "ru_RU",
            "results": 1,
        }
    )
    url = f"https://geocode-maps.yandex.ru/1.x/?{query}"
    req = URLRequest(
        url,
        headers={
            "User-Agent": "garbage-control/1.0 (city-detection)",
        },
    )
    with urlopen(req, timeout=4) as resp:
        return {"provider": "yandex", "data": json.loads(resp.read().decode("utf-8"))}


def detect_city_by_coordinates(lat: float, lon: float) -> str:
    """
    Best-effort reverse geocoding.
    Returns empty string if city cannot be detected.
    """
    try:
        wrapped = _reverse_geocode(float(lat), float(lon))
        provider = wrapped.get("provider")
        data = wrapped.get("data") or {}

        if provider == "nominatim":
            address = data.get("address") or {}
            city = (
                address.get("city")
                or address.get("town")
                or address.get("village")
                or address.get("municipality")
                or ""
            ).strip()
            return city[:120] if city else ""

        members = (
            data.get("response", {})
            .get("GeoObjectCollection", {})
            .get("featureMember", [])
        )
        if not members:
            return ""

        components = (
            members[0]
            .get("GeoObject", {})
            .get("metaDataProperty", {})
            .get("GeocoderMetaData", {})
            .get("Address", {})
            .get("Components", [])
        )
        for component in components:
            if component.get("kind") == "locality":
                name = (component.get("name") or "").strip()
                if name:
                    return name[:120]
    except Exception as exc:
        logger.warning("City detection failed for lat=%s lon=%s: %s", lat, lon, exc)
    return ""
