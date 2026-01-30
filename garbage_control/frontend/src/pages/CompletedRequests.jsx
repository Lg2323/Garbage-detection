import { useEffect, useMemo, useState } from "react";
import { getCompletedRequests } from "../api/requests";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";
import CompletedHeader from "../components/completed/CompletedHeader";
import CompletedRequestCard from "../components/completed/CompletedRequestCard";

const PAGE_SIZE = 6;

export default function CompletedRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState({});
  const [page, setPage] = useState(1);

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

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const updatePosition = (id, value) => {
    setPositions((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <CompletedHeader total={items.length} loading={loading} onRefresh={load} />

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
