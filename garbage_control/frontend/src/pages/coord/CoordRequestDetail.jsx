import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Notice from "../../components/Notice";
import RequestResponsibilityMap from "../../components/maps/RequestResponsibilityMap";
import {
  assignWorker,
  classifyRequest,
  externalTransferRequest,
  getRequest,
  getRequestReferenceOptions,
  returnToWork,
  verifyRequest,
} from "../../api/requests";
import { handlingModeLabel, statusClass, statusLabel } from "../../ui/status";

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function buildClassificationForm(request) {
  return {
    address: request?.address || "",
    federal_subject: request?.federal_subject ?? null,
    municipality: request?.municipality ?? null,
    locality: request?.locality ?? null,
    territory_type: request?.territory_type ?? null,
    ownership_type: request?.ownership_type ?? null,
    handling_mode: request?.handling_mode || "CLEANUP",
    responsible_organization: request?.responsible_organization ?? null,
    responsible_department: request?.responsible_department ?? null,
    assigned_brigade: request?.assigned_brigade ?? null,
    classification_comment: request?.classification_comment || "",
  };
}

const INITIAL_TRANSFER_FORM = {
  target_organization: null,
  recipient_name: "",
  recipient_contact: "",
  transfer_reason: "",
  comment: "",
  outgoing_number: "",
};

