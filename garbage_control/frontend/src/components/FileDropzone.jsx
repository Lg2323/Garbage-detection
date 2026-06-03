import { useEffect, useRef, useState } from "react";

export default function FileDropzone({
  label = "Фото",
  hint = "Перетащите файл сюда или нажмите для выбора",
  buttonLabel = "Выбрать",
  accept = "image/*",
  capture = "environment",
  file,
  onChange,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [file]);

  const pickFile = () => {
    inputRef.current?.click();
  };

  const handleFiles = (files) => {
    const selected = files?.[0] ?? null;
    if (selected) {
      onChange?.(selected);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setActive(false);
    handleFiles(e.dataTransfer?.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setActive(true);
  };

  const onDragLeave = () => setActive(false);

  const fileMeta = file
    ? `${file.name} • ${Math.max(1, Math.round(file.size / 1024))} KB`
    : hint;

  return (
    <div
      className={[
        "gc-dropzone",
        compact ? "gc-dropzone--compact" : "",
        active ? "gc-dropzone--active" : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={pickFile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pickFile();
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={inputRef}
        className="gc-dropzone__input"
        type="file"
        accept={accept}
        capture={capture}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="gc-dropzone__row">
        <div>
          <div className="gc-dropzone__label">{label}</div>
          <div className="gc-dropzone__meta">{fileMeta}</div>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            pickFile();
          }}
        >
          {file ? "Заменить" : buttonLabel}
        </button>
      </div>
    </div>
  );
}
