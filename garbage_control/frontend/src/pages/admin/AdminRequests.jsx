import { useEffect, useMemo, useState } from "react";
import { getRequests } from "../../api/requests";

export default function AdminRequests() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getRequests()
      .then((data) => setItems(data))
      .catch((e) => setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message)));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => (x.title || "").toLowerCase().includes(s) || String(x.id).includes(s));
  }, [items, q]);

  return (
    <div className="card p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Заявки</h4>
          <div className="text-muted">Админ-вид (список всех)</div>
        </div>
        <span className="badge text-bg-light">Всего: {items.length}</span>
      </div>

      <input
        className="form-control mb-3"
        placeholder="Поиск по id или описанию..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {msg && <div className="alert alert-danger">{msg}</div>}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Описание</th>
              <th style={{ width: 140 }}>Статус</th>
              <th style={{ width: 220 }}>Создана</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>{r.title}</td>
                <td><span className="badge text-bg-secondary">{r.status}</span></td>
                <td className="text-muted">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
