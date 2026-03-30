function formatPointLabel(period) {
  if (!period) return "";
  const date = new Date(period);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
}

export default function StatsTimelineChart({ items }) {
  if (!items.length) {
    return (
      <div className="gc-card gc-card--soft p-3">
        <div className="fw-semibold mb-2">Динамика обращений</div>
        <div className="text-muted">Нет данных для выбранных фильтров.</div>
      </div>
    );
  }

  const width = 760;
  const height = 220;
  const paddingX = 36;
  const paddingY = 28;
  const maxValue = Math.max(...items.map((item) => Number(item.count || 0)), 1);
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  const points = items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : paddingX + (usableWidth * index) / (items.length - 1);
    const y = height - paddingY - ((Number(item.count || 0) / maxValue) * usableHeight);
    return { x, y, label: formatPointLabel(item.period), value: Number(item.count || 0) };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="gc-card gc-card--soft p-3">
      <div className="fw-semibold mb-2">Динамика обращений</div>
      <div className="text-muted small mb-3">
        Количество созданных заявок по месяцам с учетом выбранных фильтров.
      </div>
      <div className="gc-timeline-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="gc-timeline-chart__svg">
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            className="gc-timeline-chart__axis"
          />
          <polyline fill="none" points={polyline} className="gc-timeline-chart__line" />
          {points.map((point) => (
            <g key={`${point.label}-${point.value}`}>
              <circle cx={point.x} cy={point.y} r="4" className="gc-timeline-chart__point" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="gc-timeline-chart__value">
                {point.value}
              </text>
              <text x={point.x} y={height - 8} textAnchor="middle" className="gc-timeline-chart__label">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
