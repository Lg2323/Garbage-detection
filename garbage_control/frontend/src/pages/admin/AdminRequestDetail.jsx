import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Notice from "../../components/Notice";
import RequestResponsibilityMap from "../../components/maps/RequestResponsibilityMap";
import { getRequestReferenceOptions, getRequest } from "../../api/requests";
import { assignWorker, setRequestStatus } from "../../api/admin";
import { handlingModeLabel, statusClass, statusLabel } from "../../ui/status";
import { formatApiError } from "../../utils/apiErrors";

export default function AdminRequestDetail() {
  const { id } = useParams();
  const [requestItem, setRequestItem] = useState(null);
  const [options, setOptions] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [statusValue, setStatusValue] = useState("");

  const load = async () => {
    setMsg(null);
    const [requestData, optionsData] = await Promise.all([
      getRequest(id),
      getRequestReferenceOptions(),
    ]);
    setRequestItem(requestData);
    setOptions(optionsData);
    setWorkerId(requestData.assigned_worker || "");
    setStatusValue(requestData.status || "");
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки заявки."),
      });
    });
  }, [id]);

  const workers = useMemo(() => {
    if (!options?.workers) return [];
    let filtered = options.workers;
    if (requestItem?.responsible_organization) {
      filtered = filtered.filter(
        (worker) => worker.organization_id === Number(requestItem.responsible_organization)
      );
    }
    if (requestItem?.responsible_department) {
      filtered = filtered.filter(
        (worker) => worker.department_id === Number(requestItem.responsible_department)
      );
    }
    return filtered;
  }, [options, requestItem?.responsible_organization, requestItem?.responsible_department]);

  const handleAssignWorker = async () => {
    if (!workerId) {
      setMsg({ type: "warning", text: "Выберите исполнителя для admin override." });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      await assignWorker(id, Number(workerId));
      await load();
      setMsg({ type: "success", text: "Исполнитель назначен по admin override." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка admin override назначения исполнителя."),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSetStatus = async () => {
    if (!statusValue) {
      setMsg({ type: "warning", text: "Выберите статус для admin override." });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      await setRequestStatus(id, statusValue);
      await load();
      setMsg({ type: "success", text: "Статус обновлен по admin override." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка admin override изменения статуса."),
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
              <div><b>Автор:</b> {requestItem.created_by_username || requestItem.created_by}</div>
              <div><b>Координатор:</b> {requestItem.coordinator_username || "-"}</div>
              <div><b>Адрес:</b> {requestItem.address || "-"}</div>
              <div><b>Город:</b> {requestItem.city || "-"}</div>
              <div><b>Тип территории:</b> {requestItem.territory_type_name || "-"}</div>
              <div><b>Тип собственности:</b> {requestItem.ownership_type_name || "-"}</div>
              <div><b>Организация:</b> {requestItem.responsible_organization_name || "-"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "-"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "-"}</div>
              <div><b>Исполнитель:</b> {requestItem.assigned_worker_username || "-"}</div>
              <div><b>Координаты:</b> {requestItem.latitude ?? "-"}, {requestItem.longitude ?? "-"}</div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Admin override</div>
            <div className="text-muted small mb-3">
              Этот экран не заменяет coordinator/org manager/department manager workflow. Здесь доступны только аварийные override-действия.
            </div>

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Исполнитель</label>
                <select
                  className="form-select"
                  value={workerId}
                  onChange={(event) => setWorkerId(event.target.value)}
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
                <label className="form-label">Статус</label>
                <select
                  className="form-select"
                  value={statusValue}
                  onChange={(event) => setStatusValue(event.target.value)}
                >
                  {(options.choices?.request_status || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-primary" onClick={handleAssignWorker} disabled={busy}>
                {busy ? "..." : "Назначить"}
              </button>
              <button className="btn btn-outline-secondary" onClick={handleSetStatus} disabled={busy}>
                {busy ? "..." : "Сменить статус"}
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
                      {zone.organization_name || "-"}
                      {zone.department_name ? ` • ${zone.department_name}` : ""}
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
              <div className="text-muted">Нет фото</div>
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
            <div className="fw-semibold mb-2">Назначения и передачи</div>
            <div className="gc-timeline">
              {requestItem.assignments?.map((assignment) => (
                <div key={`assignment-${assignment.id}`} className="gc-timeline__item">
                  <div className="fw-semibold">{assignment.assignment_type}</div>
                  <div className="text-muted small">
                    {assignment.assigned_by_username || "Система"} • {new Date(assignment.created_at).toLocaleString()}
                  </div>
                  <div>
                    {assignment.assigned_organization_name ||
                      assignment.assigned_department_name ||
                      assignment.assigned_brigade_name ||
                      assignment.assigned_worker_username ||
                      "-"}
                  </div>
                  {assignment.comment && <div className="text-muted small mt-1">{assignment.comment}</div>}
                </div>
              ))}
              {requestItem.external_transfers?.map((transfer) => (
                <div key={`transfer-${transfer.id}`} className="gc-timeline__item">
                  <div className="fw-semibold">Передача #{transfer.id}</div>
                  <div className="text-muted small">
                    {transfer.created_by_username || "Система"} • {new Date(transfer.sent_at).toLocaleString()}
                  </div>
                  <div>{transfer.target_organization_name || transfer.recipient_name || "-"}</div>
                  <div className="text-muted small">{transfer.transfer_reason}</div>
                </div>
              ))}
              {!requestItem.assignments?.length && !requestItem.external_transfers?.length && (
                <div className="text-muted">История назначений пуста.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
