import { useEffect, useMemo, useState } from "react";
import { getRequests } from "../api/requests";
import http from "../api/http";
import { statusClass, statusLabel } from "../ui/status";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";

const StatusBadge = ({ s }) => (
  <span className={statusClass(s)}>{statusLabel(s)}</span>
);

const STATUS_ORDER = ["CREATED", "VERIFIED", "IN_PROGRESS", "ON_CHECK", "COMPLETED"];

function statusProgress(status) {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

export default function RequestsList() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    getRequests()
      .then((res) => setItems(res.data ?? res))
      .catch((e) => setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message)));
  }, []);
  useEffect(() => {
    setPage(1);
  }, [items.length]);


  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const hasActive = useMemo(() => items.some((r) => r.status !== "COMPLETED"), [items]);

  const submit = async () => {
    setFormMsg(null);

    if (!title.trim()) return setFormMsg({ type: "warning", text: "Введите описание" });
    if (!photo) return setFormMsg({ type: "warning", text: "Прикрепите фото" });
    if (!navigator.geolocation) return setFormMsg({ type: "danger", text: "Геолокация не поддерживается" });

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
          setFormMsg({ type: "success", text: "Заявка создана" });
          setTitle("");
          setPhoto(null);
          const res = await getRequests();
          setItems(res.data ?? res);
        } catch (e) {
          setFormMsg({ type: "danger", text: "Ошибка отправки: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setFormMsg({ type: "danger", text: "Геолокация недоступна: " + err.message });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-end justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Заявки</h4>
          <div className="gc-muted">Список обращений и их статусы</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {hasActive && <span className="gc-work">Идет работа по заявкам</span>}
          <div className="gc-pill">Всего: {items.length}</div>
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            Создать заявку
          </button>
        </div>
      </div>

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="gc-muted">
              <th style={{width:90}}>#</th>
              <th>Описание</th>
              <th style={{width:160}}>Статус</th>
              <th style={{width:180}}>Прогресс</th>
              <th style={{width:220}}>Создана</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>{r.title}</td>
                <td><StatusBadge s={r.status} /></td>
                <td>
                  <div className="gc-progress">
                    <div className="gc-progress__bar" style={{ width: `${statusProgress(r.status)}%` }} />
                  </div>
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                    {statusLabel(r.status)}
                  </div>
                </td>
                <td className="gc-muted">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={items.length} onPageChange={setPage} />

      {open && (
        <div className="gc-modal">
          <div className="gc-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="gc-modal__content gc-anim gc-anim--up">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="m-0">Новая заявка</h5>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setOpen(false)}>
                Закрыть
              </button>
            </div>

            <Notice type={formMsg?.type} text={formMsg?.text} onClose={() => setFormMsg(null)} />

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
              <label className="form-label gc-muted">Фото</label>
              <input className="form-control" type="file" accept="image/*" onChange={(e)=>setPhoto(e.target.files?.[0] ?? null)} />
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? "Отправляю..." : "Отправить"}
              </button>
              <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
