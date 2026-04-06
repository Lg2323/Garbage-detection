import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FileDropzone from "../../components/FileDropzone";
import Notice from "../../components/Notice";
import Pagination from "../../components/Pagination";
import RequestFiltersPanel from "../../components/requests/RequestFiltersPanel";
import { getRequests, takeInWork, uploadAfterPhoto } from "../../api/requests";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { statusClass, statusLabel } from "../../ui/status";
import { buildRequestQuery, createRequestFilters } from "../../utils/requestFilters";

const PAGE_SIZE = 8;

export default function WorkerRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusyMap] = useState({});
  const [files, setFiles] = useState({});
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() =>
    createRequestFilters({
      ordering: "created_at_desc",
    })
  );
  const debouncedFilters = useDebouncedValue(filters);

  const load = async (nextFilters = filters) => {
    setMsg(null);
    setLoading(true);
    try {
      const data = await getRequests(buildRequestQuery(nextFilters));
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    load(debouncedFilters);
  }, [debouncedFilters]);

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

  const resetFilters = () => {
    setFilters(createRequestFilters({ ordering: "created_at_desc" }));
    setPage(1);
  };

  const setBusyFor = (id, value) => {
    setBusyMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleTakeInWork = async (id) => {
    setMsg(null);
    setBusyFor(id, true);
    try {
      await takeInWork(id);
      await load(filters);
      setMsg({ type: "success", text: "Заявка взята в работу." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusyFor(id, false);
    }
  };

  const handleUploadAfter = async (id) => {
    const file = files[id];
    if (!file) {
      setMsg({ type: "warning", text: "Выберите фото после уборки." });
      return;
    }

    setMsg(null);
    setBusyFor(id, true);
    try {
      await uploadAfterPhoto(id, file);
      setFiles((prev) => ({ ...prev, [id]: null }));
      await load(filters);
      setMsg({ type: "success", text: "Фото загружено, заявка отправлена на проверку." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusyFor(id, false);
    }
  };

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Исполнитель: мои заявки</h4>
          <div className="text-muted">Откройте карточку заявки, чтобы увидеть адрес, карту, фото до уборки и указания координатора.</div>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => load(filters)} disabled={loading}>
          {loading ? "..." : "Обновить"}
        </button>
      </div>

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        loading={loading}
        showHandlingMode
        searchPlaceholder="Поиск по id, названию, адресу или городу"
      />

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="text-muted">
              <th style={{ width: 90 }}>#</th>
              <th>Описание</th>
              <th style={{ width: 220 }}>Статус</th>
              <th style={{ width: 180 }}>Город</th>
              <th style={{ width: 220 }}>Создана</th>
              <th style={{ width: 420 }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((requestItem) => (
              <tr key={requestItem.id}>
                <td className="fw-semibold">#{requestItem.id}</td>
                <td>
                  <div className="fw-semibold">{requestItem.title}</div>
                  {requestItem.address && <div className="text-muted small">{requestItem.address}</div>}
                  {requestItem.last_rework_comment && (
                    <div className="text-danger" style={{ fontSize: 12 }}>
                      Доработка: {requestItem.last_rework_comment}
                    </div>
                  )}
                </td>
                <td>
                  <span className={statusClass(requestItem.status)}>{statusLabel(requestItem.status)}</span>
                </td>
                <td>{requestItem.city || "-"}</td>
                <td className="text-muted">
                  {requestItem.created_at ? new Date(requestItem.created_at).toLocaleString() : "-"}
                </td>
                <td>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <Link to={`/worker/requests/${requestItem.id}`} className="btn btn-sm btn-outline-primary">
                      Открыть
                    </Link>

                    {requestItem.status === "VERIFIED" && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleTakeInWork(requestItem.id)}
                        disabled={!!busy[requestItem.id]}
                      >
                        {busy[requestItem.id] ? "..." : "Взять в работу"}
                      </button>
                    )}

                    {requestItem.status === "IN_PROGRESS" && (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <FileDropzone
                          label="Фото после"
                          compact
                          file={files[requestItem.id]}
                          onChange={(file) => setFiles((prev) => ({ ...prev, [requestItem.id]: file }))}
                        />
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleUploadAfter(requestItem.id)}
                          disabled={!!busy[requestItem.id]}
                        >
                          {busy[requestItem.id] ? "..." : "Отправить фото"}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!pagedItems.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  Пока нет назначенных заявок.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}
