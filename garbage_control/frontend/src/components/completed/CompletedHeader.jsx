export default function CompletedHeader({ total, loading, onRefresh }) {
  return (
    <div className="d-flex align-items-end justify-content-between mb-3">
      <div>
        <h4 className="mb-1">Выполненные работы</h4>
        <div className="gc-muted">Общий список завершенных заявок</div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <div className="gc-pill">Всего: {total}</div>
        <button className="btn btn-outline-secondary btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? "..." : "Обновить"}
        </button>
      </div>
    </div>
  );
}
