export const STATUS_LABELS = {
  CREATED: "Создана",
  VERIFIED: "Верифицирована",
  IN_PROGRESS: "В работе",
  ON_CHECK: "На проверке",
  COMPLETED: "Завершена",
  TRANSFERRED: "Передана по принадлежности",
};

export const HANDLING_MODE_LABELS = {
  CLEANUP: "Уборка",
  EXTERNAL_TRANSFER: "Внешняя передача",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

export function handlingModeLabel(mode) {
  return HANDLING_MODE_LABELS[mode] || mode || "-";
}

export function statusClass(status) {
  return `gc-status gc-status--${status || "UNKNOWN"}`;
}
