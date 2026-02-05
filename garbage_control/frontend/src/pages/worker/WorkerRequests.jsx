import { useEffect, useState } from "react";
import Notice from "../../components/Notice";
import FileDropzone from "../../components/FileDropzone";
import { getRequests, takeInWork, uploadAfterPhoto } from "../../api/requests";
import { statusClass, statusLabel } from "../../ui/status";

export default function WorkerRequests() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusyMap] = useState({});
  const [files, setFiles] = useState({});

  const load = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const data = await getRequests();
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      setMsg({ type: "danger", text: "Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setBusyFor = (id, value) => {
    setBusyMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleTakeInWork = async (id) => {
    setMsg(null);
    setBusyFor(id, true);
    try {
      await takeInWork(id);
      await load();
      setMsg({ type: "success", text: "Заявка взята в работу" });
    } catch (e) {
      setMsg({ type: "danger", text: "Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
    } finally {
      setBusyFor(id, false);
    }
  };

  const handleUploadAfter = async (id) => {
    const file = files[id];
    if (!file) {
      setMsg({ type: "warning", text: "Выберите фото после уборки" });
      return;
    }
    setMsg(null);
    setBusyFor(id, true);
    try {
      await uploadAfterPhoto(id, file);
      setFiles((prev) => ({ ...prev, [id]: null }));
      await load();
      setMsg({ type: "success", text: "Фото загружено, заявка отправлена на проверку" });
    } catch (e) {
      setMsg({ type: "danger", text: "Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message) });
    } finally {
      setBusyFor(id, false);
    }
  };

  return (
    <div className="card p-3 gc-anim gc-anim--up">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Исполнитель — мои заявки</h4>
          <div className="text-muted">Назначенные заявки и действия по ним</div>
        </div>
        <button className="btn btn-outline-secondary" onClick={load} disabled={loading}>
          {loading ? "..." : "Обновить"}
        </button>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr className="text-muted">
              <th style={{ width: 90 }}>#</th>
              <th>Описание</th>
              <th style={{ width: 160 }}>Статус</th>
              <th style={{ width: 220 }}>Создана</th>
              <th style={{ width: 360 }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">#{r.id}</td>
                <td>
                  <div className="fw-semibold">{r.title}</div>
                  {r.last_rework_comment && (
                    <div className="text-danger" style={{ fontSize: 12 }}>
                      Доработка: {r.last_rework_comment}
                    </div>
                  )}
                </td>
                <td>
                  <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                </td>
                <td className="text-muted">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                </td>
                <td>
                  {r.status === "VERIFIED" && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleTakeInWork(r.id)}
                      disabled={!!busy[r.id]}
                    >
                      {busy[r.id] ? "..." : "Взять в работу"}
                    </button>
                  )}

                  {r.status === "IN_PROGRESS" && (
                    <div className="d-flex align-items-center gap-2">
                      <FileDropzone
                        label="Фото после"
                        compact
                        file={files[r.id]}
                        onChange={(file) => setFiles((prev) => ({ ...prev, [r.id]: file }))}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUploadAfter(r.id)}
                        disabled={!!busy[r.id]}
                      >
                        {busy[r.id] ? "..." : "Отправить фото"}
                      </button>
                    </div>
                  )}

                  {r.status !== "VERIFIED" && r.status !== "IN_PROGRESS" && (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="text-muted">
                  Пока нет назначенных заявок
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
