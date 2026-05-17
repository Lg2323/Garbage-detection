import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export default function AppLayout({ authed, role, username, onLogout, pageKey, children }) {
  const isCoordinator = role === "COORDINATOR";
  const isAdmin = role === "ADMIN";
  const isWorker = role === "WORKER";
  const isOrgManager = role === "ORG_MANAGER";
  const isDepartmentManager = role === "DEPARTMENT_MANAGER";

  return (
    <>
      <nav className="navbar sticky-top gc-nav">
        <div className="container gc-container gc-nav-inner">
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
            <img className="gc-logo" src={logo} alt="" aria-hidden="true" />
            <span className="gc-brand">Чистый Город</span>
          </Link>

          <div className="gc-nav-links">
            <Link className="gc-nav-link" to="/">
              Главная
            </Link>

            <div className="gc-menu">
              <button className="gc-nav-link gc-menu__toggle" type="button">
                Меню ▾
              </button>
              <div className="gc-menu__panel">
                {!authed && (
                  <>
                    <Link className="gc-menu__item" to="/login">
                      Вход
                    </Link>
                    <Link className="gc-menu__item" to="/register">
                      Регистрация
                    </Link>
                    <Link className="gc-menu__item" to="/faq">
                      Инструкции
                    </Link>
                  </>
                )}

                {authed && (
                  <>
                    <div className="gc-menu__caption">{username ? `Пользователь: ${username}` : "Аккаунт"}</div>
                    <Link className="gc-menu__item" to="/profile">
                      Профиль
                    </Link>
                    <Link className="gc-menu__item" to="/faq">
                      Инструкции
                    </Link>
                    <Link className="gc-menu__item" to="/stats">
                      Статистика города
                    </Link>
                    <Link className="gc-menu__item" to="/requests">
                      Заявки
                    </Link>
                    <Link className="gc-menu__item" to="/works">
                      Выполненные работы
                    </Link>

                    {role === "CITIZEN" && (
                      <Link className="gc-menu__item gc-menu__item--accent" to="/requests/new">
                        Создать заявку
                      </Link>
                    )}

                    {isCoordinator && (
                      <>
                        <Link className="gc-menu__item" to="/coord/requests">
                          Панель координатора
                        </Link>
                        <Link className="gc-menu__item" to="/coord/map">
                          Карта заявок
                        </Link>
                      </>
                    )}

                    {isWorker && (
                      <>
                        <Link className="gc-menu__item" to="/worker/requests">
                          Панель исполнителя
                        </Link>
                        <Link className="gc-menu__item" to="/worker/routes">
                          Мои маршруты
                        </Link>
                      </>
                    )}

                    {isOrgManager && (
                      <>
                        <Link className="gc-menu__item" to="/org/requests">
                          Панель организации
                        </Link>
                        <Link className="gc-menu__item" to="/org/routes">
                          Маршруты
                        </Link>
                      </>
                    )}

                    {isDepartmentManager && (
                      <>
                        <Link className="gc-menu__item" to="/department/requests">
                          Панель подразделения
                        </Link>
                        <Link className="gc-menu__item" to="/department/routes">
                          Маршруты
                        </Link>
                      </>
                    )}

                    {isAdmin && (
                      <Link className="gc-menu__item" to="/admin">
                        Админ-панель
                      </Link>
                    )}

                    <button className="gc-menu__item gc-menu__item--ghost" onClick={onLogout} type="button">
                      Выйти
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main key={pageKey} className="container gc-container py-4 gc-page">
        {children}
      </main>
    </>
  );
}
