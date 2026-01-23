import { useEffect, useMemo, useState } from "react";
import { getAllRequests } from "../../api/coord";
import { Link } from "react-router-dom";

const STATUS = ["", "CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED"];

export default function RequestDetail() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await getAllRequests({ status: status || undefined, q: q || undefined });
      setItems(data);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); 

  const onApply = () => load();

  return (
    <div>
      <h3>Координатор — заявки</h3>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS.map((s) => (
            <option key={s} value={s}>{s ? s : "Все статусы"}</option>
          ))}
        </select>

        <input
          placeholder="Поиск по описанию"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />

        <button onClick={onApply} disabled={loading}>
          {loading ? "..." : "Применить"}
        </button>
      </div>

      {msg && <div style={{ marginBottom: 10 }}>{msg}</div>}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 160px 160px", padding: 12, fontWeight: 700, background: "#fafafa" }}>
          <div>ID</div><div>Описание</div><div>Статус</div><div></div>
        </div>

        {items.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 160px 160px", padding: 12, borderTop: "1px solid #eee" }}>
            <div>#{r.id}</div>
            <div>{r.title}</div>
            <div>{r.status}</div>
            <div>
              <Link to={`/coord/requests/${r.id}`}>Открыть</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
3