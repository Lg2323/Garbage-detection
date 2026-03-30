import { statusClass, statusLabel } from "../../ui/status";
import { getStatusProgress } from "./status";

const StatusBadge = ({ status }) => (
  <span className={statusClass(status)}>{statusLabel(status)}</span>
);

export default function RequestsTable({ items }) {
  return (
    <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="gc-muted">
              <th style={{ width: 90 }}>#</th>
              <th>Описание</th>
              <th style={{ width: 220 }}>Статус</th>
              <th style={{ width: 180 }}>Прогресс</th>
              <th style={{ width: 220 }}>Создана</th>
            </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td className="fw-semibold">#{r.id}</td>
              <td>
                <div className="fw-semibold">{r.title}</div>
                {(r.city || r.address) && (
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                    {[r.city, r.address].filter(Boolean).join(" / ")}
                  </div>
                )}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                <div className="gc-progress">
                  <div className="gc-progress__bar" style={{ width: `${getStatusProgress(r.status)}%` }} />
                </div>
                <div className="gc-muted" style={{ fontSize: 12 }}>
                  {statusLabel(r.status)}
                </div>
              </td>
              <td className="gc-muted">
                {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5} className="text-muted">Пока нет заявок</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
