import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { adminStats } from "../../api/admin";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminStats()
      .then((data) => setStats(data))
      .catch((e) => setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message)));
  }, []);

  const statusMap = new Map((stats?.requests_by_status || []).map((x) => [x.status, x.count]));
  const roleMap = new Map((stats?.users_by_role || []).map((x) => [x.role, x.count]));

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="card p-3">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h4 className="mb-1">Админ-панель</h4>
              <div className="text-muted">Управление пользователями и заявками</div>
            </div>
            <i className="bi bi-shield-lock fs-2" />
          </div>
        </div>
      </div>

      {msg && (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{msg}</div>
        </div>
      )}

      <div className="col-md-6">
        <div className="card p-3 h-100">
          <div className="fw-semibold mb-2">Заявки</div>
          <div className="d-flex flex-wrap gap-2">
            <span className="badge text-bg-light">Всего: {stats?.requests_total ?? "—"}</span>
            <span className="badge text-bg-secondary">CREATED: {statusMap.get("CREATED") ?? 0}</span>
            <span className="badge text-bg-secondary">VERIFIED: {statusMap.get("VERIFIED") ?? 0}</span>
            <span className="badge text-bg-secondary">IN_PROGRESS: {statusMap.get("IN_PROGRESS") ?? 0}</span>
            <span className="badge text-bg-secondary">ON_CHECK: {statusMap.get("ON_CHECK") ?? 0}</span>
            <span className="badge text-bg-secondary">COMPLETED: {statusMap.get("COMPLETED") ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card p-3 h-100">
          <div className="fw-semibold mb-2">Пользователи</div>
          <div className="d-flex flex-wrap gap-2">
            <span className="badge text-bg-light">Всего: {stats?.users_total ?? "—"}</span>
            <span className="badge text-bg-secondary">CITIZEN: {roleMap.get("CITIZEN") ?? 0}</span>
            <span className="badge text-bg-secondary">WORKER: {roleMap.get("WORKER") ?? 0}</span>
            <span className="badge text-bg-secondary">COORDINATOR: {roleMap.get("COORDINATOR") ?? 0}</span>
            <span className="badge text-bg-secondary">ADMIN: {roleMap.get("ADMIN") ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <Link to="/admin/users" className="card p-3 text-decoration-none">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-people fs-2" />
            <div>
              <div className="fw-semibold">Пользователи</div>
              <div className="text-muted">Создание исполнителей/координаторов</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="col-md-6">
        <Link to="/admin/requests" className="card p-3 text-decoration-none">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-clipboard-check fs-2" />
            <div>
              <div className="fw-semibold">Заявки</div>
              <div className="text-muted">Поиск/фильтры/массовые действия</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
