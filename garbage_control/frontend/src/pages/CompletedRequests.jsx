import { useEffect, useMemo, useState } from "react";
import { getCompletedRequests } from "../api/requests";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";
import CompletedHeader from "../components/completed/CompletedHeader";
import CompletedRequestCard from "../components/completed/CompletedRequestCard";
import RequestFiltersPanel from "../components/requests/RequestFiltersPanel";
import useDebouncedValue from "../hooks/useDebouncedValue";
import {
  COMPLETED_SORT_OPTIONS,
  buildRequestQuery,
  createRequestFilters,
} from "../utils/requestFilters";

const PAGE_SIZE = 6;

export default function CompletedRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState({});
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
      const data = await getCompletedRequests(buildRequestQuery(nextFilters));
      setItems(data || []);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
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

  const updatePosition = (id, value) => {
    setPositions((prev) => ({ ...prev, [id]: value }));
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters(createRequestFilters({ ordering: "updated_at_desc" }));
    setPage(1);
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <CompletedHeader total={items.length} loading={loading} onRefresh={load} />

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        loading={loading}
        showStatus={false}
        showHandlingMode={false}
        showCreatedRange={false}
        showUpdatedRange
        updatedLabel="Дата завершения"
        sortOptions={COMPLETED_SORT_OPTIONS}
        searchPlaceholder="Поиск по id, названию, адресу или городу"
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="gc-completed-grid">
        {pagedItems.map((item) => (
          <CompletedRequestCard
            key={item.id}
            item={item}
            position={positions[item.id] ?? 50}
            onPositionChange={(value) => updatePosition(item.id, value)}
          />
        ))}
        {!items.length && <div className="text-muted">Пока нет завершенных заявок</div>}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}
