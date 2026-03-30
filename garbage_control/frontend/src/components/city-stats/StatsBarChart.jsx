export default function StatsBarChart({
  title,
  subtitle = "",
  items,
  valueKey = "count",
  labelKey = "label",
  emptyText = "Нет данных",
}) {
  const normalizedItems = (items || []).filter((item) => Number(item[valueKey] || 0) > 0);
  const maxValue = Math.max(...normalizedItems.map((item) => Number(item[valueKey] || 0)), 0);

  return (
    <div className="gc-card gc-card--soft p-3">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <div className="fw-semibold">{title}</div>
          {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
        </div>
      </div>

      {normalizedItems.length ? (
        <div className="gc-bars">
          {normalizedItems.map((item) => {
            const value = Number(item[valueKey] || 0);
            const width = maxValue ? Math.max((value / maxValue) * 100, 6) : 0;
            return (
              <div key={`${item[labelKey]}-${value}`} className="gc-bars__row">
                <div className="gc-bars__label" title={item[labelKey]}>
                  {item[labelKey]}
                </div>
                <div className="gc-bars__track">
                  <div className="gc-bars__fill" style={{ width: `${width}%` }} />
                </div>
                <div className="gc-bars__value">{value}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted">{emptyText}</div>
      )}
    </div>
  );
}
