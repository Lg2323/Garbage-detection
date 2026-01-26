export default function Notice({ type = "info", title, text, onClose }) {
  if (!text) return null;
  return (
    <div className={`gc-toast gc-toast--${type}`}>
      <div className="gc-toast__body">
        {title && <div className="gc-toast__title">{title}</div>}
        <div className="gc-toast__text">{text}</div>
      </div>
      {onClose && (
        <button className="gc-toast__close" onClick={onClose} aria-label="Закрыть">
          <i className="bi bi-x-lg" />
        </button>
      )}
    </div>
  );
}
