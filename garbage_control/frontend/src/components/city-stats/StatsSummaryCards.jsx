export default function StatsSummaryCards({ total, completed, completionRate, avgHours }) {
  const completion =
    completionRate === null || completionRate === undefined ? "-" : `${completionRate}%`;
  const avg = avgHours === null || avgHours === undefined ? "-" : avgHours;

  return (
    <div className="gc-stats-grid">
      <div className="gc-stat-card">
        <div className="gc-muted">Всего заявок</div>
        <div className="gc-stat-value">{total ?? "-"}</div>
      </div>
      <div className="gc-stat-card">
        <div className="gc-muted">Завершено</div>
        <div className="gc-stat-value">{completed ?? "-"}</div>
      </div>
      <div className="gc-stat-card">
        <div className="gc-muted">Доля завершенных</div>
        <div className="gc-stat-value">{completion}</div>
      </div>
      <div className="gc-stat-card">
        <div className="gc-muted">Среднее время выполнения, час</div>
        <div className="gc-stat-value">{avg}</div>
      </div>
    </div>
  );
}
