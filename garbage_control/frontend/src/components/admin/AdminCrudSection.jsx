function renderOptionLabel(option, field) {
  if (typeof field.getOptionLabel === "function") {
    return field.getOptionLabel(option);
  }
  if (field.optionLabel && option?.[field.optionLabel] !== undefined) {
    return option[field.optionLabel];
  }
  return option?.name ?? option?.label ?? option?.username ?? `#${option?.id ?? ""}`;
}

function parseFieldValue(field, value) {
  if (field.type === "checkbox") {
    return !!value;
  }
  if (field.type === "multiselect") {
    return Array.isArray(value) ? value : [];
  }
  return value ?? "";
}

function FieldControl({ field, value, options, onChange }) {
  const resolvedOptions = typeof options === "function" ? options() : options || [];

  if (field.type === "textarea") {
    return (
      <textarea
        className="form-control"
        rows={field.rows || 3}
        value={parseFieldValue(field, value)}
        onChange={(event) => onChange(field.name, event.target.value)}
        placeholder={field.placeholder || ""}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className="form-select"
        value={parseFieldValue(field, value)}
        onChange={(event) => onChange(field.name, event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{field.emptyLabel || "Не выбрано"}</option>
        {resolvedOptions.map((option) => (
          <option key={option.id ?? option.value} value={option.id ?? option.value}>
            {renderOptionLabel(option, field)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiselect") {
    const currentValue = parseFieldValue(field, value).map(String);
    return (
      <select
        className="form-select"
        multiple
        value={currentValue}
        onChange={(event) => {
          const next = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
          onChange(field.name, next);
        }}
      >
        {resolvedOptions.map((option) => (
          <option key={option.id ?? option.value} value={option.id ?? option.value}>
            {renderOptionLabel(option, field)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="form-check mt-2">
        <input
          id={field.name}
          className="form-check-input"
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(field.name, event.target.checked)}
        />
        <label className="form-check-label" htmlFor={field.name}>
          {field.checkboxLabel || field.label}
        </label>
      </div>
    );
  }

  return (
    <input
      className="form-control"
      type={field.type || "text"}
      value={parseFieldValue(field, value)}
      onChange={(event) => onChange(field.name, event.target.value)}
      placeholder={field.placeholder || ""}
    />
  );
}

export default function AdminCrudSection({
  title,
  description,
  fields,
  items,
  form,
  filters,
  onFilterChange,
  onFieldChange,
  onSubmit,
  onEdit,
  onDelete,
  onCancelEdit,
  busy = false,
  editingId = null,
}) {
  return (
    <div className="card p-3 gc-admin-section">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <h5 className="mb-1">{title}</h5>
          {description && <div className="text-muted">{description}</div>}
        </div>
        <div className="d-flex align-items-center gap-2">
          <input
            className="form-control"
            style={{ minWidth: 240 }}
            placeholder="Поиск"
            value={filters.q}
            onChange={(event) => onFilterChange("q", event.target.value)}
          />
        </div>
      </div>

      <form className="gc-admin-form-grid mb-4" onSubmit={onSubmit}>
        {fields.map((field) => (
          <div key={field.name} className={field.type === "textarea" ? "gc-admin-form-grid__wide" : ""}>
            {field.type !== "checkbox" && <label className="form-label">{field.label}</label>}
            <FieldControl
              field={field}
              value={form[field.name]}
              options={field.options}
              onChange={onFieldChange}
            />
          </div>
        ))}
        <div className="gc-admin-form-grid__wide d-flex gap-2 justify-content-end">
          {editingId && (
            <button className="btn btn-outline-secondary" type="button" onClick={onCancelEdit} disabled={busy}>
              Отменить
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "..." : editingId ? "Сохранить" : "Создать"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              {fields.slice(0, 4).map((field) => (
                <th key={field.name}>{field.label}</th>
              ))}
              <th style={{ width: 180 }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="fw-semibold">#{item.id}</td>
                {fields.slice(0, 4).map((field) => {
                  const value = item[field.displayField || field.name];
                  const text =
                    field.type === "checkbox"
                      ? value
                        ? "Да"
                        : "Нет"
                      : Array.isArray(value)
                        ? value.map((entry) => entry.username || entry.name || `#${entry.id}`).join(", ")
                        : value ?? "-";
                  return <td key={field.name}>{text || "-"}</td>;
                })}
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => onEdit(item)}>
                      Изменить
                    </button>
                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => onDelete(item)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  Ничего не найдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
