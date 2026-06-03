function formatMetric(value, suffix = "") {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value}${suffix}`;
}

export default function StatsSummaryCards({
  total,
  active,
  completed,
  transferred,
  completionRate,
  transferRate,
  avgHours,
  reworkRequests,
}) {
  const cards = [
    { title: "Всего заявок", value: formatMetric(total) },
    { title: "Активные", value: formatMetric(active) },
    { title: "Завершено", value: formatMetric(completed) },
    { title: "Передано", value: formatMetric(transferred) },
    { title: "Доля завершенных", value: formatMetric(completionRate, "%") },
    { title: "Доля переданных", value: formatMetric(transferRate, "%") },
    { title: "Среднее время решения", value: formatMetric(avgHours, " ч") },
    { title: "С доработкой", value: formatMetric(reworkRequests) },
  ];

  return (
    <div className="gc-stats-grid">
      {cards.map((card) => (
        <div key={card.title} className="gc-stat-card">
          <div className="gc-muted">{card.title}</div>
          <div className="gc-stat-value">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
