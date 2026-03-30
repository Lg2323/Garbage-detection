import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../../components/Notice";
import Pagination from "../../components/Pagination";
import RequestFiltersPanel from "../../components/requests/RequestFiltersPanel";
import { getAllRequests } from "../../api/coord";
import { statusClass, statusLabel } from "../../ui/status";
import { buildRequestQuery, createRequestFilters } from "../../utils/requestFilters";

const PAGE_SIZE = 10;

export default function CoordRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() =>
    createRequestFilters({
      ordering: "created_at_desc",
    })
  );

  const load = async (nextFilters = filters) => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getAllRequests(buildRequestQuery(nextFilters));
      setItems(data);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
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
    await load(filters);
  };

  const resetFilters = async () => {
    const nextFilters = createRequestFilters({
      ordering: "created_at_desc",
    });
    setFilters(nextFilters);
    setPage(1);
    await load(nextFilters);
  };

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Координатор - заявки</h4>
          <div className="text-muted">Список заявок и быстрый доступ к деталям</div>
        </div>
        <span className="badge text-bg-light">Всего: {items.length}</span>
      </div>

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={loading}
        showHandlingMode
        searchPlaceholder="Поиск по id, названию, адресу, городу или исполнителю"
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Описание</th>
              <th style={{ width: 160 }}>Город</th>
              <th style={{ width: 220 }}>Статус</th>
              <th style={{ width: 220 }}>Создана</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>
                  <div className="fw-semibold">{r.title}</div>
                  {r.address && <div className="text-muted small">{r.address}</div>}
                </td>
                <td>{r.city || "-"}</td>
                <td>
                  <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                </td>
                <td className="text-muted">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                </td>
                <td>
                  <Link to={`/coord/requests/${r.id}`} className="btn btn-sm btn-outline-primary">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {!pagedItems.length && (
              <tr>
                <td colSpan={6} className="text-muted">Ничего не найдено</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}
