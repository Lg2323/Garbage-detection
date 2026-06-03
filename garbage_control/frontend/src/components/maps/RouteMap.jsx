import { useEffect, useMemo } from "react";
import L from "leaflet";
import { AttributionControl, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { statusLabel } from "../../ui/status";

function FitToRoute({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) {
      return;
    }

    const bounds = L.latLngBounds(positions);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
  }, [map, positions]);

  return null;
}

function buildMarkerIcon(orderNumber) {
  return L.divIcon({
    className: "gc-route-marker-wrap",
    html: `<span class="gc-route-marker">${orderNumber}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function RouteMap({
  points = [],
  routeGeometry = null,
  emptyText = "Маршрут пока не содержит точек с координатами.",
}) {
  const normalizedPoints = useMemo(
    () =>
      (points || [])
        .map((point) => {
          const latitude = Number(point.latitude);
          const longitude = Number(point.longitude);
          if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return null;
          }
          return {
            ...point,
            latitude,
            longitude,
          };
        })
        .filter(Boolean),
    [points]
  );

  const positions = useMemo(
    () => normalizedPoints.map((point) => [point.latitude, point.longitude]),
    [normalizedPoints]
  );

  const roadLine = useMemo(() => {
    if (routeGeometry?.type !== "LineString" || !Array.isArray(routeGeometry.coordinates)) {
      return [];
    }

    return routeGeometry.coordinates
      .map((coordinate) => {
        if (!Array.isArray(coordinate) || coordinate.length < 2) {
          return null;
        }
        const longitude = Number(coordinate[0]);
        const latitude = Number(coordinate[1]);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
          return null;
        }
        return [latitude, longitude];
      })
      .filter(Boolean);
  }, [routeGeometry]);

  const fitPositions = useMemo(
    () => (roadLine.length ? [...roadLine, ...positions] : positions),
    [positions, roadLine]
  );

  const center = positions[0] || [55.79, 49.12];

  return (
    <div className="gc-map gc-map--responsibility">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="gc-map__canvas" attributionControl={false}>
        <AttributionControl prefix={false} position="bottomright" />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToRoute positions={fitPositions} />

        {roadLine.length > 1 && (
          <Polyline positions={roadLine} pathOptions={{ color: "#2d6a4f", weight: 4, opacity: 0.85 }} />
        )}

        {normalizedPoints.map((point) => (
          <Marker
            key={point.id ?? `${point.request}-${point.order_number}`}
            position={[point.latitude, point.longitude]}
            icon={buildMarkerIcon(point.order_number)}
          >
            <Popup>
              <div className="d-grid gap-1">
                <div className="fw-semibold">
                  {point.order_number}. Заявка #{point.request}
                </div>
                {point.request_title && <div>{point.request_title}</div>}
                {point.address && <div className="text-muted small">{point.address}</div>}
                {point.request_status && <div>Статус: {statusLabel(point.request_status)}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {!normalizedPoints.length && <div className="gc-map__empty">{emptyText}</div>}
      {normalizedPoints.length > 1 && !roadLine.length && (
        <div className="gc-map__warning alert alert-warning">
          Дорожный маршрут не построен. Отображаются только точки заявок.
        </div>
      )}
    </div>
  );
}
