export default function Pagination({ page, pageSize, total, onPageChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < pages;

  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(pages, start + windowSize - 1);
  if (end - start < windowSize - 1) {
    start = Math.max(1, end - windowSize + 1);
  }

  const nums = [];
  for (let i = start; i <= end; i += 1) nums.push(i);

  return (
    <div className="gc-pagination">
      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
      >
        {"<<"}
      </button>
      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
        {"<"}
      </button>

      {start > 1 && <span className="gc-pagination__dots">...</span>}
      {nums.map((n) => (
        <button
          key={n}
          className={`btn btn-sm ${n === page ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => onPageChange(n)}
        >
          {n}
        </button>
      ))}
      {end < pages && <span className="gc-pagination__dots">...</span>}

      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        {">"}
      </button>
      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onPageChange(pages)}
        disabled={!canNext}
      >
        {">>"}
      </button>
    </div>
  );
}
