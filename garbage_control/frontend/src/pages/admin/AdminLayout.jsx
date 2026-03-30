import { NavLink, Outlet } from "react-router-dom";

const LINKS = [
  { to: "/admin", label: "Дашборд", end: true },
  { to: "/admin/users", label: "Пользователи" },
  { to: "/admin/requests", label: "Заявки" },
  { to: "/admin/directories", label: "Справочники" },
  { to: "/admin/zones", label: "Зоны ответственности" },
];

export default function AdminLayout() {
  return (
    <div className="gc-admin-layout gc-anim gc-anim--up">
      <aside className="gc-admin-layout__sidebar card p-3">
        <div className="mb-3">
          <h4 className="mb-1">Админ-панель</h4>
          <div className="text-muted">Управление заявками, пользователями и справочниками.</div>
        </div>
        <nav className="gc-admin-nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `gc-admin-nav__link ${isActive ? "gc-admin-nav__link--active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="gc-admin-layout__content">
        <Outlet />
      </section>
    </div>
  );
}
