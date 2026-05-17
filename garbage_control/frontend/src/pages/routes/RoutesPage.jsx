import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../../components/Notice";
import Pagination from "../../components/Pagination";
import RouteMap from "../../components/maps/RouteMap";
import { getRequestReferenceOptions } from "../../api/requests";
import { createRoute, getAvailableRouteRequests, getRoutes } from "../../api/routes";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { statusClass, statusLabel } from "../../ui/status";
import { formatApiError } from "../../utils/apiErrors";

const REQUESTS_PAGE_SIZE = 8;
const ROUTES_PAGE_SIZE = 8;

function createFilters() {
  return {
    search: "",
    city: "",
    status: "",
    department: "",
    brigade: "",
  };
}

function createRouteForm() {
  return {
    name: "",
    brigade: "",
    assigned_worker: "",
    comment: "",
  };
}

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function getBasePath(role) {
  if (role === "DEPARTMENT_MANAGER") return "/department/routes";
  if (role === "WORKER") return "/worker/routes";
  return "/org/routes";
}

function getTitle(role) {
  if (role === "DEPARTMENT_MANAGER") return "Маршруты подразделения";
  if (role === "WORKER") return "Мои маршруты";
  return "Маршруты организации";
}

function getSubtitle(role) {
  if (role === "DEPARTMENT_MANAGER") {
    return "Выберите заявки своего подразделения, постройте порядок объезда и назначьте маршрут бригаде.";
  }
  if (role === "WORKER") {
    return "Здесь отображаются маршруты, назначенные вам или вашей бригаде.";
  }
  return "Соберите заявки своей организации в единый маршрут и сохраните порядок объезда.";
}

