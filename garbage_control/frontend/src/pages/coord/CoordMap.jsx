import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { getAllRequests } from "../../api/coord";
import Notice from "../../components/Notice";
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
    const m = loc.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) return { lng: Number(m[1]), lat: Number(m[2]) };
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
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
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

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getAllRequests({ status: status || undefined, q: q || undefined });
      setItems(data);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const points = useMemo(() => {
    return items
      .map((r) => ({ r, loc: parseLocation(r.location) }))
      .filter((x) => x.loc && !Number.isNaN(x.loc.lat) && !Number.isNaN(x.loc.lng));
  }, [items]);

  const center = points.length ? [points[0].loc.lat, points[0].loc.lng] : [55.751244, 37.618423];

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="mb-0">Карта заявок</h4>
            <div className="text-muted">Метки заявок по координатам</div>
          </div>
          <button className="btn btn-outline-secondary" onClick={load} disabled={loading}>
            {loading ? "..." : "Обновить"}
          </button>
        </div>

        <div className="row g-2">
          <div className="col-md-6">
            <input
              className="form-control"
              placeholder="Поиск по id или описанию..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s ? statusLabel(s) : "Все статусы"}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" onClick={load} disabled={loading}>
              {loading ? "..." : "Применить"}
            </button>
          </div>
        </div>

        <Notice type="danger" text={msg} onClose={() => setMsg("")} />
      </div>

      <div className="card p-3">
        <div className="gc-map">
          <MapContainer ref={mapRef} center={center} zoom={11} scrollWheelZoom className="gc-map__canvas">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points.map((p) => p.loc)} />
            {points.map(({ r, loc }) => (
              <Marker key={r.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
                <Popup>
                  <div className="d-grid gap-1">
                    <div className="fw-semibold">#{r.id}</div>
                    <div>{r.title}</div>
                    <div className="gc-muted">{statusLabel(r.status)}</div>
                    <Link to={`/coord/requests/${r.id}`}>Открыть</Link>
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
