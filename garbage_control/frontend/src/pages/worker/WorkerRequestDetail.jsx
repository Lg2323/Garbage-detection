import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import FileDropzone from "../../components/FileDropzone";
import Notice from "../../components/Notice";
import RequestResponsibilityMap from "../../components/maps/RequestResponsibilityMap";
import { getRequest, takeInWork, uploadAfterPhoto } from "../../api/requests";
import { handlingModeLabel, statusClass, statusLabel } from "../../ui/status";

const ASSIGNMENT_TYPE_LABELS = {
  ROUTING: "Маршрутизация",
  WORKER: "Назначение исполнителя",
  REASSIGNMENT: "Переназначение",
  EXTERNAL_TRANSFER: "Внешняя передача",
};

function assignmentTypeLabel(value) {
  return ASSIGNMENT_TYPE_LABELS[value] || value || "-";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function buildMapLink(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  return `https://yandex.ru/maps/?pt=${Number(longitude)},${Number(latitude)}&z=17&l=map`;
}

export default function WorkerRequestDetail() {
  const { id } = useParams();
  const [requestItem, setRequestItem] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [afterFile, setAfterFile] = useState(null);

  const load = async () => {
    setMsg(null);
    const data = await getRequest(id);
    setRequestItem(data);
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: "Ошибка загрузки заявки: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    });
  }, [id]);

  const latestRework = requestItem?.rework_events?.[0] || null;
  const latestAssignment = requestItem?.assignments?.[0] || null;
  const mapLink = useMemo(
    () => buildMapLink(requestItem?.latitude, requestItem?.longitude),
    [requestItem?.latitude, requestItem?.longitude]
  );

  const handleTakeInWork = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await takeInWork(id);
      await load();
      setMsg({ type: "success", text: "Заявка взята в работу." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка перевода в работу: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUploadAfter = async () => {
    if (!afterFile) {
      setMsg({ type: "warning", text: "Сначала выберите фото результата." });
      return;
    }

    setMsg(null);
    setBusy(true);
    try {
      await uploadAfterPhoto(id, afterFile);
      setAfterFile(null);
      await load();
      setMsg({ type: "success", text: "Фото результата загружено, заявка отправлена на проверку." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка загрузки фото: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!requestItem) {
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
        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Куда ехать</div>
            <div className="d-grid gap-2">
              <div><b>Адрес:</b> {requestItem.address || "Адрес не указан"}</div>
              <div><b>Город:</b> {requestItem.city || "-"}</div>
              <div><b>Координаты:</b> {requestItem.latitude ?? "-"}, {requestItem.longitude ?? "-"}</div>
              <div><b>Тип территории:</b> {requestItem.territory_type_name || "-"}</div>
              <div><b>Тип собственности:</b> {requestItem.ownership_type_name || "-"}</div>
              <div><b>Ответственная организация:</b> {requestItem.responsible_organization_name || "-"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "-"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "-"}</div>
              <div><b>Координатор:</b> {requestItem.coordinator_username || "-"}</div>
              <div><b>Создана:</b> {formatDateTime(requestItem.created_at)}</div>
            </div>

            {mapLink && (
              <div className="mt-3">
                <a className="btn btn-outline-primary" href={mapLink} target="_blank" rel="noreferrer">
                  Открыть точку на карте
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Что нужно сделать</div>

            <div className="gc-info-block mb-3">
              <div><b>Описание проблемы:</b> {requestItem.title}</div>
              <div><b>Режим обработки:</b> {handlingModeLabel(requestItem.handling_mode)}</div>
            </div>

            {requestItem.classification_comment && (
              <div className="gc-info-block mb-3">
                <div className="fw-semibold">Комментарий координатора</div>
                <div>{requestItem.classification_comment}</div>
              </div>
            )}

            {latestAssignment?.comment && (
              <div className="gc-info-block mb-3">
                <div className="fw-semibold">Комментарий к назначению</div>
                <div>{latestAssignment.comment}</div>
                <div className="text-muted small mt-1">
                  {latestAssignment.assigned_by_username || "Система"} • {formatDateTime(latestAssignment.created_at)}
                </div>
              </div>
            )}

            {latestRework?.comment && (
              <div className="gc-info-block mb-3">
                <div className="fw-semibold text-danger">Что исправить</div>
                <div>{latestRework.comment}</div>
                <div className="text-muted small mt-1">
                  Возврат оформил {latestRework.created_by_username || "координатор"} • {formatDateTime(latestRework.created_at)}
                </div>
              </div>
            )}

            {requestItem.status === "VERIFIED" && (
              <div className="d-flex justify-content-start">
                <button className="btn btn-primary" onClick={handleTakeInWork} disabled={busy}>
                  {busy ? "..." : "Взять в работу"}
                </button>
              </div>
            )}

            {requestItem.status === "IN_PROGRESS" && (
              <div className="d-grid gap-3">
                <FileDropzone label="Фото после уборки" file={afterFile} onChange={setAfterFile} />
                <div className="d-flex justify-content-start">
                  <button className="btn btn-primary" onClick={handleUploadAfter} disabled={busy}>
                    {busy ? "..." : "Отправить фото результата"}
                  </button>
                </div>
              </div>
            )}

            {requestItem.status === "ON_CHECK" && (
              <div className="text-muted">
                Фото результата уже отправлено. Сейчас заявка находится на проверке.
              </div>
            )}

            {requestItem.status === "COMPLETED" && (
              <div className="text-muted">
                Заявка закрыта. Результат подтвержден.
              </div>
            )}

            {requestItem.status !== "VERIFIED" &&
              requestItem.status !== "IN_PROGRESS" &&
              requestItem.status !== "ON_CHECK" &&
              requestItem.status !== "COMPLETED" && (
                <div className="text-muted">
                  По текущему статусу активных действий от исполнителя не требуется.
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="fw-semibold mb-3">Карта заявки и зона ответственности</div>
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
                    {!!zone.match_reasons?.length && (
                      <div className="gc-badge-stack mt-2">
                        {zone.match_reasons.map((reason) => (
                          <span key={reason} className="gc-badge-soft">{reason}</span>
                        ))}
                      </div>
                    )}
                    {zone.comment && <div className="text-muted small mt-2">{zone.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">
                  Для этой заявки не найдены отдельные зоны ответственности. Ориентируйтесь по адресу и координатам.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото до уборки</div>
            {requestItem.before_photo ? (
              <img src={requestItem.before_photo} alt="before" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Фото не загружено.</div>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото после уборки</div>
            {requestItem.after_photo ? (
              <img src={requestItem.after_photo} alt="after" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Фото результата пока не загружено.</div>
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
                      {entry.changed_by_username || "Система"} • {formatDateTime(entry.created_at)}
                    </div>
                    {entry.comment && <div>{entry.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">История статусов пока пуста.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Назначения и указания</div>
            <div className="gc-timeline">
              {requestItem.assignments?.length ? (
                requestItem.assignments.map((assignment) => (
                  <div key={assignment.id} className="gc-timeline__item">
                    <div className="fw-semibold">{assignmentTypeLabel(assignment.assignment_type)}</div>
                    <div className="text-muted small">
                      {assignment.assigned_by_username || "Система"} • {formatDateTime(assignment.created_at)}
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
