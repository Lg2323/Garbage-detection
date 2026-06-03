import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Notice from "../../components/Notice";
import RouteMap from "../../components/maps/RouteMap";
import { getRequestReferenceOptions } from "../../api/requests";
import { assignRoute, cancelRoute, completeRoute, getRoute, rebuildRoadRoute, startRoute } from "../../api/routes";
import { statusClass, statusLabel } from "../../ui/status";
import { formatApiError } from "../../utils/apiErrors";

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function buildAssignForm(route) {
  return {
    brigade: route?.brigade ?? "",
    assigned_worker: route?.assigned_worker ?? "",
    comment: route?.comment ?? "",
  };
}

function getBasePath(role) {
  if (role === "DEPARTMENT_MANAGER") return "/department/routes";
  if (role === "WORKER") return "/worker/routes";
  return "/org/routes";
}

export default function RouteDetailPage({ role }) {
  const { id } = useParams();
  const location = useLocation();
  const isManager = role === "ORG_MANAGER" || role === "DEPARTMENT_MANAGER" || role === "ADMIN";
  const isWorker = role === "WORKER";
  const basePath = getBasePath(role);
  const [route, setRoute] = useState(null);
  const [referenceOptions, setReferenceOptions] = useState(null);
  const [form, setForm] = useState(buildAssignForm(null));
  const [msg, setMsg] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  const load = async ({ keepNotice = false } = {}) => {
    if (!keepNotice) {
      setMsg(null);
    }
    const routeData = await getRoute(id);
    setRoute(routeData);
    setForm(buildAssignForm(routeData));
  };

  useEffect(() => {
    const initialNotice = location.state?.notice;
    load({ keepNotice: Boolean(initialNotice) })
      .then(() => {
        if (initialNotice) {
          setMsg(initialNotice);
        }
      })
      .catch((error) => {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки маршрута."),
      });
    });
  }, [id, location.state]);

  useEffect(() => {
    if (!isManager) {
      return;
    }

    getRequestReferenceOptions()
      .then((data) => setReferenceOptions(data))
      .catch((error) => {
        setMsg({
          type: "danger",
          text: formatApiError(error, "Ошибка загрузки справочников для назначения маршрута."),
        });
      });
  }, [isManager]);

  const availableBrigades = useMemo(() => {
    const source = referenceOptions?.brigades || [];
    if (!route) return source;
    if (route.department) {
      return source.filter((brigade) => brigade.department_id === route.department);
    }
    return source.filter((brigade) => !brigade.department_id);
  }, [referenceOptions, route]);

  const availableWorkers = useMemo(() => {
    const source = referenceOptions?.workers || [];
    if (!route) return source;
    if (route.department) {
      return source.filter((worker) => worker.department_id === route.department);
    }
    return source.filter((worker) => !worker.department_id);
  }, [referenceOptions, route]);

  const canAssign = isManager && route && route.status !== "COMPLETED" && route.status !== "CANCELLED";
  const canStart =
    route &&
    (isManager || isWorker) &&
    route.status !== "IN_PROGRESS" &&
    route.status !== "COMPLETED" &&
    route.status !== "CANCELLED" &&
    (route.brigade || route.assigned_worker);
  const canComplete =
    route && (isManager || isWorker) && route.status !== "COMPLETED" && route.status !== "CANCELLED";
  const canCancel = isManager && route && route.status !== "COMPLETED" && route.status !== "CANCELLED";

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const runAction = async (actionName, handler, successText) => {
    setBusyAction(actionName);
    setMsg(null);
    try {
      await handler();
      await load();
      setMsg({ type: "success", text: successText });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка обновления маршрута."),
      });
    } finally {
      setBusyAction("");
    }
  };

  const submitAssign = async () => {
    await runAction(
      "assign",
      () =>
        assignRoute(id, {
          brigade: toNumberOrNull(form.brigade),
          assigned_worker: toNumberOrNull(form.assigned_worker),
          comment: form.comment.trim(),
        }),
      "Назначение маршрута обновлено."
    );
  };

  if (!route) {
    return <div className="card p-3">Загрузка...</div>;
  }

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <div className="text-muted small mb-1">
              <Link to={basePath} className="text-decoration-none">
                К списку маршрутов
              </Link>
            </div>
            <h4 className="mb-0">{route.name}</h4>
            <div className="text-muted">
              {route.department_name || route.organization_name || "-"}
            </div>
          </div>
          <span className={statusClass(route.status)}>{statusLabel(route.status)}</span>
        </div>
        <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />
      </div>

      <div className="row g-3">
        <div className="col-xl-5">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Сводка маршрута</div>
            <div className="d-grid gap-1">
              <div>
                <b>Организация:</b> {route.organization_name || "-"}
              </div>
              <div>
                <b>Подразделение:</b> {route.department_name || "-"}
              </div>
              <div>
                <b>Бригада:</b> {route.brigade_name || "-"}
              </div>
              <div>
                <b>Исполнитель:</b> {route.assigned_worker_username || "-"}
              </div>
              <div>
                <b>Создал:</b> {route.created_by_username || "-"}
              </div>
              <div>
                <b>Точек:</b> {route.points_count}
              </div>
              <div>
                <b>Расстояние:</b> {route.distance_km != null ? `${route.distance_km} км` : "-"}
              </div>
              <div>
                <b>Время:</b> {route.duration_minutes != null ? `${route.duration_minutes} мин` : "-"}
              </div>
              <div>
                <b>Создан:</b> {route.created_at ? new Date(route.created_at).toLocaleString() : "-"}
              </div>
              <div>
                <b>Обновлен:</b> {route.updated_at ? new Date(route.updated_at).toLocaleString() : "-"}
              </div>
              <div>
                <b>Комментарий:</b> {route.comment || "-"}
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-3">
              {canStart && (
                <button
                  className="btn btn-primary"
                  onClick={() => runAction("start", () => startRoute(id), "Маршрут переведен в работу.")}
                  disabled={busyAction === "start"}
                  type="button"
                >
                  {busyAction === "start" ? "..." : "Начать"}
                </button>
              )}
              {canComplete && (
                <button
                  className="btn btn-success"
                  onClick={() => runAction("complete", () => completeRoute(id), "Маршрут завершен.")}
                  disabled={busyAction === "complete"}
                  type="button"
                >
                  {busyAction === "complete" ? "..." : "Завершить"}
                </button>
              )}
              {canCancel && (
                <button
                  className="btn btn-outline-danger"
                  onClick={() => runAction("cancel", () => cancelRoute(id), "Маршрут отменен.")}
                  disabled={busyAction === "cancel"}
                  type="button"
                >
                  {busyAction === "cancel" ? "..." : "Отменить"}
                </button>
              )}
              {isManager && (
                <button
                  className="btn btn-outline-primary"
                  onClick={() => runAction("rebuild", () => rebuildRoadRoute(id), "Дорожный маршрут перестроен.")}
                  disabled={busyAction === "rebuild"}
                  type="button"
                >
                  {busyAction === "rebuild" ? "..." : "Перестроить маршрут по дорогам"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-3">Маршрут на карте</div>
            <RouteMap points={route.points || []} routeGeometry={route.route_geometry} />
          </div>
        </div>
      </div>

      {canAssign && (
        <div className="card p-3">
          <div className="fw-semibold mb-3">Назначение маршрута</div>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Бригада</label>
              <select
                className="form-select"
                value={form.brigade}
                onChange={(event) => updateField("brigade", event.target.value)}
              >
                <option value="">Не назначать</option>
                {availableBrigades.map((brigade) => (
                  <option key={brigade.id} value={brigade.id}>
                    {brigade.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Исполнитель</label>
              <select
                className="form-select"
                value={form.assigned_worker}
                onChange={(event) => updateField("assigned_worker", event.target.value)}
              >
                <option value="">Не назначать</option>
                {availableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    #{worker.id} {worker.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Комментарий</label>
              <input
                className="form-control"
                value={form.comment}
                onChange={(event) => updateField("comment", event.target.value)}
                placeholder="Комментарий к маршруту"
              />
            </div>
          </div>
          <div className="d-flex justify-content-end mt-3">
            <button
              className="btn btn-primary"
              onClick={submitAssign}
              disabled={busyAction === "assign"}
              type="button"
            >
              {busyAction === "assign" ? "..." : "Назначить"}
            </button>
          </div>
        </div>
      )}

      <div className="card p-3">
        <div className="fw-semibold mb-3">Порядок точек</div>
        {(route.points || []).length ? (
          <div className="gc-route-point-list">
            {route.points.map((point) => (
              <div key={point.id} className="gc-route-point-list__item">
                <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                  <div>
                    <div className="fw-semibold">
                      {point.order_number}. Заявка #{point.request}
                    </div>
                    <div>{point.request_title}</div>
                    <div className="text-muted small">{point.address || "Адрес не указан"}</div>
                  </div>
                  <span className={statusClass(point.request_status)}>{statusLabel(point.request_status)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted">Точки маршрута отсутствуют.</div>
        )}
      </div>
    </div>
  );
}
