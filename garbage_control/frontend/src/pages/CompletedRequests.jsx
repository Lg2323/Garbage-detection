import { useEffect, useState } from "react";
import { getCompletedRequests } from "../api/requests";
import { statusClass, statusLabel } from "../ui/status";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";

export default function CompletedRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 6;

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

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

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

      <div className="gc-completed-grid">
        {pagedItems.map((r) => {
          const pos = positions[r.id] ?? 50;
          const hasBefore = Boolean(r.before_photo);
          const hasAfter = Boolean(r.after_photo);

          return (
            <div key={r.id} className="gc-card gc-completed-card p-3">
              <div className="gc-compare mb-3">
                {hasBefore ? (
                  <img src={r.before_photo} alt="before" className="gc-compare__img" />
                ) : (
                  <div className="gc-compare__empty">Нет фото "до"</div>
                )}

                {hasAfter && (
                  <div className="gc-compare__after" style={{ width: `${pos}%` }}>
                    <img src={r.after_photo} alt="after" className="gc-compare__img" />
                  </div>
                )}

                {hasBefore && hasAfter && (
                  <>
                    <input
                      className="gc-compare__range"
                      type="range"
                      min="0"
                      max="100"
                      value={pos}
                      onChange={(e) =>
                        setPositions((prev) => ({ ...prev, [r.id]: Number(e.target.value) }))
                      }
                      aria-label="Сравнение до и после"
                    />
                    <div className="gc-compare__handle" style={{ left: `${pos}%` }} />
                    <span className="gc-compare__label gc-compare__label--before">До</span>
                    <span className="gc-compare__label gc-compare__label--after">После</span>
                  </>
                )}
              </div>

              <div className="d-flex align-items-start justify-content-between gap-2">
                <div>
                  <div className="fw-semibold">{r.title}</div>
                  <div className="gc-muted">#{r.id}</div>
                </div>
                <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
              </div>

              <div className="gc-muted mt-2">
                Завершена: {r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"}
              </div>
            </div>
          );
        })}

        {!items.length && (
          <div className="text-muted">Пока нет завершенных заявок</div>
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} total={items.length} onPageChange={setPage} />

    </div>
  );
}
