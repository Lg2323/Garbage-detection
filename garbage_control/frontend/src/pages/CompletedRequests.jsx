import { useEffect, useState } from "react";
import { getCompletedRequests } from "../api/requests";
import { statusClass, statusLabel } from "../ui/status";
import Notice from "../components/Notice";

export default function CompletedRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getCompletedRequests();
      setItems(data || []);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-end justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Выполненные работы</h4>
          <div className="gc-muted">Общий список завершенных заявок</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="gc-pill">Всего: {items.length}</div>
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? "..." : "Обновить"}
          </button>
        </div>
      </div>

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="gc-muted">
              <th style={{ width: 90 }}>#</th>
              <th>Описание</th>
              <th style={{ width: 140 }}>Статус</th>
              <th style={{ width: 140 }}>Фото после</th>
              <th style={{ width: 220 }}>Завершена</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>{r.title}</td>
                <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                <td>
                  {r.after_photo ? (
                    <img
                      src={r.after_photo}
                      alt="after"
                      className="rounded border"
                      style={{ width: 72, height: 48, objectFit: "cover" }}
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="gc-muted">
                  {r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="text-muted">Пока нет завершенных заявок</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
