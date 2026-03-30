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


def _extract_city_from_nominatim(address: dict) -> str:
    return (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or ""
    ).strip()


def _extract_address_from_nominatim(data: dict, city: str) -> str:
    address = data.get("address") or {}
    road = (address.get("road") or address.get("pedestrian") or address.get("footway") or "").strip()
    house_number = (address.get("house_number") or "").strip()
    line = " ".join(part for part in (road, house_number) if part).strip()
    if line:
        return line[:255]
    return ""


def _extract_city_from_yandex(components: list[dict]) -> str:
    for component in components:
        if component.get("kind") == "locality":
            name = (component.get("name") or "").strip()
            if name:
                return name[:120]
    return ""


def _extract_address_from_yandex(components: list[dict]) -> str:
    street = ""
    house = ""
    for component in components:
        kind = component.get("kind")
        name = (component.get("name") or "").strip()
        if not name:
            continue
        if kind in ("street", "route") and not street:
            street = name
        elif kind == "house" and not house:
            house = name

    if street and house:
        return f"{street}, {house}"[:255]
    if street:
        return street[:255]
    return ""


def detect_location_by_coordinates(lat: float, lon: float) -> dict:
    try:
        wrapped = _reverse_geocode(float(lat), float(lon))
        provider = wrapped.get("provider")
        data = wrapped.get("data") or {}

        if provider == "nominatim":
            address = data.get("address") or {}
            city = _extract_city_from_nominatim(address)[:120]
            return {
                "city": city,
                "address": _extract_address_from_nominatim(data, city),
            }

        members = (
            data.get("response", {})
            .get("GeoObjectCollection", {})
            .get("featureMember", [])
        )
        if not members:
            return {"city": "", "address": ""}

        geo_object = members[0].get("GeoObject", {})
        geocoder_meta = geo_object.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        address_meta = geocoder_meta.get("Address", {})
        components = address_meta.get("Components", [])
        city = _extract_city_from_yandex(components)
        return {
            "city": city,
            "address": _extract_address_from_yandex(components),
        }
    except Exception as exc:
        logger.warning("City detection failed for lat=%s lon=%s: %s", lat, lon, exc)
    return {"city": "", "address": ""}


def detect_city_by_coordinates(lat: float, lon: float) -> str:
    """
    Best-effort reverse geocoding.
    Returns empty string if city cannot be detected.
    """
    return detect_location_by_coordinates(lat, lon).get("city", "")
