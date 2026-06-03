import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Notice from "../../components/Notice";
import RequestResponsibilityMap from "../../components/maps/RequestResponsibilityMap";
import {
  departmentAssignRequest,
  getRequest,
  getRequestReferenceOptions,
} from "../../api/requests";
import { handlingModeLabel, statusClass, statusLabel } from "../../ui/status";
import { formatApiError } from "../../utils/apiErrors";

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function buildAssignmentForm(request) {
  return {
    assigned_brigade: request?.assigned_brigade ?? null,
    assigned_worker: request?.assigned_worker ?? null,
    comment: "",
  };
}

export default function DepartmentRequestDetail() {
  const { id } = useParams();
  const [requestItem, setRequestItem] = useState(null);
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(buildAssignmentForm(null));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setMsg(null);
    const [requestData, optionsData] = await Promise.all([
      getRequest(id),
      getRequestReferenceOptions(),
    ]);
    setRequestItem(requestData);
    setOptions(optionsData);
    setForm(buildAssignmentForm(requestData));
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки заявки."),
      });
    });
  }, [id]);

  const departmentId = options?.current_user?.department || requestItem?.responsible_department;

  const brigades = useMemo(() => {
    if (!options) return [];
    if (!departmentId) return options.brigades || [];
    return (options.brigades || []).filter((brigade) => brigade.department_id === Number(departmentId));
  }, [options, departmentId]);

  const workers = useMemo(() => {
    if (!options) return [];
    if (!departmentId) return options.workers || [];
    return (options.workers || []).filter((worker) => worker.department_id === Number(departmentId));
  }, [options, departmentId]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await departmentAssignRequest(id, {
        assigned_brigade: toNumberOrNull(form.assigned_brigade),
        assigned_worker: toNumberOrNull(form.assigned_worker),
        comment: form.comment.trim(),
      });
      await load();
      setMsg({ type: "success", text: "Назначение подразделения обновлено." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка назначения бригады или исполнителя."),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!requestItem || !options) {
    return <div className="card p-3">Загрузка...</div>;
  }

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h4 className="mb-0">Заявка #{requestItem.id}</h4>
            <div className="text-muted">{requestItem.title}</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className={statusClass(requestItem.status)}>{statusLabel(requestItem.status)}</span>
            <span className="gc-status">{handlingModeLabel(requestItem.handling_mode)}</span>
          </div>
        </div>
        <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Данные заявки</div>
            <div className="d-grid gap-1">
              <div><b>Адрес:</b> {requestItem.address || "-"}</div>
              <div><b>Город:</b> {requestItem.city || "-"}</div>
              <div><b>Тип территории:</b> {requestItem.territory_type_name || "-"}</div>
              <div><b>Тип собственности:</b> {requestItem.ownership_type_name || "-"}</div>
              <div><b>Организация:</b> {requestItem.responsible_organization_name || "-"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "-"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "-"}</div>
              <div><b>Исполнитель:</b> {requestItem.assigned_worker_username || "-"}</div>
              <div><b>Координатор:</b> {requestItem.coordinator_username || "-"}</div>
              <div><b>Координаты:</b> {requestItem.latitude ?? "-"}, {requestItem.longitude ?? "-"}</div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Назначение внутри подразделения</div>
            <div className="text-muted small mb-3">
              Руководитель подразделения выбирает бригаду и при необходимости конкретного исполнителя. Координатор и руководитель организации эти поля не меняют.
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Бригада</label>
                <select
                  className="form-select"
                  value={form.assigned_brigade ?? ""}
                  onChange={(event) => updateField("assigned_brigade", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {brigades.map((brigade) => (
                    <option key={brigade.id} value={brigade.id}>
                      {brigade.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Исполнитель</label>
                <select
                  className="form-select"
                  value={form.assigned_worker ?? ""}
                  onChange={(event) => updateField("assigned_worker", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {workers.map((worker) => (
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
                  rows={3}
                  value={form.comment}
                  onChange={(event) => updateField("comment", event.target.value)}
                  placeholder="Что назначено и какие есть указания для выполнения"
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? "..." : "Сохранить назначение"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="fw-semibold mb-3">Карта и зоны ответственности</div>
        <div className="row g-3">
          <div className="col-xl-7">
            <RequestResponsibilityMap
              latitude={requestItem.latitude}
              longitude={requestItem.longitude}
              zones={requestItem.responsibility_zones || []}
            />
          </div>
          <div className="col-xl-5">
            <div className="gc-zone-list">
              {requestItem.responsibility_zones?.length ? (
                requestItem.responsibility_zones.map((zone) => (
                  <div key={zone.id} className={`gc-zone-card ${zone.is_selected ? "gc-zone-card--selected" : ""}`}>
                    <div className="fw-semibold">{zone.name}</div>
                    <div className="text-muted small">
                      {zone.department_name || zone.organization_name || "-"}
                      {zone.brigade_name ? ` • ${zone.brigade_name}` : ""}
                    </div>
                    <div className="gc-badge-stack mt-2">
                      {zone.match_reasons.map((reason) => (
                        <span key={reason} className="gc-badge-soft">{reason}</span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted">Подходящие зоны ответственности не найдены.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото до</div>
            {requestItem.before_photo ? (
              <img src={requestItem.before_photo} alt="before" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Нет фото</div>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото после</div>
            {requestItem.after_photo ? (
              <img src={requestItem.after_photo} alt="after" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Фото результата пока не загружено</div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">История статусов</div>
            <div className="gc-timeline">
              {requestItem.status_history?.length ? (
                requestItem.status_history.map((entry) => (
                  <div key={entry.id} className="gc-timeline__item">
                    <div className="fw-semibold">{statusLabel(entry.status)}</div>
                    <div className="text-muted small">
                      {entry.changed_by_username || "Система"} • {new Date(entry.created_at).toLocaleString()}
                    </div>
                    {entry.comment && <div>{entry.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">История пуста.</div>
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Назначения</div>
            <div className="gc-timeline">
              {requestItem.assignments?.length ? (
                requestItem.assignments.map((assignment) => (
                  <div key={assignment.id} className="gc-timeline__item">
                    <div className="fw-semibold">{assignment.assignment_type}</div>
                    <div className="text-muted small">
                      {assignment.assigned_by_username || "Система"} • {new Date(assignment.created_at).toLocaleString()}
                    </div>
                    <div>
                      {assignment.assigned_department_name ||
                        assignment.assigned_brigade_name ||
                        assignment.assigned_worker_username ||
                        "-"}
                    </div>
                    {assignment.comment && <div className="text-muted small mt-1">{assignment.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">Назначений пока нет.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
