import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../../components/Notice";
import Pagination from "../../components/Pagination";
import RequestFiltersPanel from "../../components/requests/RequestFiltersPanel";
import { getRequests } from "../../api/requests";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { statusClass, statusLabel } from "../../ui/status";
import { buildRequestQuery, createRequestFilters } from "../../utils/requestFilters";

const PAGE_SIZE = 10;

export default function OrganizationRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() =>
    createRequestFilters({
      ordering: "updated_at_desc",
    })
  );
  const debouncedFilters = useDebouncedValue(filters);

  const load = async (nextFilters = filters) => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getRequests(buildRequestQuery(nextFilters));
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
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
    setFilters(createRequestFilters({ ordering: "updated_at_desc" }));
    setPage(1);
  };

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-0">Организация - заявки</h4>
          <div className="text-muted">Заявки, уже направленные в ответственную организацию для распределения.</div>
        </div>
        <span className="badge text-bg-light">Всего: {items.length}</span>
      </div>

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        loading={loading}
        showHandlingMode
        searchPlaceholder="Поиск по id, названию, адресу, бригаде или исполнителю"
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Описание</th>
              <th style={{ width: 180 }}>Подразделение</th>
              <th style={{ width: 180 }}>Бригада</th>
              <th style={{ width: 180 }}>Исполнитель</th>
              <th style={{ width: 220 }}>Статус</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => (
              <tr key={item.id}>
                <td className="fw-semibold">#{item.id}</td>
                <td>
                  <div className="fw-semibold">{item.title}</div>
                  {item.address && <div className="text-muted small">{item.address}</div>}
                </td>
                <td>{item.responsible_department_name || "-"}</td>
                <td>{item.assigned_brigade_name || "-"}</td>
                <td>{item.assigned_worker_username || "-"}</td>
                <td>
                  <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                </td>
                <td>
                  <Link to={`/org/requests/${item.id}`} className="btn btn-sm btn-outline-primary">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {!pagedItems.length && (
              <tr>
                <td colSpan={7} className="text-muted">Ничего не найдено.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}
