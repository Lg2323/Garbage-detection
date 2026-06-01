import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Notice from "../../components/Notice";
import RequestResponsibilityMap from "../../components/maps/RequestResponsibilityMap";
import {
  classifyRequest,
  confirmPrimaryCheck,
  externalTransferRequest,
  getRequest,
  getRequestReferenceOptions,
  returnToWork,
  verifyRequest,
} from "../../api/requests";
import { handlingModeLabel, statusClass, statusLabel } from "../../ui/status";
import { formatApiError } from "../../utils/apiErrors";

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function formatPercent(value) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function includesPolygonMatch(zone) {
  return zone.match_reasons?.some((reason) => normalizeText(reason).includes("полигон"));
}

function buildZoneSearchText(zone) {
  return [
    zone.name,
    zone.organization_name,
    zone.department_name,
    zone.brigade_name,
    zone.territory_type_name,
    zone.comment,
    ...(zone.match_reasons || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
    classification_comment: request?.classification_comment || "",
  };
}

function getStatusEntry(statusHistory, predicate) {
  return (statusHistory || []).find(predicate) || null;
}

function buildPrimaryVerification(verification, statusHistory) {
  const details =
    verification?.details && typeof verification.details === "object" ? verification.details : {};
  const primaryDetails =
    (details.precheck && typeof details.precheck === "object" && details.precheck) ||
    (details.stage === "before" ? details : null);
  const primaryHistory = getStatusEntry(statusHistory, (entry) =>
    normalizeText(entry.comment).includes("ai-предпровер")
  );

  if (!primaryDetails && !primaryHistory) {
    return {
      title: "Первичная AI-проверка",
      tone: "neutral",
      badge: "Нет данных",
      description: "Предпроверка по фото до создания заявки ещё не отображается в карточке.",
      timestamp: null,
      metrics: [],
    };
  }

  if (primaryDetails?.error) {
    return {
      title: "Первичная AI-проверка",
      tone: "danger",
      badge: "Ошибка",
      description: "Автоматическая проверка исходного фото завершилась с ошибкой. Заявку нужно оценить вручную.",
      timestamp: verification?.created_at || primaryHistory?.created_at || null,
      metrics: [],
      note: String(primaryDetails.error),
    };
  }

  if (typeof primaryDetails?.before_count === "number") {
    const foundGarbage = primaryDetails.before_count > 0;
    return {
      title: "Первичная AI-проверка",
      tone: foundGarbage ? "warning" : "success",
      badge: foundGarbage ? "Есть признаки мусора" : "Явных признаков нет",
      description: foundGarbage
        ? "AI нашёл признаки мусора на фото до уборки и передал заявку дальше в обработку."
        : "AI не нашёл явных признаков мусора на фото до уборки. Координатору стоит сверить заявку вручную.",
      timestamp: verification?.created_at || primaryHistory?.created_at || null,
      metrics: [
        { label: "Найдено объектов", value: primaryDetails.before_count },
        { label: "Порог уверенности", value: formatPercent(primaryDetails.conf_threshold) },
      ],
    };
  }

  return {
    title: "Первичная AI-проверка",
    tone: "neutral",
    badge: primaryHistory ? "Выполнена" : "Нет данных",
    description: "Предварительная проверка была выполнена при создании заявки.",
    timestamp: verification?.created_at || primaryHistory?.created_at || null,
    metrics: [],
  };
}

function buildResultVerification(requestItem, verification) {
  if (!requestItem) {
    return {
      title: "Проверка результата уборки",
      tone: "neutral",
      badge: "Загрузка",
      description: "Данные проверки загружаются.",
      timestamp: null,
      metrics: [],
    };
  }

  const details =
    verification?.details && typeof verification.details === "object" ? verification.details : {};
  const resultDetails = details.stage === "before" ? null : details;
  const uploadHistory = getStatusEntry(statusHistoryOrEmpty(requestItem), (entry) =>
    normalizeText(entry.comment).includes("исполнитель загрузил фото результата")
  );
  const finalHistory = getStatusEntry(statusHistoryOrEmpty(requestItem), (entry) =>
    normalizeText(entry.comment).includes("координатор завершил проверку результата")
  );

  if (!requestItem.after_photo) {
    return {
      title: "Проверка результата уборки",
      tone: "neutral",
      badge: "Ожидает фото после",
      description: "Исполнитель ещё не загрузил фото результата, поэтому итоговая AI-проверка не начиналась.",
      timestamp: null,
      metrics: [],
    };
  }

  if (resultDetails?.error) {
    return {
      title: "Проверка результата уборки",
      tone: "danger",
      badge: "Ошибка",
      description: "AI не смог сравнить фото до и после уборки. Нужна ручная проверка результата.",
      timestamp: finalHistory?.created_at || uploadHistory?.created_at || null,
      metrics: [],
      note: String(resultDetails.error),
    };
  }

  if (resultDetails) {
    const waitingForCoordinator = requestItem.status === "ON_CHECK" && !finalHistory;
    return {
      title: "Проверка результата уборки",
      tone: verification?.is_clean ? "success" : "warning",
      badge: waitingForCoordinator
        ? "Ждёт решения координатора"
        : verification?.is_clean
          ? "Результат подтверждён"
          : "Нужна доработка",
      description: waitingForCoordinator
        ? "AI уже сравнил фото до и после уборки. Заявка находится на проверке у координатора."
        : verification?.is_clean
          ? "AI подтверждает, что объём мусора после уборки заметно снизился."
          : "AI не подтвердил достаточную очистку территории. Скорее всего нужна доработка.",
      timestamp: finalHistory?.created_at || uploadHistory?.created_at || null,
      metrics: [
        {
          label: "До уборки",
          value: typeof resultDetails.before_count === "number" ? resultDetails.before_count : "—",
        },
        {
          label: "После уборки",
          value: typeof resultDetails.after_count === "number" ? resultDetails.after_count : "—",
        },
        { label: "Снижение загрязнения", value: formatPercent(resultDetails.reduction ?? verification?.score) },
      ],
    };
  }

  return {
    title: "Проверка результата уборки",
    tone: "neutral",
    badge: "Нет расчёта",
    description: "Фото результата уже загружено, но подробные данные AI-проверки пока не сохранены.",
    timestamp: finalHistory?.created_at || uploadHistory?.created_at || null,
    metrics: [],
  };
}

function statusHistoryOrEmpty(requestItem) {
  return requestItem?.status_history || [];
}

function ZoneMetaItem({ label, value }) {
  return (
    <div className="gc-zone-card__meta-item">
      <div className="gc-zone-card__meta-label">{label}</div>
      <div className="gc-zone-card__meta-value">{value || "—"}</div>
    </div>
  );
}

function VerificationStage({ title, tone, badge, description, timestamp, metrics, note }) {
  return (
    <div className={`gc-verify-stage gc-verify-stage--${tone}`}>
      <div className="gc-verify-stage__header">
        <div>
          <div className="fw-semibold">{title}</div>
          <div className="text-muted small">{description}</div>
        </div>
        <span className={`gc-verify-stage__badge gc-verify-stage__badge--${tone}`}>{badge}</span>
      </div>

      <div className="gc-verify-stage__meta">
        <div className="gc-verify-stage__row">
          <span>Дата</span>
          <span>{formatDateTime(timestamp)}</span>
        </div>
        {metrics.map((metric) => (
          <div key={metric.label} className="gc-verify-stage__row">
            <span>{metric.label}</span>
            <span>{metric.value}</span>
          </div>
        ))}
      </div>

      {note && <div className="gc-verify-stage__note">{note}</div>}
    </div>
  );
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
  const [classificationForm, setClassificationForm] = useState(buildClassificationForm(null));
  const [transferForm, setTransferForm] = useState(INITIAL_TRANSFER_FORM);
  const [primaryConfirmComment, setPrimaryConfirmComment] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneMatchFilter, setZoneMatchFilter] = useState("all");
  const [zoneOrganizationFilter, setZoneOrganizationFilter] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const deferredZoneQuery = useDeferredValue(zoneQuery);

  const load = useCallback(async () => {
    setMsg(null);
    const [requestData, optionsData] = await Promise.all([getRequest(id), getRequestReferenceOptions()]);
    setRequestItem(requestData);
    setOptions(optionsData);
    setClassificationForm(buildClassificationForm(requestData));
    setTransferForm((prev) => ({
      ...INITIAL_TRANSFER_FORM,
      target_organization: requestData?.responsible_organization ?? prev.target_organization,
    }));
  }, [id]);

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка загрузки заявки."),
      });
    });
  }, [load]);

  useEffect(() => {
    setZoneQuery("");
    setZoneMatchFilter("all");
    setZoneOrganizationFilter("");
    setPrimaryConfirmComment("");
  }, [id]);

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

  const responsibilityZones = useMemo(
    () => requestItem?.responsibility_zones || [],
    [requestItem?.responsibility_zones]
  );

  const zoneOrganizations = useMemo(() => {
    const items = new Map();
    for (const zone of responsibilityZones) {
      if (zone.organization && zone.organization_name) {
        items.set(zone.organization, zone.organization_name);
      }
    }
    return Array.from(items.entries())
      .map(([value, label]) => ({ value: String(value), label }))
      .sort((left, right) => left.label.localeCompare(right.label, "ru"));
  }, [responsibilityZones]);

  const filteredZones = useMemo(() => {
    const query = normalizeText(deferredZoneQuery);

    return responsibilityZones.filter((zone) => {
      if (query && !buildZoneSearchText(zone).includes(query)) {
        return false;
      }

      if (zoneOrganizationFilter && String(zone.organization ?? "") !== zoneOrganizationFilter) {
        return false;
      }

      if (zoneMatchFilter === "selected" && !zone.is_selected) {
        return false;
      }

      if (zoneMatchFilter === "polygon" && !includesPolygonMatch(zone)) {
        return false;
      }

      if (
        zoneMatchFilter === "territory" &&
        (includesPolygonMatch(zone) || zone.is_selected)
      ) {
        return false;
      }

      return true;
    });
  }, [deferredZoneQuery, responsibilityZones, zoneMatchFilter, zoneOrganizationFilter]);

  const zoneStats = useMemo(() => {
    const selected = responsibilityZones.filter((zone) => zone.is_selected).length;
    const polygon = responsibilityZones.filter((zone) => includesPolygonMatch(zone)).length;
    return {
      total: responsibilityZones.length,
      selected,
      polygon,
      visible: filteredZones.length,
    };
  }, [filteredZones.length, responsibilityZones]);

  const primaryVerification = useMemo(
    () => buildPrimaryVerification(requestItem?.verification, statusHistoryOrEmpty(requestItem)),
    [requestItem]
  );
  const resultVerification = useMemo(
    () => buildResultVerification(requestItem, requestItem?.verification),
    [requestItem]
  );

  const updateClassificationField = (field, value) => {
    setClassificationForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateTransferField = (field, value) => {
    setTransferForm((prev) => ({ ...prev, [field]: value }));
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
        classification_comment: classificationForm.classification_comment.trim(),
      });
      await load();
      setMsg({ type: "success", text: "Классификация сохранена." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка классификации."),
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
        text: formatApiError(error, "Ошибка внешней передачи."),
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
        text: formatApiError(error, "Ошибка проверки."),
      });
    } finally {
      setBusy(false);
    }
  };

  const doConfirmPrimaryCheck = async () => {
    const comment = primaryConfirmComment.trim();
    if (comment.length < 5) {
      setMsg({ type: "warning", text: "Укажите комментарий для ручного подтверждения." });
      return;
    }

    setMsg(null);
    setBusy(true);
    try {
      await confirmPrimaryCheck(id, { comment });
      setPrimaryConfirmComment("");
      await load();
      setMsg({ type: "success", text: "Заявка вручную подтверждена после первичной AI-проверки." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка ручного подтверждения заявки."),
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
      });
      setReturnComment("");
      await load();
      setMsg({ type: "success", text: "Заявка возвращена на доработку." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: formatApiError(error, "Ошибка возврата в работу."),
      });
    } finally {
      setBusy(false);
    }
  };

  const canOperate = options?.current_user?.role === "COORDINATOR";
  const canConfirmPrimaryCheck = canOperate && requestItem?.status === "CREATED";

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
              <div><b>Координатор:</b> {requestItem.coordinator_username || "—"}</div>
              <div><b>Исполнитель:</b> {requestItem.assigned_worker_username || "—"}</div>
              <div><b>Организация исполнителя:</b> {requestItem.assigned_worker_organization_name || "—"}</div>
              <div><b>Подразделение исполнителя:</b> {requestItem.assigned_worker_department_name || "—"}</div>
              <div><b>Субъект РФ:</b> {requestItem.federal_subject_name || "—"}</div>
              <div><b>Муниципалитет:</b> {requestItem.municipality_name || "—"}</div>
              <div><b>Населённый пункт:</b> {requestItem.locality_name || "—"}</div>
              <div><b>Тип территории:</b> {requestItem.territory_type_name || "—"}</div>
              <div><b>Тип собственности:</b> {requestItem.ownership_type_name || "—"}</div>
              <div><b>Организация:</b> {requestItem.responsible_organization_name || "—"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "—"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "—"}</div>
              <div><b>Адрес:</b> {requestItem.address || "—"}</div>
              <div><b>Город:</b> {requestItem.city || "—"}</div>
              <div><b>Координаты:</b> {requestItem.latitude ?? "—"}, {requestItem.longitude ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Контур исполнения</div>
            <div className="gc-info-block mb-3">
              <div><b>Ответственная организация:</b> {requestItem.responsible_organization_name || "не выбрана"}</div>
              <div><b>Подразделение:</b> {requestItem.responsible_department_name || "—"}</div>
              <div><b>Бригада:</b> {requestItem.assigned_brigade_name || "—"}</div>
            </div>
            {requestItem.responsible_organization ? (
              <div className="text-muted small mb-3">
                После маршрутизации внутреннее распределение по подразделению, бригаде и исполнителю выполняют руководитель организации и руководитель подразделения.
              </div>
            ) : (
              <div className="text-muted small mb-3">
                Сначала определите ответственную организацию по территории и зоне ответственности.
              </div>
            )}

            <div className="fw-semibold mb-2">Внутреннее распределение</div>
            <div className="text-muted small">
              Координатор назначает только организацию. Подразделение, бригаду и исполнителя назначает менеджер организации.
            </div>

            <div className="gc-profile__divider" />

            <div className="fw-semibold mb-2">Контроль результата</div>
            {canOperate ? (
              <>
                <button className="btn btn-outline-primary" onClick={doVerify} disabled={busy || !requestItem.after_photo}>
                  Запустить проверку
                </button>
                {!requestItem.after_photo && (
                  <div className="text-muted small mt-2">Фото результата ещё не загружено исполнителем.</div>
                )}
              </>
            ) : (
              <div className="text-muted small">
                Администратор может просматривать заявку, но не выполняет операционные действия координатора.
              </div>
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
          <span className="gc-pill">Показано зон: {zoneStats.visible} из {zoneStats.total}</span>
        </div>

        <div className="gc-zone-toolbar">
          <div className="gc-zone-toolbar__stats">
            <span className="gc-pill">Всего: {zoneStats.total}</span>
            <span className="gc-pill">Выбранные: {zoneStats.selected}</span>
            <span className="gc-pill">По полигону: {zoneStats.polygon}</span>
          </div>
          <div className="gc-zone-toolbar__filters">
            <div>
              <label className="form-label">Поиск по зонам</label>
              <input
                className="form-control"
                value={zoneQuery}
                onChange={(event) => setZoneQuery(event.target.value)}
                placeholder="Название, организация, подразделение"
              />
            </div>
            <div>
              <label className="form-label">Тип совпадения</label>
              <select
                className="form-select"
                value={zoneMatchFilter}
                onChange={(event) => setZoneMatchFilter(event.target.value)}
              >
                <option value="all">Все зоны</option>
                <option value="selected">Только выбранные</option>
                <option value="polygon">Совпадение по полигону</option>
                <option value="territory">Совпадение по территории</option>
              </select>
            </div>
            <div>
              <label className="form-label">Организация</label>
              <select
                className="form-select"
                value={zoneOrganizationFilter}
                onChange={(event) => setZoneOrganizationFilter(event.target.value)}
              >
                <option value="">Все организации</option>
                {zoneOrganizations.map((organization) => (
                  <option key={organization.value} value={organization.value}>
                    {organization.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                type="button"
                onClick={() => {
                  setZoneQuery("");
                  setZoneMatchFilter("all");
                  setZoneOrganizationFilter("");
                }}
                disabled={!zoneQuery && zoneMatchFilter === "all" && !zoneOrganizationFilter}
              >
                Сбросить фильтр
              </button>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-xl-7">
            <RequestResponsibilityMap
              latitude={requestItem.latitude}
              longitude={requestItem.longitude}
              zones={filteredZones}
            />
          </div>
          <div className="col-xl-5">
            <div className="gc-zone-list">
              {filteredZones.length ? (
                filteredZones.map((zone) => (
                  <div key={zone.id} className={`gc-zone-card ${zone.is_selected ? "gc-zone-card--selected" : ""}`}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <div className="fw-semibold">{zone.name}</div>
                        <div className="text-muted small">
                          {zone.is_selected
                            ? "Эта зона уже участвует в текущем маршруте заявки."
                            : "Зона подходит по территории и может быть использована для маршрутизации."}
                        </div>
                      </div>
                      {zone.is_selected && <span className="gc-pill">Выбрана</span>}
                    </div>

                    <div className="gc-zone-card__meta">
                      <ZoneMetaItem label="Организация" value={zone.organization_name} />
                      <ZoneMetaItem label="Подразделение" value={zone.department_name} />
                      <ZoneMetaItem label="Бригада" value={zone.brigade_name} />
                      <ZoneMetaItem label="Тип территории" value={zone.territory_type_name} />
                    </div>

                    {!!zone.match_reasons?.length && (
                      <div className="gc-badge-stack mt-3">
                        {zone.match_reasons.map((reason) => (
                          <span key={reason} className="gc-badge-soft">{reason}</span>
                        ))}
                      </div>
                    )}

                    {zone.comment && <div className="gc-zone-card__comment mt-3">{zone.comment}</div>}
                  </div>
                ))
              ) : responsibilityZones.length ? (
                <div className="gc-info-block">
                  По текущим фильтрам подходящие зоны не найдены. Сбросьте фильтр или измените условия поиска.
                </div>
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

      {canOperate ? (
        <>
          <div className="card p-3">
            <div className="fw-semibold mb-3">Классификация и маршрутизация</div>
            <div className="row g-3">
              <div className="col-lg-4">
                <label className="form-label">Адрес</label>
                <input
                  className="form-control"
                  value={classificationForm.address}
                  onChange={(event) => updateClassificationField("address", event.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label">Субъект РФ</label>
                <select
                  className="form-select"
                  value={classificationForm.federal_subject ?? ""}
                  onChange={(event) => updateClassificationField("federal_subject", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {options.federal_subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Муниципалитет</label>
                <select
                  className="form-select"
                  value={classificationForm.municipality ?? ""}
                  onChange={(event) => updateClassificationField("municipality", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {municipalities.map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>{municipality.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Населённый пункт</label>
                <select
                  className="form-select"
                  value={classificationForm.locality ?? ""}
                  onChange={(event) => updateClassificationField("locality", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {localities.map((locality) => (
                    <option key={locality.id} value={locality.id}>{locality.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Тип территории</label>
                <select
                  className="form-select"
                  value={classificationForm.territory_type ?? ""}
                  onChange={(event) => updateClassificationField("territory_type", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {options.territory_types.map((territoryType) => (
                    <option key={territoryType.id} value={territoryType.id}>{territoryType.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Тип собственности</label>
                <select
                  className="form-select"
                  value={classificationForm.ownership_type ?? ""}
                  onChange={(event) => updateClassificationField("ownership_type", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {options.ownership_types.map((ownershipType) => (
                    <option key={ownershipType.id} value={ownershipType.id}>{ownershipType.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Режим обработки</label>
                <select
                  className="form-select"
                  value={classificationForm.handling_mode}
                  onChange={(event) => updateClassificationField("handling_mode", event.target.value)}
                >
                  {(options.choices?.handling_mode || []).map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Организация</label>
                <select
                  className="form-select"
                  value={classificationForm.responsible_organization ?? ""}
                  onChange={(event) => updateClassificationField("responsible_organization", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {options.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Комментарий классификации</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={classificationForm.classification_comment}
                  onChange={(event) => updateClassificationField("classification_comment", event.target.value)}
                />
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
                <select
                  className="form-select"
                  value={transferForm.target_organization ?? ""}
                  onChange={(event) => updateTransferField("target_organization", event.target.value || null)}
                >
                  <option value="">Не выбрано</option>
                  {options.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-4">
                <label className="form-label">Получатель текстом</label>
                <input
                  className="form-control"
                  value={transferForm.recipient_name}
                  onChange={(event) => updateTransferField("recipient_name", event.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label">Контакт получателя</label>
                <input
                  className="form-control"
                  value={transferForm.recipient_contact}
                  onChange={(event) => updateTransferField("recipient_contact", event.target.value)}
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label">Исходящий номер</label>
                <input
                  className="form-control"
                  value={transferForm.outgoing_number}
                  onChange={(event) => updateTransferField("outgoing_number", event.target.value)}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Основание передачи</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={transferForm.transfer_reason}
                  onChange={(event) => updateTransferField("transfer_reason", event.target.value)}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Комментарий</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={transferForm.comment}
                  onChange={(event) => updateTransferField("comment", event.target.value)}
                />
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
              <div className="col-lg-12 d-flex justify-content-end">
                <button className="btn btn-outline-danger" onClick={doReturnToWork} disabled={busy}>
                  Вернуть на доработку
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card p-3">
          <div className="fw-semibold mb-2">Режим просмотра</div>
          <div className="text-muted">
            Администратор видит все данные заявки и историю, но не подменяет координатора в обычном процессе.
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-xl-5">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="fw-semibold">AI-проверка</div>
                <div className="text-muted small">
                  AI помогает с первичной оценкой и сравнением результата, но итоговое решение принимает координатор.
                </div>
              </div>
              <span className={statusClass(requestItem.status)}>{statusLabel(requestItem.status)}</span>
            </div>

            <div className="gc-verify-grid">
              <VerificationStage {...primaryVerification} />
              <VerificationStage {...resultVerification} />
            </div>

            {canConfirmPrimaryCheck && (
              <div className="gc-info-block mt-3">
                <div className="fw-semibold mb-2">Ручное подтверждение первичной проверки</div>
                <textarea
                  className="form-control"
                  rows={3}
                  value={primaryConfirmComment}
                  onChange={(event) => setPrimaryConfirmComment(event.target.value)}
                  placeholder="Почему заявка подтверждается вручную"
                />
                <div className="d-flex justify-content-end mt-2">
                  <button
                    className="btn btn-outline-primary"
                    onClick={doConfirmPrimaryCheck}
                    disabled={busy || primaryConfirmComment.trim().length < 5}
                  >
                    Подтвердить заявку вручную
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="col-xl-3">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">История статусов</div>
            <div className="gc-timeline">
              {requestItem.status_history?.length ? requestItem.status_history.map((entry) => (
                <div key={entry.id} className="gc-timeline__item">
                  <div className="fw-semibold">{statusLabel(entry.status)}</div>
                  <div className="text-muted small">
                    {entry.changed_by_username || "Система"} • {formatDateTime(entry.created_at)}
                  </div>
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
                  <div className="text-muted small">
                    {assignment.assigned_by_username || "Система"} • {formatDateTime(assignment.created_at)}
                  </div>
                  <div>{assignment.assigned_organization_name || assignment.assigned_department_name || assignment.assigned_worker_username || "—"}</div>
                </div>
              ))}
              {requestItem.external_transfers?.map((transfer) => (
                <div key={`transfer-${transfer.id}`} className="gc-timeline__item">
                  <div className="fw-semibold">Передача #{transfer.id}</div>
                  <div className="text-muted small">
                    {transfer.created_by_username || "Система"} • {formatDateTime(transfer.sent_at)}
                  </div>
                  <div>{transfer.target_organization_name || transfer.recipient_name || "—"}</div>
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
