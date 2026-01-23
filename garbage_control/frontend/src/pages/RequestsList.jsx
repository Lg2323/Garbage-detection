import { useEffect, useState } from "react";
import { getRequests } from "../api/requests";

const StatusBadge = ({ s }) => (
  <span className={`gc-status gc-status--${s}`}>{s}</span>
);

export default function RequestsList() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getRequests()
      .then((res) => setItems(res.data ?? res))
      .catch((e) => setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message)));
  }, []);

  return (
    <div className="gc-card gc-card--soft p-4">
      <div className="d-flex align-items-end justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Заявки</h4>
          <div className="gc-muted">Список обращений и их статусы</div>
        </div>
        <div className="gc-pill">Всего: {items.length}</div>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="gc-muted">
              <th style={{width:90}}>#</th>
              <th>Описание</th>
              <th style={{width:160}}>Статус</th>
              <th style={{width:220}}>Создана</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>{r.title}</td>
                <td><StatusBadge s={r.status} /></td>
                <td className="gc-muted">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
