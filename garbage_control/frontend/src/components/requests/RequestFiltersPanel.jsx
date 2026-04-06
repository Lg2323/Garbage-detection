import {
  REQUEST_HANDLING_MODE_OPTIONS,
  REQUEST_SORT_OPTIONS,
  REQUEST_STATUS_OPTIONS,
} from "../../utils/requestFilters";

export default function RequestFiltersPanel({
  value,
  onChange,
  onReset,
  loading = false,
  searchPlaceholder = "Поиск по id, названию, адресу или городу",
  showStatus = true,
  showCity = true,
  showHandlingMode = false,
  showCreatedRange = true,
  showUpdatedRange = false,
  createdLabel = "Дата создания",
  updatedLabel = "Дата обновления",
  sortOptions = REQUEST_SORT_OPTIONS,
  extraFields = null,
}) {
  return (
    <div className="gc-filter-panel mb-3">
      <div className="row g-2">
        <div className="col-xl-4 col-lg-6">
          <label className="gc-filter-panel__label">Поиск</label>
          <input
            className="form-control"
            placeholder={searchPlaceholder}
            value={value.q}
            onChange={(event) => onChange("q", event.target.value)}
          />
        </div>

        {showStatus && (
          <div className="col-xl-2 col-md-6">
            <label className="gc-filter-panel__label">Статус</label>
            <select
              className="form-select"
              value={value.status}
              onChange={(event) => onChange("status", event.target.value)}
            >
              <option value="">Все статусы</option>
              {REQUEST_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showCity && (
          <div className="col-xl-3 col-md-6">
            <label className="gc-filter-panel__label">Город</label>
            <input
              className="form-control"
              placeholder="Например, Москва"
              value={value.city}
              onChange={(event) => onChange("city", event.target.value)}
            />
          </div>
        )}

        {showHandlingMode && (
          <div className="col-xl-3 col-md-6">
            <label className="gc-filter-panel__label">Режим обработки</label>
            <select
              className="form-select"
              value={value.handling_mode}
              onChange={(event) => onChange("handling_mode", event.target.value)}
            >
              <option value="">Все режимы</option>
              {REQUEST_HANDLING_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showCreatedRange && (
          <>
            <div className="col-xl-2 col-md-6">
              <label className="gc-filter-panel__label">{createdLabel} c</label>
              <input
                className="form-control"
                type="date"
                value={value.created_from}
                onChange={(event) => onChange("created_from", event.target.value)}
              />
            </div>
            <div className="col-xl-2 col-md-6">
              <label className="gc-filter-panel__label">{createdLabel} по</label>
              <input
                className="form-control"
                type="date"
                value={value.created_to}
                onChange={(event) => onChange("created_to", event.target.value)}
              />
            </div>
          </>
        )}

        {showUpdatedRange && (
          <>
            <div className="col-xl-2 col-md-6">
              <label className="gc-filter-panel__label">{updatedLabel} c</label>
              <input
                className="form-control"
                type="date"
                value={value.updated_from}
                onChange={(event) => onChange("updated_from", event.target.value)}
              />
            </div>
            <div className="col-xl-2 col-md-6">
              <label className="gc-filter-panel__label">{updatedLabel} по</label>
              <input
                className="form-control"
                type="date"
                value={value.updated_to}
                onChange={(event) => onChange("updated_to", event.target.value)}
              />
            </div>
          </>
        )}

        {extraFields}

        <div className="col-xl-3 col-md-6">
          <label className="gc-filter-panel__label">Сортировка</label>
          <select
            className="form-select"
            value={value.ordering}
            onChange={(event) => onChange("ordering", event.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="gc-filter-panel__actions">
        <button type="button" className="btn btn-outline-secondary" onClick={onReset} disabled={loading}>
          Сбросить
        </button>
        {loading ? <span className="text-muted small">Обновление...</span> : null}
      </div>
    </div>
  );
}
