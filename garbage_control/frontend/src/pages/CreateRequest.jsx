import { useState } from "react";
import http from "../api/http";
import Notice from "../components/Notice";
import FileDropzone from "../components/FileDropzone";

export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(null);

    if (!title.trim()) return setMsg({ type: "warning", text: "Введите описание" });
    if (!photo) return setMsg({ type: "warning", text: "Прикрепите фото" });
    if (!navigator.geolocation) return setMsg({ type: "danger", text: "Геолокация не поддерживается" });

    console.info("[REQUEST] create start", { titleLength: title.trim().length, hasPhoto: !!photo });
    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        console.info("[REQUEST] geolocation success");
        const form = new FormData();
        form.append("title", title);
        form.append("latitude", pos.coords.latitude);
        form.append("longitude", pos.coords.longitude);
        form.append("before_photo", photo);

        try {
          const res = await http.post("/api/requests/", form, { headers: { "Content-Type": "multipart/form-data" } });
          console.info("[REQUEST] create success", { id: res?.data?.id });
          setMsg({ type: "success", text: "Заявка создана" });
          setTitle("");
          setPhoto(null);
        } catch (e) {
          console.error("[REQUEST] create failed", { error: e.response?.data ?? e.message });
          setMsg({ type: "danger", text: "Ошибка отправки: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        console.error("[REQUEST] geolocation failed", { code: err.code, message: err.message });
        setBusy(false);
        setMsg({ type: "danger", text: "Геолокация недоступна: " + err.message });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="mb-3">
        <h4 className="mb-1">Новая заявка</h4>
        <div className="gc-muted">Опиши проблему, прикрепи фото — координаты возьмем автоматически</div>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <div className="mb-3">
        <label className="form-label gc-muted">Описание</label>
        <input
          className="form-control"
          placeholder="Например: мусор у входа в парк"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <FileDropzone
          label="Фото"
          file={photo}
          onChange={setPhoto}
        />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={busy}>
        {busy ? "Отправляю..." : "Отправить"}
      </button>
    </div>
  );
}
