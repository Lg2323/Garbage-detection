import { Link, Outlet, useNavigate } from "react-router-dom";
import { logoutUser } from "../../api/auth";

export default function AdminLayout() {
  const nav = useNavigate();

  const logout = async () => {
    await logoutUser();
    nav("/login");
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
        <div className="container">
          <Link className="navbar-brand fw-semibold" to="/admin/requests">
            GarbageControl
          </Link>

          <div className="ms-auto d-flex gap-2">
            <Link className="btn btn-outline-primary btn-sm" to="/requests">
              Пользовательская часть
            </Link>
            <button className="btn btn-primary btn-sm" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <main className="container py-4">
        <Outlet />
      </main>
    </>
  );
}
