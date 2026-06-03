const STATUS_ORDER = ["CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED"];

export function getStatusProgress(status) {
  if (status === "TRANSFERRED") return 100;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}
