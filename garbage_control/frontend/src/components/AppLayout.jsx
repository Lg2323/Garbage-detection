import { Link } from "react-router-dom";

export default function AppLayout({ authed, role, onLogout, children }) {
  const isCoord = role === "COORDINATOR" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top gc-nav">
        <div className="container gc-container">
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
            <i className="bi bi-recycle" style={{ color: "var(--primary)" }} />
            <span className="gc-brand">Garbage Control</span>
            <span className="gc-pill">SaaS demo</span>
          </Link>

          <div className="ms-auto d-flex align-items-center gap-2">
            {!authed && (
              <>
                <Link className="btn btn-light" to="/login">Вход</Link>
                <Link className="btn btn-primary" to="/register">Регистрация</Link>
              </>
            )}

            {authed && (
              <>
                <Link className="btn btn-light" to="/requests">Заявки</Link>

                {/* создавать заявку может только гражданин */}
                {role === "CITIZEN" && (
                  <Link className="btn btn-primary" to="/requests/new">Создать</Link>
                )}

                {/* координатор */}
                {isCoord && (
                  <Link className="btn btn-outline-primary" to="/coord/requests">Панель координатора</Link>
                )}

                {/* админ */}
                {isAdmin && (
                  <Link className="btn btn-outline-dark" to="/admin">Админ-панель</Link>
                )}

                <button className="btn btn-outline-secondary" onClick={onLogout}>
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container gc-container py-4">{children}</main>
    </>
  );
}