function buildPreviewPoints(selectedItems, selectedIds) {
  if (selectedIds.length < 2) {
    return [];
  }

  const itemMap = Object.fromEntries(selectedItems.map((item) => [item.id, item]));
  const firstPoint = itemMap[selectedIds[0]];
  if (!firstPoint) {
    return [];
  }

  const ordered = [firstPoint];
  const remaining = new Map(
    selectedItems.filter((item) => item.id !== firstPoint.id).map((item) => [item.id, item])
  );
  let current = firstPoint;

  while (remaining.size) {
    const nextPoint = [...remaining.values()].reduce((best, candidate) => {
      if (!best) return candidate;
      return distanceKm(current, candidate) <= distanceKm(current, best) ? candidate : best;
    }, null);
    ordered.push(nextPoint);
    remaining.delete(nextPoint.id);
    current = nextPoint;
  }

  return ordered.map((item, index) => ({
    id: `preview-${item.id}`,
    request: item.id,
    request_title: item.title,
    request_status: item.status,
    order_number: index + 1,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
}

function distanceKm(left, right) {
  const lat1 = toRadians(Number(left.latitude));
  const lon1 = toRadians(Number(left.longitude));
  const lat2 = toRadians(Number(right.latitude));
  const lon2 = toRadians(Number(right.longitude));
  const dlon = lon2 - lon1;
  const dlat = lat2 - lat1;
  const haversine =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(haversine));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export default function RoutesPage({ role }) {
  const isManager = role === "ORG_MANAGER" || role === "DEPARTMENT_MANAGER";
  const basePath = getBasePath(role);
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [referenceOptions, setReferenceOptions] = useState(null);
  const [filters, setFilters] = useState(createFilters);
  const [form, setForm] = useState(createRouteForm);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedRequestMap, setSelectedRequestMap] = useState({});
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestsPage, setRequestsPage] = useState(1);
  const [routesPage, setRoutesPage] = useState(1);
  const debouncedFilters = useDebouncedValue(filters);

  const loadRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const data = await getRoutes();
      setRoutes(Array.isArray(data) ? data : []);
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки маршрутов."),
      });
    } finally {
      setLoadingRoutes(false);
    }
  };

  const loadAvailableRequests = async (nextFilters = filters, selectionSnapshot = selectedIds) => {
    if (!isManager) {
      return;
    }

    setLoadingRequests(true);
    try {
      const data = await getAvailableRouteRequests(stripEmptyParams(nextFilters));
      const items = Array.isArray(data) ? data : [];
      setAvailableRequests(items);
      setSelectedRequestMap((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (selectionSnapshot.includes(item.id)) {
            next[item.id] = item;
          }
        }
        return next;
      });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки доступных заявок."),
      });
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    if (!isManager) {
      return undefined;
    }

    getRequestReferenceOptions()
      .then((data) => setReferenceOptions(data))
      .catch((error) => {
        setMsg({
          type: "danger",
          text: formatApiError(error, "Ошибка загрузки справочников для маршрутов."),
        });
      });
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      setRequestsPage(1);
      loadAvailableRequests(debouncedFilters);
    }
  }, [debouncedFilters, isManager]);

  useEffect(() => {
    setRoutesPage(1);
  }, [routes.length]);

  const selectedItems = useMemo(
    () => selectedIds.map((requestId) => selectedRequestMap[requestId]).filter(Boolean),
    [selectedIds, selectedRequestMap]
  );

  const selectedDepartmentIds = useMemo(() => {
    const departmentIds = selectedItems
      .map((item) => item.responsible_department)
      .filter((value) => value !== null && value !== undefined && value !== "");
    return [...new Set(departmentIds.map(Number))];
  }, [selectedItems]);

  const previewPoints = useMemo(
    () => buildPreviewPoints(selectedItems, selectedIds),
    [selectedItems, selectedIds]
  );

  const availableBrigades = useMemo(() => {
    const source = referenceOptions?.brigades || [];
    if (!selectedItems.length) {
      return source;
    }
    if (selectedDepartmentIds.length === 1) {
      return source.filter((brigade) => brigade.department_id === selectedDepartmentIds[0]);
    }
    return source.filter((brigade) => !brigade.department_id);
  }, [referenceOptions, selectedDepartmentIds, selectedItems.length]);

  const availableWorkers = useMemo(() => {
    const source = referenceOptions?.workers || [];
    if (!selectedItems.length) {
      return source;
    }
    if (selectedDepartmentIds.length === 1) {
      return source.filter((worker) => worker.department_id === selectedDepartmentIds[0]);
    }
    return source.filter((worker) => !worker.department_id);
  }, [referenceOptions, selectedDepartmentIds, selectedItems.length]);

  useEffect(() => {
    if (form.brigade && !availableBrigades.some((brigade) => brigade.id === Number(form.brigade))) {
      setForm((prev) => ({ ...prev, brigade: "" }));
    }
  }, [availableBrigades, form.brigade]);

  useEffect(() => {
    if (form.assigned_worker && !availableWorkers.some((worker) => worker.id === Number(form.assigned_worker))) {
      setForm((prev) => ({ ...prev, assigned_worker: "" }));
    }
  }, [availableWorkers, form.assigned_worker]);

  const pagedRequests = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PAGE_SIZE;
    return availableRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [availableRequests, requestsPage]);

  const pagedRoutes = useMemo(() => {
    const start = (routesPage - 1) * ROUTES_PAGE_SIZE;
    return routes.slice(start, start + ROUTES_PAGE_SIZE);
  }, [routes, routesPage]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters(createFilters());
    setSelectedIds([]);
    setSelectedRequestMap({});
    setRequestsPage(1);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRequest = (item) => {
    setSelectedIds((prev) => {
      if (prev.includes(item.id)) {
        const next = prev.filter((requestId) => requestId !== item.id);
        setSelectedRequestMap((map) => {
          const clone = { ...map };
          delete clone[item.id];
          return clone;
        });
        return next;
      }

      setSelectedRequestMap((map) => ({ ...map, [item.id]: item }));
      return [...prev, item.id];
    });
  };

  const submit = async () => {
    if (selectedIds.length < 2) {
      setMsg({ type: "warning", text: "Для построения маршрута выберите минимум две заявки." });
      return;
    }

    if (!form.name.trim()) {
      setMsg({ type: "warning", text: "Укажите название маршрута." });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const createdRoute = await createRoute({
        name: form.name.trim(),
        request_ids: selectedIds,
        brigade: toNumberOrNull(form.brigade),
        assigned_worker: toNumberOrNull(form.assigned_worker),
        comment: form.comment.trim(),
      });
      if (createdRoute?.id) {
        navigate(`${basePath}/${createdRoute.id}`, {
          state: createdRoute.warning
            ? { notice: { type: "warning", text: createdRoute.warning } }
            : undefined,
        });
        return;
      }
      setForm(createRouteForm());
      setSelectedIds([]);
      setSelectedRequestMap({});
      await Promise.all([loadRoutes(), loadAvailableRequests(filters, [])]);
      setMsg({ type: "success", text: "Маршрут сохранен." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка создания маршрута."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h4 className="mb-0">{getTitle(role)}</h4>
            <div className="text-muted">{getSubtitle(role)}</div>
          </div>
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              loadRoutes();
              loadAvailableRequests(filters);
            }}
            disabled={loadingRoutes || loadingRequests}
            type="button"
          >
            {loadingRoutes || loadingRequests ? "..." : "Обновить"}
          </button>
        </div>
        <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />
      </div>

      {isManager && (
        <>
          <div className="card p-3">
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
              <div>
                <div className="fw-semibold">Доступные заявки</div>
                <div className="text-muted small">
                  Выберите заявки своей области ответственности и проверьте предварительный порядок объезда.
                </div>
              </div>
              <span className="badge text-bg-light">Выбрано: {selectedIds.length}</span>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Поиск</label>
                <input
                  className="form-control"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="ID, описание, адрес, город"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Город</label>
                <input
                  className="form-control"
                  value={filters.city}
                  onChange={(event) => updateFilter("city", event.target.value)}
                  placeholder="Город"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Статус</label>
                <select
                  className="form-select"
                  value={filters.status}
                  onChange={(event) => updateFilter("status", event.target.value)}
                >
                  <option value="">Все</option>
                  {(referenceOptions?.choices?.request_status || []).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Подразделение</label>
                <select
                  className="form-select"
                  value={filters.department}
                  onChange={(event) => updateFilter("department", event.target.value)}
                >
                  <option value="">Все</option>
                  {(referenceOptions?.departments || []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Бригада</label>
                <select
                  className="form-select"
                  value={filters.brigade}
                  onChange={(event) => updateFilter("brigade", event.target.value)}
                >
                  <option value="">Все</option>
                  {(referenceOptions?.brigades || []).map((brigade) => (
                    <option key={brigade.id} value={brigade.id}>
                      {brigade.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="d-flex justify-content-end mb-3">
              <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters} type="button">
                Сбросить фильтры и выбор
              </button>
            </div>

            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}></th>
                    <th style={{ width: 90 }}>ID</th>
                    <th>Заявка</th>
                    <th style={{ width: 170 }}>Подразделение</th>
                    <th style={{ width: 160 }}>Город</th>
                    <th style={{ width: 180 }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRequests.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleRequest(item)}
                        />
                      </td>
                      <td className="fw-semibold">#{item.id}</td>
                      <td>
                        <div className="fw-semibold">{item.title}</div>
                        {item.address && <div className="text-muted small">{item.address}</div>}
                      </td>
                      <td>{item.responsible_department_name || "-"}</td>
                      <td>{item.city || "-"}</td>
                      <td>
                        <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                      </td>
                    </tr>
                  ))}
                  {!pagedRequests.length && (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        Подходящих заявок не найдено.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={requestsPage}
              pageSize={REQUESTS_PAGE_SIZE}
              total={availableRequests.length}
              onPageChange={setRequestsPage}
            />
          </div>

          <div className="row g-3">
            <div className="col-xl-5">
              <div className="card p-3 h-100">
                <div className="fw-semibold mb-3">Сохранение маршрута</div>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Название</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Например, Утренний обход северного сектора"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Бригада</label>
                    <select
                      className="form-select"
                      value={form.brigade}
                      onChange={(event) => updateForm("brigade", event.target.value)}
                    >
                      <option value="">Не назначать</option>
                      {availableBrigades.map((brigade) => (
                        <option key={brigade.id} value={brigade.id}>
                          {brigade.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Исполнитель</label>
                    <select
                      className="form-select"
                      value={form.assigned_worker}
                      onChange={(event) => updateForm("assigned_worker", event.target.value)}
                    >
                      <option value="">Не назначать</option>
                      {availableWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          #{worker.id} {worker.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Комментарий</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={form.comment}
                      onChange={(event) => updateForm("comment", event.target.value)}
                      placeholder="Комментарий для бригады или исполнителя"
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
                  <div className="text-muted small">
                    {selectedIds.length >= 2
                      ? `Точек в маршруте: ${previewPoints.length}`
                      : "Нужно выбрать минимум две заявки."}
                  </div>
                  <button className="btn btn-primary" onClick={submit} disabled={saving} type="button">
                    {saving ? "..." : "Построить маршрут"}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-xl-7">
              <div className="card p-3 h-100">
                <div className="fw-semibold mb-3">Предварительный маршрут</div>
                <RouteMap
                  points={previewPoints}
                  emptyText="Выберите минимум две заявки, чтобы увидеть порядок точек на карте."
                />
                <div className="mt-3">
                  {previewPoints.length ? (
                    <div className="gc-route-point-list">
                      {previewPoints.map((point) => (
                        <div key={point.id} className="gc-route-point-list__item">
                          <div className="fw-semibold">
                            {point.order_number}. Заявка #{point.request}
                          </div>
                          <div>{point.request_title}</div>
                          <div className="text-muted small">{point.address || "Адрес не указан"}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted">Маршрут пока не сформирован.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
          <div>
            <div className="fw-semibold">{isManager ? "Сохраненные маршруты" : "Назначенные маршруты"}</div>
            <div className="text-muted small">
              {loadingRoutes ? "Загрузка..." : `Всего маршрутов: ${routes.length}`}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Маршрут</th>
                <th style={{ width: 150 }}>Статус</th>
                <th style={{ width: 100 }}>Точек</th>
                <th style={{ width: 180 }}>Бригада</th>
                <th style={{ width: 180 }}>Исполнитель</th>
                <th style={{ width: 220 }}>Обновлен</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {pagedRoutes.map((route) => (
                <tr key={route.id}>
                  <td>
                    <div className="fw-semibold">{route.name}</div>
                    <div className="text-muted small">
                      {route.department_name || route.organization_name || "-"}
                    </div>
                  </td>
                  <td>
                    <span className={statusClass(route.status)}>{statusLabel(route.status)}</span>
                  </td>
                  <td>{route.points_count}</td>
                  <td>{route.brigade_name || "-"}</td>
                  <td>{route.assigned_worker_username || "-"}</td>
                  <td className="text-muted">
                    {route.updated_at ? new Date(route.updated_at).toLocaleString() : "-"}
                  </td>
                  <td>
                    <Link to={`${basePath}/${route.id}`} className="btn btn-sm btn-outline-primary">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
              {!pagedRoutes.length && (
                <tr>
                  <td colSpan={7} className="text-muted">
                    Маршрутов пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={routesPage}
          pageSize={ROUTES_PAGE_SIZE}
          total={routes.length}
          onPageChange={setRoutesPage}
        />
      </div>
    </div>
  );
}

function stripEmptyParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}
