export const STATUS_LABELS = {
  CREATED: "\u0421\u043e\u0437\u0434\u0430\u043d\u0430",
  VERIFIED: "\u0412\u0435\u0440\u0438\u0444\u0438\u0446\u0438\u0440\u043e\u0432\u0430\u043d\u0430",
  IN_PROGRESS: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
  ON_CHECK: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
  COMPLETED: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
  TRANSFERRED: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u0430 \u043f\u043e \u043f\u0440\u0438\u043d\u0430\u0434\u043b\u0435\u0436\u043d\u043e\u0441\u0442\u0438",
};

export const HANDLING_MODE_LABELS = {
  CLEANUP: "\u0423\u0431\u043e\u0440\u043a\u0430",
  EXTERNAL_TRANSFER: "\u0412\u043d\u0435\u0448\u043d\u044f\u044f \u043f\u0435\u0440\u0435\u0434\u0430\u0447\u0430",
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
