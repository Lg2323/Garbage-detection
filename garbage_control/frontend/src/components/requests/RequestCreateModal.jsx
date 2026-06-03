import Notice from "../Notice";
import FileDropzone from "../FileDropzone";

export default function RequestCreateModal({
  open,
  title,
  address,
  city,
  photo,
  busy,
  detectingCity,
  message,
  onClose,
  onMessageClose,
  onTitleChange,
  onAddressChange,
  onCityChange,
  onDetectCity,
  onPhotoChange,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="gc-modal">
      <div className="gc-modal__backdrop" onClick={onClose} />
      <div className="gc-modal__content gc-anim gc-anim--up">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="m-0">Новая заявка</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <Notice type={message?.type} text={message?.text} onClose={onMessageClose} />

        <div className="mb-3">
          <label className="form-label gc-muted">Описание</label>
          <input
            className="form-control"
            placeholder="Например: мусор у входа в парк"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label gc-muted">Адрес</label>
          <input
            className="form-control"
            placeholder="Например: ул. Ленина, 10"
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label gc-muted">Город</label>
          <div className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="Например: Москва"
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
            />
            <button className="btn btn-outline-secondary" type="button" onClick={onDetectCity} disabled={detectingCity}>
              {detectingCity ? "..." : "Определить"}
            </button>
          </div>
        </div>

        <div className="mb-3">
          <FileDropzone label="Фото" file={photo} onChange={onPhotoChange} />
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={onSubmit} disabled={busy}>
            {busy ? "Отправляю..." : "Отправить"}
          </button>
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
