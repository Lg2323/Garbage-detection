export default function RequestsHeader({ hasActive, total, onCreate }) {
  return (
    <div className="d-flex align-items-end justify-content-between mb-3">
      <div>
        <h4 className="mb-1">Заявки</h4>
        <div className="gc-muted">Список обращений и их статусы</div>
      </div>
      <div className="d-flex align-items-center gap-2">
        {hasActive && <span className="gc-work">Идет работа по заявкам</span>}
        <div className="gc-pill">Всего: {total}</div>
        <button className="btn btn-primary btn-sm" onClick={onCreate}>
          Создать заявку
        </button>
      </div>
    </div>
  );
}
