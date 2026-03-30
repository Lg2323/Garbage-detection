import { HANDLING_MODE_LABELS, STATUS_LABELS, handlingModeLabel, statusLabel } from "../ui/status";

export function createRequestFilters(overrides = {}) {
  return {
    q: "",
    status: "",
    city: "",
    handling_mode: "",
    created_from: "",
    created_to: "",
    updated_from: "",
    updated_to: "",
    ordering: "created_at_desc",
    assigned_worker: "",
    ...overrides,
  };
}

export const REQUEST_STATUS_OPTIONS = Object.keys(STATUS_LABELS).map((value) => ({
  value,
  label: statusLabel(value),
}));

export const REQUEST_HANDLING_MODE_OPTIONS = Object.keys(HANDLING_MODE_LABELS).map((value) => ({
  value,
  label: handlingModeLabel(value),
}));

export const REQUEST_SORT_OPTIONS = [
  { value: "created_at_desc", label: "Сначала новые" },
  { value: "created_at_asc", label: "Сначала старые" },
  { value: "updated_at_desc", label: "Недавно обновленные" },
  { value: "updated_at_asc", label: "Давно обновленные" },
  { value: "title_asc", label: "По названию А-Я" },
  { value: "title_desc", label: "По названию Я-А" },
];

export const COMPLETED_SORT_OPTIONS = [
  { value: "updated_at_desc", label: "Сначала недавно завершенные" },
  { value: "updated_at_asc", label: "Сначала давно завершенные" },
  { value: "created_at_desc", label: "Сначала новые заявки" },
  { value: "created_at_asc", label: "Сначала старые заявки" },
  { value: "title_asc", label: "По названию А-Я" },
  { value: "title_desc", label: "По названию Я-А" },
];

export function buildRequestQuery(filters) {
  const params = {};
  const fieldNames = [
    "q",
    "status",
    "city",
    "handling_mode",
    "created_from",
    "created_to",
    "updated_from",
    "updated_to",
    "ordering",
    "assigned_worker",
  ];

  fieldNames.forEach((fieldName) => {
    const rawValue = filters?.[fieldName];
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (value !== "" && value !== null && value !== undefined) {
      params[fieldName] = value;
    }
  });

  return params;
}
