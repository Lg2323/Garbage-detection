import { statusLabel } from "../../ui/status";

export default function StatsStatusList({ items }) {
  return (
    <div className="gc-card gc-card--soft p-3 mt-3">
      <div className="fw-semibold mb-2">Статусы заявок</div>
      <div className="d-grid gap-2">
        {items.map((s) => (
          <div key={s.status} className="d-flex align-items-center justify-content-between">
            <span className="gc-muted">{statusLabel(s.status)}</span>
            <span className="fw-semibold">{s.count}</span>
          </div>
        ))}
        {!items.length && <div className="text-muted">-</div>}
      </div>
    </div>
  );
}
