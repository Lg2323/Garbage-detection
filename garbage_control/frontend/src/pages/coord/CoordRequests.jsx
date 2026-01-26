import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllRequests } from "../../api/coord";
import { statusLabel } from "../../ui/status";
import Notice from "../../components/Notice";

const STATUSES = ["", "CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED"];

export default function CoordRequests() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => (x.title || "").toLowerCase().includes(s) || String(x.id).includes(s));
  }, [items, q]);

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Координатор — заявки</h4>
          <div className="text-muted">Список заявок и быстрый доступ к деталям</div>
        </div>
        <span className="badge text-bg-light">Всего: {items.length}</span>
      </div>

      <div className="row g-2 mb-3">
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
          <button className="btn btn-outline-secondary w-100" onClick={load} disabled={loading}>
            {loading ? "..." : "Применить"}
          </button>
        </div>
      </div>

      <Notice type="danger" text={msg} onClose={() => setMsg("")} />

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Описание</th>
              <th style={{ width: 160 }}>Статус</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>{r.title}</td>
                <td><span className="badge text-bg-secondary">{statusLabel(r.status)}</span></td>
                <td>
                  <Link to={`/coord/requests/${r.id}`} className="btn btn-sm btn-outline-primary">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="text-muted">Ничего не найдено</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
