import { useEffect, useMemo } from "react";
import L from "leaflet";
import { AttributionControl, CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";

function FitToContent({ center, zones }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);

    if (center) {
      bounds.extend([center[0], center[1]]);
    }

    for (const zone of zones) {
      if (!zone.geometry_geojson) continue;
      const layer = L.geoJSON(zone.geometry_geojson);
      const zoneBounds = layer.getBounds();
      if (zoneBounds.isValid()) {
        bounds.extend(zoneBounds);
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
  }, [center, map, zones]);

  return null;
}

function zoneStyle(zone) {
  if (zone.is_selected) {
    return {
      color: "#1f5f44",
      weight: 3,
      fillColor: "#2f7d57",
      fillOpacity: 0.18,
    };
  }

  return {
    color: "#5c8c72",
    weight: 2,
    fillColor: "#8fc6a6",
    fillOpacity: 0.14,
  };
}

export default function RequestResponsibilityMap({
  latitude,
  longitude,
  zones = [],
  emptyText = "Нет данных для карты ответственности.",
}) {
  const center = useMemo(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return null;
    }
    return [Number(latitude), Number(longitude)];
  }, [latitude, longitude]);

  const mapCenter = center || [55.79, 49.12];

  return (
    <div className="gc-map gc-map--responsibility">
      <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="gc-map__canvas" attributionControl={false}>
        <AttributionControl prefix={false} position="bottomright" />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToContent center={center} zones={zones} />

        {zones.map((zone) =>
          zone.geometry_geojson ? (
            <GeoJSON key={zone.id} data={zone.geometry_geojson} style={() => zoneStyle(zone)}>
              <Popup>
                <div className="d-grid gap-1">
                  <div className="fw-semibold">{zone.name}</div>
                  <div>{zone.organization_name || "-"}</div>
                  {zone.department_name && <div>{zone.department_name}</div>}
                  {zone.brigade_name && <div>{zone.brigade_name}</div>}
                </div>
              </Popup>
            </GeoJSON>
          ) : null
        )}

        {center && (
          <CircleMarker center={center} radius={9} pathOptions={{ color: "#c2410c", fillColor: "#ea580c", fillOpacity: 0.85 }}>
            <Popup>
              <div className="fw-semibold">Точка заявки</div>
              <div className="text-muted small">
                {center[0].toFixed(6)}, {center[1].toFixed(6)}
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {!center && !zones.length && <div className="gc-map__empty">{emptyText}</div>}
    </div>
  );
}
