export const STATUS_LABELS = {
  CREATED: "Создана",
  VERIFIED: "Назначена",
  IN_PROGRESS: "В прогрессе",
  ON_CHECK: "На проверке",
  COMPLETED: "Завершена",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

export function statusClass(status) {
  return `gc-status gc-status--${status || "UNKNOWN"}`;
}
