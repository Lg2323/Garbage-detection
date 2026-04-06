import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { getAllRequests } from "../../api/coord";
import Notice from "../../components/Notice";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { statusLabel } from "../../ui/status";

const STATUSES = ["", "CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED", "TRANSFERRED"];

const markerIcon = new L.Icon({
  iconUrl: marker1x,
  iconRetinaUrl: marker2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function parseLocation(loc) {
  if (!loc) return null;
  if (Array.isArray(loc) && loc.length === 2) {
    return { lng: Number(loc[0]), lat: Number(loc[1]) };
  }
  if (typeof loc === "string") {
    const match = loc.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { lng: Number(match[1]), lat: Number(match[2]) };
    }
  }
  if (loc.coordinates && Array.isArray(loc.coordinates)) {
    return { lng: Number(loc.coordinates[0]), lat: Number(loc.coordinates[1]) };
  }
  if (typeof loc.x === "number" && typeof loc.y === "number") {
    return { lng: Number(loc.x), lat: Number(loc.y) };
  }
  return null;
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);

  return null;
}

export default function CoordMap() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const filters = useMemo(() => ({ status, q }), [status, q]);
  const debouncedFilters = useDebouncedValue(filters);

  const load = async (nextFilters = filters) => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getAllRequests({
        status: nextFilters.status || undefined,
        q: nextFilters.q || undefined,
      });
      setItems(data);
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(debouncedFilters);
  }, [debouncedFilters]);

  const points = useMemo(
    () =>
      items
        .map((item) => ({ item, loc: parseLocation(item.location) }))
        .filter((entry) => entry.loc && !Number.isNaN(entry.loc.lat) && !Number.isNaN(entry.loc.lng)),
    [items]
  );

  const center = points.length ? [points[0].loc.lat, points[0].loc.lng] : [55.751244, 37.618423];

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="mb-0">Карта заявок</h4>
            <div className="text-muted">Метки заявок по координатам</div>
          </div>
          <button className="btn btn-outline-secondary" onClick={() => load(filters)} disabled={loading}>
            {loading ? "..." : "Обновить"}
          </button>
        </div>

        <div className="row g-2">
          <div className="col-md-8">
            <input
              className="form-control"
              placeholder="Поиск по id или описанию..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map((statusValue) => (
                <option key={statusValue} value={statusValue}>
                  {statusValue ? statusLabel(statusValue) : "Все статусы"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Notice type="danger" text={msg} onClose={() => setMsg("")} />
      </div>

      <div className="card p-3">
        <div className="gc-map">
          <MapContainer ref={mapRef} center={center} zoom={11} scrollWheelZoom className="gc-map__canvas">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points.map((point) => point.loc)} />
            {points.map(({ item, loc }) => (
              <Marker key={item.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
                <Popup>
                  <div className="d-grid gap-1">
                    <div className="fw-semibold">#{item.id}</div>
                    <div>{item.title}</div>
                    <div className="gc-muted">{statusLabel(item.status)}</div>
                    <Link to={`/coord/requests/${item.id}`}>Открыть</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        {!points.length && <div className="text-muted mt-2">Нет координат для отображения</div>}
      </div>
    </div>
  );
}
