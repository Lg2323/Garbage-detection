import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../../components/Notice";
import Pagination from "../../components/Pagination";
import RequestFiltersPanel from "../../components/requests/RequestFiltersPanel";
import { assignWorker, listRequests, listWorkers, setRequestStatus } from "../../api/admin";
import { handlingModeLabel, statusLabel } from "../../ui/status";
import { buildRequestQuery, createRequestFilters } from "../../utils/requestFilters";

const STATUSES = ["CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED", "TRANSFERRED"];
const PAGE_SIZE = 12;

export default function AdminRequests() {
  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() =>
    createRequestFilters({
      ordering: "created_at_desc",
    })
  );

  const loadRequests = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const data = await listRequests(buildRequestQuery(nextFilters));
      setItems(data);
      setMsg("");
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await listWorkers();
      setWorkers(data);
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    }
  };

  useEffect(() => {
    loadWorkers();
    loadRequests(filters);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = async () => {
    setPage(1);
    await loadRequests(filters);
  };

  const resetFilters = async () => {
    const nextFilters = createRequestFilters({
      ordering: "created_at_desc",
    });
    setFilters(nextFilters);
    setPage(1);
    await loadRequests(nextFilters);
  };

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getDraft = (request) => ({
    assigned_worker: request.assigned_worker || "",
    status: request.status,
    ...(drafts[request.id] || {}),
  });

  const doAssign = async (request) => {
    const draft = getDraft(request);
    if (!draft.assigned_worker) return;
    setBusy(true);
    try {
      await assignWorker(request.id, draft.assigned_worker);
      await loadRequests(filters);
      setMsg("");
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setBusy(false);
    }
  };

  const doSetStatus = async (request) => {
    const draft = getDraft(request);
    setBusy(true);
    try {
      await setRequestStatus(request.id, draft.status);
      await loadRequests(filters);
      setMsg("");
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setBusy(false);
    }
  };

  const workerFilterField = (
    <div className="col-xl-3 col-md-6">
      <label className="gc-filter-panel__label">Исполнитель</label>
      <select className="form-select" value={filters.assigned_worker} onChange={(event) => updateFilter("assigned_worker", event.target.value)}>
        <option value="">Все исполнители</option>
        <option value="unassigned">Не назначен</option>
        {workers.map((worker) => (
          <option key={worker.id} value={String(worker.id)}>
            #{worker.id} {worker.username}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-0">Заявки</h4>
          <div className="text-muted">Полный список обращений с быстрыми админскими действиями.</div>
        </div>
        <span className="badge text-bg-light">Всего: {items.length}</span>
      </div>

      <div className="gc-admin-inline-hint mb-3" data-hint="Статус и исполнитель меняются прямо в таблице ниже.">
        <i className="bi bi-sliders" aria-hidden="true" />
        Статус и исполнитель меняются прямо в таблице ниже.
      </div>

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={loading}
        showHandlingMode
        extraFields={workerFilterField}
        searchPlaceholder="Поиск по id, названию, адресу, городу или организации"
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="table-responsive">
        <table className="table align-middle gc-admin-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Описание</th>
              <th style={{ width: 160 }}>Статус</th>
              <th style={{ width: 170 }}>Режим</th>
              <th style={{ width: 220 }}>Организация</th>
              <th style={{ width: 220 }}>Назначить</th>
              <th style={{ width: 160 }}>Действия</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((request) => {
              const draft = getDraft(request);
              return (
                <tr key={request.id}>
                  <td className="fw-semibold">#{request.id}</td>
                  <td>
                    <div className="fw-semibold">{request.title}</div>
                    {request.address && <div className="text-muted small">{request.address}</div>}
                    <div className="text-muted small">{request.city || "-"}</div>
                  </td>
                  <td>
                    <select className="form-select gc-admin-inline-select" value={draft.status} onChange={(event) => setDraft(request.id, { status: event.target.value })}>
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{handlingModeLabel(request.handling_mode)}</td>
                  <td>
                    <div>{request.responsible_organization_name || "-"}</div>
                    {request.responsible_department_name && (
                      <div className="text-muted small">{request.responsible_department_name}</div>
                    )}
                  </td>
                  <td>
                    <select
                      className="form-select gc-admin-inline-select"
                      value={draft.assigned_worker}
                      onChange={(event) => setDraft(request.id, { assigned_worker: Number(event.target.value) || "" })}
                    >
                      <option value="">Не назначен</option>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          #{worker.id} {worker.username}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="d-flex gap-2 gc-admin-inline-actions">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => doAssign(request)} disabled={busy || loading}>
                        Назначить
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => doSetStatus(request)} disabled={busy || loading}>
                        Статус
                      </button>
                    </div>
                  </td>
                  <td>
                    <Link to={`/coord/requests/${request.id}`} className="btn btn-sm btn-outline-dark">
                      Детали
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!pagedItems.length && (
              <tr>
                <td colSpan={8} className="text-muted">Ничего не найдено.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}
