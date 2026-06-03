import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

const DEFAULT_CENTER = [55.79, 49.12];
const DEFAULT_ZOOM = 6;
const SHAPES = [
  { value: "polygon", label: "Полигон" },
  { value: "square", label: "Квадрат" },
  { value: "circle", label: "Круг" },
];
const EARTH_RADIUS_METERS = 6378137;

const UI = {
  title: "Геометрия зоны",
  subtitle:
    "Во время рисования карта больше не приближается автоматически. Подогнать вид можно отдельной кнопкой.",
  fitFigure: "Показать фигуру",
  modePrefix: "Режим:",
  pointsPrefix: "Точек:",
  drawingInProgress: "Идет построение",
  drawingFinished: "Фигура завершена",
  coordinatesLabel: "Координаты вершин",
  completePolygon: "Завершить полигон",
  continueEditing: "Продолжить редактирование",
  removeLastPoint: "Удалить последнюю точку",
  clearFigure: "Очистить фигуру",
};

function ClickCollector({ disabled, onMapClick }) {
  useMapEvents({
    click(event) {
      if (!disabled) {
        onMapClick([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}

function MapViewportController({ points, fitRequest }) {
  const map = useMap();
  const lastAppliedFitRef = useRef(0);

  useEffect(() => {
    if (!fitRequest || lastAppliedFitRef.current === fitRequest) {
      return;
    }

    lastAppliedFitRef.current = fitRequest;

    if (!points.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }

    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  }, [fitRequest, map, points]);

  return null;
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function normalizePoints(points) {
  if (points.length > 1) {
    const [firstLat, firstLng] = points[0];
    const [lastLat, lastLng] = points[points.length - 1];

    if (firstLat === lastLat && firstLng === lastLng) {
      return points.slice(0, -1);
    }
  }

  return points;
}

function stringifyPoints(points) {
  return points
    .map(([lat, lng]) => `${roundCoordinate(lat)}, ${roundCoordinate(lng)}`)
    .join("\n");
}

function parsePoints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((value) => Number(value.trim())))
    .filter(
      (pair) => pair.length === 2 && !Number.isNaN(pair[0]) && !Number.isNaN(pair[1])
    );
}

function toGeoJson(points) {
  if (points.length < 3) {
    return null;
  }

  const ring = points.map(([lat, lng]) => [lng, lat]);
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  const closedRing =
    firstLng === lastLng && firstLat === lastLat ? ring : [...ring, ring[0]];

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
    return normalizePoints(
      (geometryGeoJson.coordinates?.[0] || []).map(([lng, lat]) => [lat, lng])
    );
  }

  if (geometryGeoJson.type === "MultiPolygon") {
    return normalizePoints(
      (geometryGeoJson.coordinates?.[0]?.[0] || []).map(([lng, lat]) => [lat, lng])
    );
  }

  return [];
}

function buildSquarePoints(startPoint, endPoint) {
  const latDelta = endPoint[0] - startPoint[0];
  const lngDelta = endPoint[1] - startPoint[1];
  const side = Math.max(Math.abs(latDelta), Math.abs(lngDelta));

  if (!side) {
    return [];
  }

  const latSign = latDelta === 0 ? 1 : Math.sign(latDelta);
  const lngSign = lngDelta === 0 ? 1 : Math.sign(lngDelta);
  const endLat = startPoint[0] + latSign * side;
  const endLng = startPoint[1] + lngSign * side;

  return [
    [startPoint[0], startPoint[1]],
    [startPoint[0], endLng],
    [endLat, endLng],
    [endLat, startPoint[1]],
  ];
}

function destinationPoint(center, bearingDegrees, distanceMeters) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (center[0] * Math.PI) / 180;
  const lng1 = (center[1] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [
    roundCoordinate((lat2 * 180) / Math.PI),
    roundCoordinate((lng2 * 180) / Math.PI),
  ];
}

function buildCirclePoints(center, edgePoint, segments = 48) {
  const radiusMeters = L.latLng(center[0], center[1]).distanceTo(
    L.latLng(edgePoint[0], edgePoint[1])
  );

  if (!radiusMeters) {
    return [];
  }

  const points = [];
  for (let index = 0; index < segments; index += 1) {
    points.push(destinationPoint(center, (index / segments) * 360, radiusMeters));
  }

  return points;
}

function getShapeInstruction(shapeMode, finished, anchorPoint) {
  if (shapeMode === "polygon") {
    if (finished) {
      return "Полигон завершен. Новые клики по карте не добавляют точки, пока вы не продолжите редактирование.";
    }

    return "Кликайте по карте, чтобы добавить вершины, затем нажмите «Завершить полигон».";
  }

  if (shapeMode === "square") {
    if (finished) {
      return "Квадрат уже построен. Чтобы нарисовать новый, очистите фигуру или смените режим.";
    }

    return anchorPoint
      ? "Сделайте второй клик, чтобы задать противоположный угол квадрата."
      : "Первый клик задает первый угол квадрата.";
  }

  if (finished) {
    return "Круг уже построен. Дополнительные клики по карте отключены до очистки или смены режима.";
  }

  return anchorPoint
    ? "Сделайте второй клик, чтобы задать радиус круга."
    : "Первый клик задает центр круга.";
}

export default function ZoneGeometryEditor({ value, onChange }) {
  const [shapeMode, setShapeMode] = useState("polygon");
  const [points, setPoints] = useState(() => getPolygonPoints(value));
  const [finished, setFinished] = useState(() => getPolygonPoints(value).length >= 3);
  const [anchorPoint, setAnchorPoint] = useState(null);
  const [fitRequest, setFitRequest] = useState(1);
  const internalUpdateRef = useRef(false);

  useEffect(() => {
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }

    const nextPoints = getPolygonPoints(value);
    setPoints(nextPoints);
    setFinished(nextPoints.length >= 3);
    setAnchorPoint(null);
    setFitRequest((current) => current + 1);
  }, [value]);

  const textValue = useMemo(() => stringifyPoints(points), [points]);
  const instruction = useMemo(
    () => getShapeInstruction(shapeMode, finished, anchorPoint),
    [anchorPoint, finished, shapeMode]
  );

  const commitPoints = (nextPoints, nextFinished = false) => {
    const normalizedPoints = normalizePoints(nextPoints);
    setPoints(normalizedPoints);
    setFinished(nextFinished && normalizedPoints.length >= 3);
    internalUpdateRef.current = true;
    onChange(toGeoJson(normalizedPoints));
  };

  const clearDrawing = () => {
    setAnchorPoint(null);
    setFinished(false);
    commitPoints([], false);
  };

  const handleShapeChange = (nextShapeMode) => {
    setShapeMode(nextShapeMode);
    clearDrawing();
  };

  const handleMapClick = (point) => {
    if (finished) {
      return;
    }

    if (shapeMode === "polygon") {
      commitPoints([...points, point], false);
      return;
    }

    if (!anchorPoint) {
      setAnchorPoint(point);
      return;
    }

    const nextPoints =
      shapeMode === "square"
        ? buildSquarePoints(anchorPoint, point)
        : buildCirclePoints(anchorPoint, point);

    setAnchorPoint(null);
    commitPoints(nextPoints, nextPoints.length >= 3);
  };

  const completePolygon = () => {
    if (points.length >= 3) {
      commitPoints(points, true);
    }
  };

  const removeLastPolygonPoint = () => {
    if (shapeMode !== "polygon" || !points.length) {
      return;
    }

    setAnchorPoint(null);
    commitPoints(points.slice(0, -1), false);
  };

  const handleTextChange = (event) => {
    const nextPoints = parsePoints(event.target.value);
    setShapeMode("polygon");
    setAnchorPoint(null);
    commitPoints(nextPoints, nextPoints.length >= 3);
  };

  const fitToFigure = () => {
    setFitRequest((current) => current + 1);
  };

  return (
    <div className="gc-zone-editor">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <div className="fw-semibold">{UI.title}</div>
          <div className="text-muted small">{UI.subtitle}</div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          {SHAPES.map((shape) => (
            <button
              key={shape.value}
              className={`btn btn-sm ${
                shapeMode === shape.value ? "btn-primary" : "btn-outline-secondary"
              }`}
              type="button"
              onClick={() => handleShapeChange(shape.value)}
            >
              {shape.label}
            </button>
          ))}

          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={fitToFigure}
          >
            {UI.fitFigure}
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className="gc-map__canvas"
            attributionControl={false}
          >
            <AttributionControl prefix={false} position="bottomright" />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapViewportController points={points} fitRequest={fitRequest} />
            <ClickCollector disabled={finished} onMapClick={handleMapClick} />

            {!!points.length && finished && (
              <Polygon
                positions={points}
                pathOptions={{ color: "#2f7d57", fillOpacity: 0.22 }}
              />
            )}

            {!!points.length && !finished && shapeMode === "polygon" && (
              <Polyline positions={points} pathOptions={{ color: "#2f7d57" }} />
            )}

            {anchorPoint && (
              <CircleMarker
                center={anchorPoint}
                radius={7}
                pathOptions={{
                  color: "#c2410c",
                  fillColor: "#ea580c",
                  fillOpacity: 0.9,
                }}
              />
            )}
          </MapContainer>

          <div className="d-flex gap-2 flex-wrap mt-2">
            <span className="gc-pill">
              {UI.modePrefix} {SHAPES.find((shape) => shape.value === shapeMode)?.label}
            </span>
            <span className="gc-pill">
              {UI.pointsPrefix} {points.length}
            </span>
            <span className="gc-pill">
              {finished ? UI.drawingFinished : UI.drawingInProgress}
            </span>
          </div>

          <div className="text-muted small mt-2">{instruction}</div>
        </div>

        <div className="col-lg-5">
          <label className="form-label">{UI.coordinatesLabel}</label>

          <textarea
            className="form-control"
            rows={12}
            value={textValue}
            onChange={handleTextChange}
            placeholder={"55.800000, 49.100000\n55.810000, 49.120000\n55.790000, 49.130000"}
          />

          <div className="d-flex gap-2 mt-2 flex-wrap">
            {shapeMode === "polygon" && (
              <button
                className="btn btn-outline-primary btn-sm"
                type="button"
                onClick={completePolygon}
                disabled={finished || points.length < 3}
              >
                {UI.completePolygon}
              </button>
            )}

            {shapeMode === "polygon" && finished && (
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                onClick={() => setFinished(false)}
              >
                {UI.continueEditing}
              </button>
            )}

            {shapeMode === "polygon" && (
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                onClick={removeLastPolygonPoint}
                disabled={!points.length}
              >
                {UI.removeLastPoint}
              </button>
            )}

            <button
              className="btn btn-outline-danger btn-sm"
              type="button"
              onClick={clearDrawing}
            >
              {UI.clearFigure}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
