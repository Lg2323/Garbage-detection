import { useEffect, useMemo, useState } from "react";
import { getRequests } from "../api/requests";
import http from "../api/http";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";
import RequestsHeader from "../components/requests/RequestsHeader";
import RequestsTable from "../components/requests/RequestsTable";
import RequestCreateModal from "../components/requests/RequestCreateModal";

const PAGE_SIZE = 8;

export default function RequestsList() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [page, setPage] = useState(1);

  const loadRequests = async () => {
    try {
      const res = await getRequests();
      setItems(res.data ?? res);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const hasActive = useMemo(
    () => items.some((r) => r.status !== "COMPLETED"),
    [items]
  );

  const submit = async () => {
    setFormMsg(null);

    if (!title.trim()) return setFormMsg({ type: "warning", text: "Введите описание" });
    if (!photo) return setFormMsg({ type: "warning", text: "Прикрепите фото" });
    if (!navigator.geolocation) return setFormMsg({ type: "danger", text: "Геолокация не поддерживается" });

    // Coordinates are required for the PointField on the backend.
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
          await loadRequests();
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
      <RequestsHeader
        hasActive={hasActive}
        total={items.length}
        onCreate={() => setOpen(true)}
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <RequestsTable items={pagedItems} />

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />

      <RequestCreateModal
        open={open}
        title={title}
        busy={busy}
        message={formMsg}
        onClose={() => setOpen(false)}
        onMessageClose={() => setFormMsg(null)}
        onTitleChange={setTitle}
        onPhotoChange={setPhoto}
        onSubmit={submit}
      />
    </div>
  );
}
