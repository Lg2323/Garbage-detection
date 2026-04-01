import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { adminStats } from "../../api/admin";
import { statusLabel } from "../../ui/status";

const ROLE_LABELS = {
  CITIZEN: "Граждане",
  WORKER: "Исполнители",
  COORDINATOR: "Координаторы",
  ORG_MANAGER: "Руководители",
  ADMIN: "Администраторы",
};

function StatCard({ title, value, subtitle }) {
  return (
    <div className="gc-stat-card">
      <div className="text-muted">{title}</div>
      <div className="gc-stat-value">{value}</div>
      {subtitle && <div className="small text-muted">{subtitle}</div>}
    </div>
  );
}

function formatHours(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value} ч`;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriod(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
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
  const efficiency = stats?.request_efficiency || {};
  const workerSummary = stats?.worker_load_summary || {};
  const organizationBacklog = stats?.organization_backlog || [];
  const timeline = (stats?.request_timeline || []).slice(-6);

  const visibleWorkerLoad = useMemo(
    () =>
      (stats?.worker_load || [])
        .filter(
          (item) =>
            item.active_requests ||
            item.waiting_for_start ||
            item.in_progress_requests ||
            item.on_check_requests ||
            item.completed_requests
        )
        .slice(0, 8),
    [stats]
  );

  const busiestWorker = visibleWorkerLoad[0] || null;
  const maxBacklog = organizationBacklog[0]?.active_requests || 0;

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h4 className="mb-1">Админ-панель</h4>
            <div className="text-muted">
              Центр управления пользователями, заявками, зонами ответственности и аналитикой по нагрузке системы.
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
        <StatCard title="Зоны ответственности" value={referenceTotals.responsibility_zones ?? "—"} subtitle="Геометрия маршрутизации" />
      </div>

      <div className="gc-stats-grid">
        <StatCard title="Активные заявки" value={efficiency.active_requests ?? "—"} subtitle="В работе, на проверке и ожидающие назначения" />
        <StatCard title="Нераспределённые" value={efficiency.unassigned_requests ?? "—"} subtitle="Текущий backlog без исполнителя" />
        <StatCard title="На проверке" value={efficiency.on_check_requests ?? "—"} subtitle="Ожидают финальной верификации" />
        <StatCard title="Среднее время закрытия" value={formatHours(efficiency.avg_completion_hours)} subtitle="Средняя длительность по завершённым заявкам" />
      </div>

      <div className="row g-3">
        <div className="col-xl-4">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-3">Эффективность системы</div>
            <div className="d-grid gap-2">
              <div className="gc-info-block">
                <div className="small text-muted">Доля завершённых заявок</div>
                <div className="fw-semibold">{efficiency.completion_rate ?? 0}%</div>
              </div>
              <div className="gc-info-block">
                <div className="small text-muted">Доля внешних передач</div>
                <div className="fw-semibold">{efficiency.transfer_rate ?? 0}%</div>
              </div>
              <div className="gc-info-block">
                <div className="small text-muted">Ожидают старта работ</div>
                <div className="fw-semibold">{efficiency.waiting_for_start ?? 0}</div>
              </div>
              <div className="gc-info-block">
                <div className="small text-muted">С доработкой</div>
                <div className="fw-semibold">{efficiency.rework_requests ?? 0}</div>
              </div>
              <div className="gc-info-block">
                <div className="small text-muted">Исполнители с активной нагрузкой</div>
                <div className="fw-semibold">
                  {workerSummary.active_workers ?? 0}
                  <span className="text-muted"> / {roleMap.get("WORKER") ?? 0}</span>
                </div>
              </div>
              <div className="gc-info-block">
                <div className="small text-muted">Самая высокая текущая нагрузка</div>
                <div className="fw-semibold">
                  {busiestWorker ? `${busiestWorker.username}: ${busiestWorker.active_requests}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-2">
              <div>
                <div className="fw-semibold">Нагрузка исполнителей</div>
                <div className="text-muted small">
                  Текущие активные заявки, проверка качества и средняя длительность уже закрытых задач.
                </div>
              </div>
              <span className="badge text-bg-light">
                На проверке у исполнителей: {workerSummary.workers_with_on_check ?? 0}
              </span>
            </div>

            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Исполнитель</th>
                    <th style={{ width: 90 }}>Активно</th>
                    <th style={{ width: 90 }}>Старт</th>
                    <th style={{ width: 90 }}>В работе</th>
                    <th style={{ width: 90 }}>Проверка</th>
                    <th style={{ width: 110 }}>Завершено</th>
                    <th style={{ width: 120 }}>Среднее</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkerLoad.map((worker) => (
                    <tr key={worker.id}>
                      <td>
                        <div className="fw-semibold">{worker.username}</div>
                        <div className="text-muted small">
                          {worker.organization_name || "Без организации"}
                          {worker.department_name ? ` • ${worker.department_name}` : ""}
                        </div>
                        <div className="text-muted small">Последнее завершение: {formatDateTime(worker.last_completed_at)}</div>
                      </td>
                      <td>{worker.active_requests}</td>
                      <td>{worker.waiting_for_start}</td>
                      <td>{worker.in_progress_requests}</td>
                      <td>{worker.on_check_requests}</td>
                      <td>{worker.completed_requests}</td>
                      <td>{formatHours(worker.avg_completion_hours)}</td>
                    </tr>
                  ))}
                  {!visibleWorkerLoad.length && (
                    <tr>
                      <td colSpan={7} className="text-muted">
                        Пока нет данных по нагрузке исполнителей.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
              {["CITIZEN", "WORKER", "COORDINATOR", "ORG_MANAGER", "ADMIN"].map((role) => (
                <span key={role} className="badge text-bg-secondary">
                  {ROLE_LABELS[role] || role}: {roleMap.get(role) ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Организации с текущим backlog</div>
            <div className="text-muted small mb-3">
              Где сейчас сосредоточено наибольшее число незавершённых заявок.
            </div>
            <div className="d-grid gap-2">
              {organizationBacklog.map((item) => (
                <div key={item.organization_id} className="gc-info-block">
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div className="fw-semibold">{item.organization_name || "Без организации"}</div>
                    <div>{item.active_requests}</div>
                  </div>
                  <div className="gc-progress mt-2">
                    <div
                      className="gc-progress__bar"
                      style={{ width: `${maxBacklog ? (item.active_requests / maxBacklog) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {!organizationBacklog.length && (
                <div className="text-muted">Нет активных заявок с назначенной организацией.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Динамика обращений</div>
            <div className="text-muted small mb-3">
              Последние месяцы по количеству созданных заявок.
            </div>
            <div className="d-grid gap-2">
              {timeline.map((item) => (
                <div key={item.period} className="gc-info-block">
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div className="fw-semibold text-capitalize">{formatPeriod(item.period)}</div>
                    <div>{item.count}</div>
                  </div>
                </div>
              ))}
              {!timeline.length && <div className="text-muted">Недостаточно данных для динамики.</div>}
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
                <div className="text-muted">Геометрия зон и маршрутизация</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
