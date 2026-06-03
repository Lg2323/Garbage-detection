export default function StatsStatusList({
  title = "Статусы заявок",
  subtitle = "",
  items,
  total = 0,
  emptyText = "Нет данных по статусам.",
}) {
  return (
    <div className="gc-card gc-card--soft p-3">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <div className="fw-semibold">{title}</div>
          {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
        </div>
      </div>

      {items.length ? (
        <div className="gc-status-list">
          {items.map((item) => (
            <div key={item.status || item.label} className="gc-status-list__row">
              <div className="gc-status-list__meta">
                <span className="gc-status-list__name">{item.label}</span>
                <span className="gc-status-list__numbers">
                  <span>{item.count}</span>
                  <span>{total ? `${item.percent}%` : "0%"}</span>
                </span>
              </div>
              <div className="gc-progress">
                <div className="gc-progress__bar" style={{ width: `${item.percent || 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted">{emptyText}</div>
      )}
    </div>
  );
}
