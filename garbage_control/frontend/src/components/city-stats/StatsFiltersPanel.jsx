function SelectField({ label, value, onChange, options, emptyLabel = "Все" }) {
  return (
    <div className="col-xl-3 col-md-6">
      <label className="gc-filter-panel__label">{label}</label>
      <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function StatsFiltersPanel({
  value,
  filtersData,
  onChange,
  onApply,
  onReset,
  loading = false,
}) {
  const municipalities = value.federal_subject
    ? (filtersData?.municipalities || []).filter(
        (item) => String(item.federal_subject_id) === String(value.federal_subject)
      )
    : filtersData?.municipalities || [];

  const localities = value.municipality
    ? (filtersData?.localities || []).filter(
        (item) => String(item.municipality_id) === String(value.municipality)
      )
    : filtersData?.localities || [];

  const workerOptions = [
    { value: "unassigned", label: "Не назначен" },
    ...(filtersData?.workers || []),
  ];

  return (
    <form
      className="gc-filter-panel mb-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="row g-2">
        <div className="col-xl-4 col-lg-6">
          <label className="gc-filter-panel__label">Поиск</label>
          <input
            className="form-control"
            placeholder="По id, названию, адресу, городу, исполнителю или организации"
            value={value.q}
            onChange={(event) => onChange("q", event.target.value)}
          />
        </div>

        <SelectField
          label="Город"
          value={value.city}
          onChange={(nextValue) => onChange("city", nextValue)}
          options={(filtersData?.cities || []).map((city) => ({ value: city, label: city }))}
          emptyLabel="Все города"
        />

        <SelectField
          label="Статус"
          value={value.status}
          onChange={(nextValue) => onChange("status", nextValue)}
          options={filtersData?.statuses || []}
          emptyLabel="Все статусы"
        />

        <SelectField
          label="Режим обработки"
          value={value.handling_mode}
          onChange={(nextValue) => onChange("handling_mode", nextValue)}
          options={filtersData?.handling_modes || []}
          emptyLabel="Все режимы"
        />

        <SelectField
          label="Субъект РФ"
          value={value.federal_subject}
          onChange={(nextValue) => {
            onChange("federal_subject", nextValue);
            onChange("municipality", "");
            onChange("locality", "");
          }}
          options={filtersData?.federal_subjects || []}
          emptyLabel="Все субъекты"
        />

        <SelectField
          label="Муниципалитет"
          value={value.municipality}
          onChange={(nextValue) => {
            onChange("municipality", nextValue);
            onChange("locality", "");
          }}
          options={municipalities}
          emptyLabel="Все муниципалитеты"
        />

        <SelectField
          label="Населенный пункт"
          value={value.locality}
          onChange={(nextValue) => onChange("locality", nextValue)}
          options={localities}
          emptyLabel="Все населенные пункты"
        />

        <SelectField
          label="Тип территории"
          value={value.territory_type}
          onChange={(nextValue) => onChange("territory_type", nextValue)}
          options={filtersData?.territory_types || []}
          emptyLabel="Все типы"
        />

        <SelectField
          label="Тип собственности"
          value={value.ownership_type}
          onChange={(nextValue) => onChange("ownership_type", nextValue)}
          options={filtersData?.ownership_types || []}
          emptyLabel="Все типы"
        />

        <SelectField
          label="Организация"
          value={value.responsible_organization}
          onChange={(nextValue) => onChange("responsible_organization", nextValue)}
          options={filtersData?.organizations || []}
          emptyLabel="Все организации"
        />

        <SelectField
          label="Исполнитель"
          value={value.assigned_worker}
          onChange={(nextValue) => onChange("assigned_worker", nextValue)}
          options={workerOptions}
          emptyLabel="Все исполнители"
        />

        <div className="col-xl-3 col-md-6">
          <label className="gc-filter-panel__label">Дата создания с</label>
          <input
            className="form-control"
            type="date"
            value={value.created_from}
            onChange={(event) => onChange("created_from", event.target.value)}
          />
        </div>

        <div className="col-xl-3 col-md-6">
          <label className="gc-filter-panel__label">Дата создания по</label>
          <input
            className="form-control"
            type="date"
            value={value.created_to}
            onChange={(event) => onChange("created_to", event.target.value)}
          />
        </div>

        <div className="col-xl-3 col-md-6">
          <label className="gc-filter-panel__label">Дата обновления с</label>
          <input
            className="form-control"
            type="date"
            value={value.updated_from}
            onChange={(event) => onChange("updated_from", event.target.value)}
          />
        </div>

        <div className="col-xl-3 col-md-6">
          <label className="gc-filter-panel__label">Дата обновления по</label>
          <input
            className="form-control"
            type="date"
            value={value.updated_to}
            onChange={(event) => onChange("updated_to", event.target.value)}
          />
        </div>
      </div>

      <div className="gc-filter-panel__actions">
        <button type="button" className="btn btn-outline-secondary" onClick={onReset} disabled={loading}>
          Сбросить
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Загрузка..." : "Применить"}
        </button>
      </div>
    </form>
  );
}
