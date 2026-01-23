import { useState } from "react";
import http from "../api/http";

export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(null);

    if (!title.trim()) return setMsg({ type: "danger", text: "Введите описание" });
    if (!photo) return setMsg({ type: "danger", text: "Прикрепите фото" });
    if (!navigator.geolocation) return setMsg({ type: "danger", text: "Геолокация не поддерживается" });

    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const form = new FormData();
        form.append("title", title);
        form.append("latitude", pos.coords.latitude);
        form.append("longitude", pos.coords.longitude);
        form.append("before_photo", photo);

        try {
          await http.post("/api/requests/", form, { headers: { "Content-Type": "multipart/form-data" } });
          setMsg({ type: "success", text: "Заявка создана" });
          setTitle("");
          setPhoto(null);
        } catch (e) {
          setMsg({ type: "danger", text: "Ошибка отправки: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setMsg({ type: "danger", text: "Геолокация недоступна: " + err.message });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="gc-card gc-card--soft p-4">
      <div className="mb-3">
        <h4 className="mb-1">Новая заявка</h4>
        <div className="gc-muted">Опиши проблему, прикрепи фото — координаты возьмём автоматически</div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="mb-3">
        <label className="form-label gc-muted">Описание</label>
        <input className="form-control" placeholder="Например: мусор у входа в парк" value={title} onChange={(e)=>setTitle(e.target.value)} />
      </div>

      <div className="mb-3">
        <label className="form-label gc-muted">Фото</label>
        <input className="form-control" type="file" accept="image/*" onChange={(e)=>setPhoto(e.target.files?.[0] ?? null)} />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={busy}>
        {busy ? "Отправляю..." : "Отправить"}
      </button>
    </div>
  );
}
