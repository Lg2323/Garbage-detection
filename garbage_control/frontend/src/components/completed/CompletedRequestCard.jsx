import { statusClass, statusLabel } from "../../ui/status";

export default function CompletedRequestCard({ item, position, onPositionChange }) {
  const hasBefore = Boolean(item.before_photo);
  const hasAfter = Boolean(item.after_photo);

  return (
    <div className="gc-card gc-completed-card p-3">
      <div className="gc-compare mb-3">
        {hasBefore ? (
          <img src={item.before_photo} alt="before" className="gc-compare__img" />
        ) : (
          <div className="gc-compare__empty">Нет фото "до"</div>
        )}

        {hasAfter && (
          <div className="gc-compare__after" style={{ width: `${position}%` }}>
            <img src={item.after_photo} alt="after" className="gc-compare__img" />
          </div>
        )}

        {hasBefore && hasAfter && (
          <>
            {/* Slider for before/after comparison */}
            <input
              className="gc-compare__range"
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(e) => onPositionChange(Number(e.target.value))}
              aria-label="Сравнение до и после"
            />
            <div className="gc-compare__handle" style={{ left: `${position}%` }} />
            <span className="gc-compare__label gc-compare__label--before">До</span>
            <span className="gc-compare__label gc-compare__label--after">После</span>
          </>
        )}
      </div>

      <div className="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="fw-semibold">{item.title}</div>
          <div className="gc-muted">#{item.id}</div>
          {(item.city || item.address) && (
            <div className="gc-muted" style={{ fontSize: 12 }}>
              {[item.city, item.address].filter(Boolean).join(" / ")}
            </div>
          )}
        </div>
        <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
      </div>

      <div className="gc-muted mt-2">
        Завершена: {item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}
      </div>
    </div>
  );
}
