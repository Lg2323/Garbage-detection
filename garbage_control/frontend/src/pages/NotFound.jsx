import { Link } from "react-router-dom";

function getHomeRoute({ authed, role }) {
  if (!authed) return "/login";
  if (role === "COORDINATOR") return "/coord/requests";
  if (role === "ADMIN") return "/admin";
  if (role === "WORKER") return "/worker/requests";
  if (role === "ORG_MANAGER") return "/org/requests";
  if (role === "DEPARTMENT_MANAGER") return "/department/requests";
  return "/requests";
}

export default function NotFound({ authed = false, role = null }) {
  const homeRoute = getHomeRoute({ authed, role });

  return (
    <div className="gc-not-found gc-anim gc-anim--up">
      <div className="gc-not-found__code">404</div>
      <h1 className="gc-not-found__title">Страница не найдена</h1>
      <p className="gc-not-found__text">
        Запрошенный адрес не существует или страница была перемещена.
      </p>

      <div className="gc-not-found__actions">
        <Link className="btn btn-primary" to={homeRoute}>
          Вернуться в систему
        </Link>
        <Link className="btn btn-outline-primary" to="/faq">
          Открыть инструкции
        </Link>
      </div>
    </div>
  );
}
