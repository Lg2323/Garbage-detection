import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polygon, TileLayer, useMapEvents } from "react-leaflet";

function ClickCollector({ onAddPoint }) {
  useMapEvents({
    click(event) {
      onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function stringifyPoints(points) {
  return points.map((point) => point.join(", ")).join("\n");
}

function parsePoints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((value) => Number(value.trim())))
    .filter((pair) => pair.length === 2 && !Number.isNaN(pair[0]) && !Number.isNaN(pair[1]));
}

function toGeoJson(points) {
  if (points.length < 3) {
    return null;
  }

  const ring = points.map(([lat, lng]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closedRing = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];

  return {
    type: "MultiPolygon",
    coordinates: [[closedRing]],
  };
}

function getPolygonPoints(geometryGeoJson) {
  if (!geometryGeoJson) {
    return [];
  }
  if (geometryGeoJson.type === "Polygon") {
    return (geometryGeoJson.coordinates?.[0] || []).map(([lng, lat]) => [lat, lng]);
  }
  if (geometryGeoJson.type === "MultiPolygon") {
    return (geometryGeoJson.coordinates?.[0]?.[0] || []).map(([lng, lat]) => [lat, lng]);
  }
  return [];
}

export default function ZoneGeometryEditor({ value, onChange }) {
  const [points, setPoints] = useState(() => getPolygonPoints(value));

  useEffect(() => {
    setPoints(getPolygonPoints(value));
  }, [value]);

  const textValue = useMemo(() => stringifyPoints(points), [points]);
  const mapCenter = useMemo(() => points[0] || [55.79, 49.12], [points]);

  const commitPoints = (nextPoints) => {
    setPoints(nextPoints);
    onChange(toGeoJson(nextPoints));
  };

  return (
    <div className="gc-zone-editor">
      <div className="row g-3">
        <div className="col-lg-7">
          <MapContainer center={mapCenter} zoom={6} className="gc-map__canvas">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickCollector onAddPoint={(point) => commitPoints([...points, point])} />
            {points.length > 0 && <Polygon positions={points} pathOptions={{ color: "#2f7d57" }} />}
          </MapContainer>
          <div className="text-muted small mt-2">
            Клик по карте добавляет точку полигона. До 3 точек полигон считается черновиком и не сохраняется в базу.
          </div>
        </div>
        <div className="col-lg-5">
          <label className="form-label">Координаты полигона</label>
          <textarea
            className="form-control"
            rows={12}
            value={textValue}
            onChange={(event) => commitPoints(parsePoints(event.target.value))}
            placeholder={"55.80, 49.10\n55.81, 49.12\n55.79, 49.13"}
          />
          <div className="d-flex gap-2 mt-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={() => commitPoints(points.slice(0, -1))}
              disabled={!points.length}
            >
              Удалить последнюю точку
            </button>
            <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => commitPoints([])}>
              Очистить полигон
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
