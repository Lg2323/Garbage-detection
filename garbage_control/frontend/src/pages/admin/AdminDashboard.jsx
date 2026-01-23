import { Link } from "react-router-dom";

export default function AdminDashboard() {
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