export default function CoordRequestDetail() {
  const { id } = useParams();
  const [requestItem, setRequestItem] = useState(null);
  const [options, setOptions] = useState(null);
  const [workerId, setWorkerId] = useState("");
  const [classificationForm, setClassificationForm] = useState(buildClassificationForm(null));
  const [transferForm, setTransferForm] = useState(INITIAL_TRANSFER_FORM);
  const [returnComment, setReturnComment] = useState("");
  const [reassignWorkerId, setReassignWorkerId] = useState("");
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
    setWorkerId(requestData?.assigned_worker || "");
    setClassificationForm(buildClassificationForm(requestData));
    setTransferForm((prev) => ({
      ...INITIAL_TRANSFER_FORM,
      target_organization: requestData?.responsible_organization ?? prev.target_organization,
    }));
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: "Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    });
  }, [id]);

  const workers = useMemo(() => {
    if (!options) return [];
    let filtered = options.workers || [];
    if (classificationForm.responsible_organization) {
      filtered = filtered.filter(
        (worker) => worker.organization_id === Number(classificationForm.responsible_organization)
      );
    }
    if (classificationForm.responsible_department) {
      filtered = filtered.filter(
        (worker) =>
          !worker.department_id || worker.department_id === Number(classificationForm.responsible_department)
      );
    }
    return filtered;
  }, [options, classificationForm.responsible_organization, classificationForm.responsible_department]);

  const municipalities = useMemo(() => {
    if (!options) return [];
    if (!classificationForm.federal_subject) return options.municipalities;
    return options.municipalities.filter(
      (municipality) => municipality.federal_subject_id === Number(classificationForm.federal_subject)
    );
  }, [options, classificationForm.federal_subject]);

  const localities = useMemo(() => {
    if (!options) return [];
    if (!classificationForm.municipality) return options.localities;
    return options.localities.filter(
      (locality) => locality.municipality_id === Number(classificationForm.municipality)
    );
  }, [options, classificationForm.municipality]);

  const departments = useMemo(() => {
    if (!options) return [];
    if (!classificationForm.responsible_organization) return options.departments;
    return options.departments.filter(
      (department) => department.organization_id === Number(classificationForm.responsible_organization)
    );
  }, [options, classificationForm.responsible_organization]);

  const brigades = useMemo(() => {
    if (!options) return [];
    let filtered = options.brigades;
    if (classificationForm.responsible_organization) {
      filtered = filtered.filter(
        (brigade) => brigade.organization_id === Number(classificationForm.responsible_organization)
      );
    }
    if (classificationForm.responsible_department) {
      filtered = filtered.filter(
        (brigade) => brigade.department_id === Number(classificationForm.responsible_department)
      );
    }
    return filtered;
  }, [options, classificationForm.responsible_organization, classificationForm.responsible_department]);

  const updateClassificationField = (field, value) => {
    setClassificationForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateTransferField = (field, value) => {
    setTransferForm((prev) => ({ ...prev, [field]: value }));
  };

  const doAssign = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await assignWorker(id, Number(workerId));
      await load();
      setMsg({ type: "success", text: "Исполнитель назначен." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка назначения: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const doClassify = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await classifyRequest(id, {
        address: classificationForm.address.trim(),
        federal_subject: toNumberOrNull(classificationForm.federal_subject),
        municipality: toNumberOrNull(classificationForm.municipality),
        locality: toNumberOrNull(classificationForm.locality),
        territory_type: toNumberOrNull(classificationForm.territory_type),
        ownership_type: toNumberOrNull(classificationForm.ownership_type),
        handling_mode: classificationForm.handling_mode,
        responsible_organization: toNumberOrNull(classificationForm.responsible_organization),
        responsible_department: toNumberOrNull(classificationForm.responsible_department),
        assigned_brigade: toNumberOrNull(classificationForm.assigned_brigade),
        classification_comment: classificationForm.classification_comment.trim(),
      });
      await load();
      setMsg({ type: "success", text: "Классификация сохранена." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка классификации: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const doExternalTransfer = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await externalTransferRequest(id, {
        target_organization: toNumberOrNull(transferForm.target_organization),
        recipient_name: transferForm.recipient_name.trim(),
        recipient_contact: transferForm.recipient_contact.trim(),
        transfer_reason: transferForm.transfer_reason.trim(),
        comment: transferForm.comment.trim(),
        outgoing_number: transferForm.outgoing_number.trim(),
      });
      await load();
      setTransferForm(INITIAL_TRANSFER_FORM);
      setMsg({ type: "success", text: "Заявка передана по принадлежности." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка внешней передачи: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await verifyRequest(id, {});
      await load();
      setMsg({ type: "success", text: "Проверка выполнена." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка проверки: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const doReturnToWork = async () => {
    if (!returnComment.trim()) {
      setMsg({ type: "warning", text: "Укажите комментарий для возврата на доработку." });
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      await returnToWork(id, {
        comment: returnComment.trim(),
        reassign_worker_id: reassignWorkerId ? Number(reassignWorkerId) : null,
      });
      setReturnComment("");
      setReassignWorkerId("");
      await load();
      setMsg({ type: "success", text: "Заявка возвращена на доработку." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Ошибка возврата: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const verification = requestItem?.verification || null;

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
            <div className="fw-semibold mb-2">Основные данные</div>
            <div className="d-grid gap-1">
              <div><b>Автор:</b> {requestItem.created_by_username || requestItem.created_by}</div>
              <div><b>Координатор:</b> {requestItem.coordinator_username || "-"}</div>
              <div><b>Исполнитель:</b> {requestItem.assigned_worker_username || "-"}</div>
              <div><b>Организация исполнителя:</b> {requestItem.assigned_worker_organization_name || "-"}</div>
              <div><b>Подразделение исполнителя:</b> {requestItem.assigned_worker_department_name || "-"}</div>
              <div><b>Субъект РФ:</b> {requestItem.federal_subject_name || "-"}</div>
              <div><b>Муниципалитет:</b> {requestItem.municipality_name || "-"}</div>
              <div><b>Населенный пункт:</b> {requestItem.locality_name || "-"}</div>
              <div><b>Тип территории:</b> {requestItem.territory_type_name || "-"}</div>
              <div><b>Тип собственности:</b> {requestItem.ownership_type_name || "-"}</div>
              <div><b>Организация:</b> {requestItem.responsible_organization_name || "-"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "-"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "-"}</div>
              <div><b>Адрес:</b> {requestItem.address || "-"}</div>
              <div><b>Город:</b> {requestItem.city || "-"}</div>
              <div><b>Координаты:</b> {requestItem.latitude ?? "-"}, {requestItem.longitude ?? "-"}</div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Контур исполнения</div>
            <div className="gc-info-block mb-3">
              <div><b>Ответственная организация:</b> {requestItem.responsible_organization_name || "не выбрана"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "-"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "-"}</div>
            </div>
            {requestItem.responsible_organization ? (
              <div className="text-muted small mb-3">
                После маршрутизации основное распределение по бригаде и исполнителю должно идти через панель организации.
                <Link className="ms-1" to="/org/requests">Открыть панель организации</Link>
              </div>
            ) : (
              <div className="text-muted small mb-3">
                Сначала определите ответственную организацию по территории и зоне ответственности.
              </div>
            )}

            <div className="fw-semibold mb-2">Прямое назначение исполнителя</div>
            <div className="d-flex gap-2">
              <select className="form-select" value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
                <option value="">Выберите исполнителя</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    #{worker.id} {worker.username}
                    {worker.organization__name ? ` • ${worker.organization__name}` : ""}
                    {worker.department__name ? ` • ${worker.department__name}` : ""}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={doAssign} disabled={!workerId || busy}>
                Назначить
              </button>
            </div>

            <div className="gc-profile__divider" />

            <div className="fw-semibold mb-2">Контроль результата</div>
            <button className="btn btn-outline-primary" onClick={doVerify} disabled={busy || !requestItem.after_photo}>
              Запустить проверку
            </button>
            {!requestItem.after_photo && (
              <div className="text-muted small mt-2">Фото результата еще не загружено исполнителем.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
          <div>
            <div className="fw-semibold">Карта ответственности</div>
            <div className="text-muted">
              Точка заявки и зоны, которые подходят по территории либо уже выбраны в текущем маршруте.
            </div>
          </div>
          <span className="gc-pill">Подходящих зон: {requestItem.responsibility_zones?.length || 0}</span>
        </div>

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
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <div className="fw-semibold">{zone.name}</div>
                        <div className="text-muted small">
                          {zone.organization_name || "-"}
                          {zone.department_name ? ` • ${zone.department_name}` : ""}
                          {zone.brigade_name ? ` • ${zone.brigade_name}` : ""}
                        </div>
                      </div>
                      {zone.is_selected && <span className="gc-pill">Выбрана</span>}
                    </div>
                    <div className="gc-badge-stack mt-2">
                      {zone.match_reasons.map((reason) => (
                        <span key={reason} className="gc-badge-soft">{reason}</span>
                      ))}
                    </div>
                    {zone.comment && <div className="text-muted small mt-2">{zone.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">
                  Подходящие зоны ответственности пока не найдены. Сохраните классификацию или уточните территорию.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото до</div>
            {requestItem.before_photo ? <img src={requestItem.before_photo} alt="before" className="img-fluid rounded" /> : <div className="text-muted">Нет фото</div>}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото после</div>
            {requestItem.after_photo ? <img src={requestItem.after_photo} alt="after" className="img-fluid rounded" /> : <div className="text-muted">Нет фото</div>}
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="fw-semibold mb-3">Классификация и маршрутизация</div>
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label">Адрес</label>
            <input className="form-control" value={classificationForm.address} onChange={(event) => updateClassificationField("address", event.target.value)} />
          </div>
          <div className="col-lg-4">
            <label className="form-label">Субъект РФ</label>
            <select className="form-select" value={classificationForm.federal_subject ?? ""} onChange={(event) => updateClassificationField("federal_subject", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.federal_subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Муниципалитет</label>
            <select className="form-select" value={classificationForm.municipality ?? ""} onChange={(event) => updateClassificationField("municipality", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {municipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>{municipality.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Населенный пункт</label>
            <select className="form-select" value={classificationForm.locality ?? ""} onChange={(event) => updateClassificationField("locality", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>{locality.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Тип территории</label>
            <select className="form-select" value={classificationForm.territory_type ?? ""} onChange={(event) => updateClassificationField("territory_type", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.territory_types.map((territoryType) => (
                <option key={territoryType.id} value={territoryType.id}>{territoryType.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Тип собственности</label>
            <select className="form-select" value={classificationForm.ownership_type ?? ""} onChange={(event) => updateClassificationField("ownership_type", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.ownership_types.map((ownershipType) => (
                <option key={ownershipType.id} value={ownershipType.id}>{ownershipType.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Режим обработки</label>
            <select className="form-select" value={classificationForm.handling_mode} onChange={(event) => updateClassificationField("handling_mode", event.target.value)}>
              {(options.choices?.handling_mode || []).map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Организация</label>
            <select className="form-select" value={classificationForm.responsible_organization ?? ""} onChange={(event) => updateClassificationField("responsible_organization", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Подразделение</label>
            <select className="form-select" value={classificationForm.responsible_department ?? ""} onChange={(event) => updateClassificationField("responsible_department", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Бригада</label>
            <select className="form-select" value={classificationForm.assigned_brigade ?? ""} onChange={(event) => updateClassificationField("assigned_brigade", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {brigades.map((brigade) => (
                <option key={brigade.id} value={brigade.id}>{brigade.name}</option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Комментарий классификации</label>
            <textarea className="form-control" rows={3} value={classificationForm.classification_comment} onChange={(event) => updateClassificationField("classification_comment", event.target.value)} />
          </div>
        </div>
        <div className="d-flex justify-content-end mt-3">
          <button className="btn btn-primary" onClick={doClassify} disabled={busy}>
            Сохранить классификацию
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="fw-semibold mb-3">Внешняя передача</div>
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label">Организация-адресат</label>
            <select className="form-select" value={transferForm.target_organization ?? ""} onChange={(event) => updateTransferField("target_organization", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Получатель текстом</label>
            <input className="form-control" value={transferForm.recipient_name} onChange={(event) => updateTransferField("recipient_name", event.target.value)} />
          </div>
          <div className="col-lg-4">
            <label className="form-label">Контакт получателя</label>
            <input className="form-control" value={transferForm.recipient_contact} onChange={(event) => updateTransferField("recipient_contact", event.target.value)} />
          </div>
          <div className="col-lg-4">
            <label className="form-label">Исходящий номер</label>
            <input className="form-control" value={transferForm.outgoing_number} onChange={(event) => updateTransferField("outgoing_number", event.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Основание передачи</label>
            <textarea className="form-control" rows={3} value={transferForm.transfer_reason} onChange={(event) => updateTransferField("transfer_reason", event.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Комментарий</label>
            <textarea className="form-control" rows={2} value={transferForm.comment} onChange={(event) => updateTransferField("comment", event.target.value)} />
          </div>
        </div>
        <div className="d-flex justify-content-end mt-3">
          <button className="btn btn-outline-danger" onClick={doExternalTransfer} disabled={busy}>
            Передать по принадлежности
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="fw-semibold mb-3">Возврат на доработку</div>
        <div className="row g-3">
          <div className="col-12">
            <textarea
              className="form-control"
              rows={3}
              value={returnComment}
              onChange={(event) => setReturnComment(event.target.value)}
              placeholder="Что нужно исправить"
            />
          </div>
          <div className="col-lg-6">
            <select className="form-select" value={reassignWorkerId} onChange={(event) => setReassignWorkerId(event.target.value)}>
              <option value="">Оставить текущего исполнителя</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  #{worker.id} {worker.username}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-6 d-flex justify-content-end">
            <button className="btn btn-outline-danger" onClick={doReturnToWork} disabled={busy}>
              Вернуть на доработку
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-4">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">AI-проверка</div>
            {verification ? (
              <div className="d-grid gap-1">
                <div><b>Результат:</b> {verification.is_clean ? "Чисто" : "Не подтверждено"}</div>
                <div><b>Оценка:</b> {verification.score ?? "-"}</div>
                <div><b>Дата:</b> {verification.created_at ? new Date(verification.created_at).toLocaleString() : "-"}</div>
                {verification.details?.error && <div className="text-danger">{String(verification.details.error)}</div>}
              </div>
            ) : (
              <div className="text-muted">Проверка еще не выполнялась.</div>
            )}
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">История статусов</div>
            <div className="gc-timeline">
              {requestItem.status_history?.length ? requestItem.status_history.map((entry) => (
                <div key={entry.id} className="gc-timeline__item">
                  <div className="fw-semibold">{statusLabel(entry.status)}</div>
                  <div className="text-muted small">{entry.changed_by_username || "Система"} • {new Date(entry.created_at).toLocaleString()}</div>
                  {entry.comment && <div>{entry.comment}</div>}
                </div>
              )) : <div className="text-muted">История пуста.</div>}
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Назначения и передачи</div>
            <div className="gc-timeline">
              {requestItem.assignments?.map((assignment) => (
                <div key={`assignment-${assignment.id}`} className="gc-timeline__item">
                  <div className="fw-semibold">{assignment.assignment_type}</div>
                  <div className="text-muted small">{assignment.assigned_by_username || "Система"} • {new Date(assignment.created_at).toLocaleString()}</div>
                  <div>{assignment.assigned_organization_name || assignment.assigned_department_name || assignment.assigned_worker_username || "-"}</div>
                </div>
              ))}
              {requestItem.external_transfers?.map((transfer) => (
                <div key={`transfer-${transfer.id}`} className="gc-timeline__item">
                  <div className="fw-semibold">Передача #{transfer.id}</div>
                  <div className="text-muted small">{transfer.created_by_username || "Система"} • {new Date(transfer.sent_at).toLocaleString()}</div>
                  <div>{transfer.target_organization_name || transfer.recipient_name || "-"}</div>
                  <div className="text-muted small">{transfer.transfer_reason}</div>
                </div>
              ))}
              {!requestItem.assignments?.length && !requestItem.external_transfers?.length && (
                <div className="text-muted">Назначений пока нет.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
