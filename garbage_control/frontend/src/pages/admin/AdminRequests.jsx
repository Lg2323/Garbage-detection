import { useEffect, useMemo, useState } from "react";
import { assignWorker, listRequests, listWorkers, setRequestStatus } from "../../api/admin";
import { statusLabel } from "../../ui/status";
import Notice from "../../components/Notice";

const STATUSES = ["CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED"];

export default function AdminRequests() {
  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});

  const loadRequests = async () => {
    try {
      const data = await listRequests(statusFilter ? { status: statusFilter } : {});
      setItems(data);
      setMsg("");
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await listWorkers();
      setWorkers(data);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => (x.title || "").toLowerCase().includes(s) || String(x.id).includes(s));
  }, [items, q]);

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getDraft = (r) => ({
    assigned_worker: r.assigned_worker || "",
    status: r.status,
    ...(drafts[r.id] || {}),
  });

  const doAssign = async (r) => {
    const d = getDraft(r);
    if (!d.assigned_worker) return;
    setBusy(true);
    try {
      await assignWorker(r.id, d.assigned_worker);
      await loadRequests();
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setBusy(false);
    }
  };

  const doSetStatus = async (r) => {
    const d = getDraft(r);
    setBusy(true);
    try {
      await setRequestStatus(r.id, d.status);
      await loadRequests();
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Заявки</h4>
          <div className="text-muted">Админ-вид (все заявки)</div>
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
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-outline-secondary w-100" onClick={loadRequests} disabled={busy}>
            Обновить
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
              <th style={{ width: 150 }}>Статус</th>
              <th style={{ width: 220 }}>Назначить</th>
              <th style={{ width: 160 }}>Действия</th>
              <th style={{ width: 220 }}>Создана</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const d = getDraft(r);
              return (
                <tr key={r.id}>
                  <td className="fw-semibold">#{r.id}</td>
                  <td>{r.title}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={d.status}
                      onChange={(e) => setDraft(r.id, { status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={d.assigned_worker}
                      onChange={(e) => setDraft(r.id, { assigned_worker: Number(e.target.value) || "" })}
                    >
                      <option value="">— Не назначен —</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          #{w.id} {w.username}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm" onClick={() => doAssign(r)} disabled={busy}>
                      Назначить
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => doSetStatus(r)} disabled={busy}>
                      Статус
                    </button>
                  </td>
                  <td className="text-muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="text-muted">Ничего не найдено</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
