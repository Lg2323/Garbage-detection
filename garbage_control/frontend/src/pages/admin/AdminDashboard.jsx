import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { adminStats } from "../../api/admin";
import { statusLabel } from "../../ui/status";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="gc-stat-card">
      <div className="text-muted">{title}</div>
      <div className="gc-stat-value">{value}</div>
      {subtitle && <div className="small text-muted">{subtitle}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminStats()
      .then((data) => setStats(data))
      .catch((error) => setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message)));
  }, []);

  const statusMap = new Map((stats?.requests_by_status || []).map((item) => [item.status, item.count]));
  const roleMap = new Map((stats?.users_by_role || []).map((item) => [item.role, item.count]));
  const referenceTotals = stats?.reference_totals || {};

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h4 className="mb-1">Админ-панель</h4>
            <div className="text-muted">
              Центр управления пользователями, заявками и маршрутизацией по территориям.
            </div>
          </div>
          <i className="bi bi-shield-lock fs-2" />
        </div>
      </div>

      {msg && <div className="alert alert-danger mb-0">{msg}</div>}

      <div className="gc-stats-grid">
        <StatCard title="Всего заявок" value={stats?.requests_total ?? "—"} subtitle="Все обращения в системе" />
        <StatCard title="Пользователи" value={stats?.users_total ?? "—"} subtitle="Аккаунты всех ролей" />
        <StatCard title="Организации" value={referenceTotals.organizations ?? "—"} subtitle="Ответственные и внешние адресаты" />
        <StatCard title="Зоны ответственности" value={referenceTotals.responsibility_zones ?? "—"} subtitle="Полигоны привязки служб" />
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Статусы заявок</div>
            <div className="d-flex flex-wrap gap-2">
              {["CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED", "TRANSFERRED"].map((status) => (
                <span key={status} className="badge text-bg-secondary">
                  {statusLabel(status)}: {statusMap.get(status) ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Роли пользователей</div>
            <div className="d-flex flex-wrap gap-2">
              {["CITIZEN", "WORKER", "COORDINATOR", "ADMIN"].map((role) => (
                <span key={role} className="badge text-bg-secondary">
                  {role}: {roleMap.get(role) ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6 col-xl-3">
          <Link to="/admin/users" className="card p-3 text-decoration-none">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-people fs-2" />
              <div>
                <div className="fw-semibold">Пользователи</div>
                <div className="text-muted">CRUD аккаунтов и ролей</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/admin/requests" className="card p-3 text-decoration-none">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-clipboard-check fs-2" />
              <div>
                <div className="fw-semibold">Заявки</div>
                <div className="text-muted">Фильтры, статусы и переход к деталям</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/admin/directories" className="card p-3 text-decoration-none">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-diagram-3 fs-2" />
              <div>
                <div className="fw-semibold">Справочники</div>
                <div className="text-muted">Территории, организации, бригады</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/admin/zones" className="card p-3 text-decoration-none">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-geo-alt fs-2" />
              <div>
                <div className="fw-semibold">Зоны</div>
                <div className="text-muted">Редактирование полигонов и маршрутизации</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
