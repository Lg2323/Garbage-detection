import { Link } from "react-router-dom";

function getHomeRoute(role) {
  if (role === "COORDINATOR" || role === "ADMIN") return "/coord/requests";
  if (role === "WORKER") return "/worker/requests";
  if (role === "ORG_MANAGER") return "/org/requests";
  return "/requests";
}

export default function AccessDenied({ role = null }) {
  const homeRoute = getHomeRoute(role);

  return (
    <div className="gc-not-found gc-anim gc-anim--up">
      <div className="gc-not-found__code gc-not-found__code--warning">403</div>
      <h1 className="gc-not-found__title">Доступ запрещён</h1>
      <p className="gc-not-found__text">
        Эта страница существует, но у вашей роли нет прав для её просмотра.
      </p>

      <div className="gc-not-found__actions">
        <Link className="btn btn-primary" to={homeRoute}>
          Перейти в доступный раздел
        </Link>
        <Link className="btn btn-outline-primary" to="/profile">
          Открыть профиль
        </Link>
      </div>
    </div>
  );
}
