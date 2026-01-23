import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import http from "../../api/http";
import { assignWorker, getWorkers, verifyRequest } from "../../api/coord";

export default function CoordRequestDetail() {
  const { id } = useParams();
  const [req, setReq] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const [r, w] = await Promise.all([
      http.get(`/api/requests/${id}/`).then((x) => x.data),
      getWorkers(),
    ]);
    setReq(r);
    setWorkers(w);
  };

  useEffect(() => { load().catch(e => setMsg("Ошибка: " + e.message)); }, [id]);

  const doAssign = async () => {
    setMsg("");
    try {
      await assignWorker(id, Number(workerId));
      await load();
      setMsg("Исполнитель назначен");
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  const doVerify = async () => {
    setMsg("");
    try {
      const out = await verifyRequest(id);
      await load();
      setMsg("Проверка выполнена: " + JSON.stringify(out));
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  if (!req) return <div>Загрузка...</div>;

  return (
    <div>
      <h3>Заявка #{req.id}</h3>
      {msg && <div style={{ margin: "10px 0" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div><b>Описание:</b> {req.title}</div>
          <div><b>Статус:</b> {req.status}</div>
          <div><b>Заявитель:</b> {req.created_by}</div>
          <div><b>Исполнитель:</b> {req.assigned_worker ?? "-"}</div>
          <div><b>Координатор:</b> {req.coordinator ?? "-"}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            location: {JSON.stringify(req.location)}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ marginBottom: 8 }}><b>Назначить исполнителя</b></div>
          <div style={{ display: "flex", gap: 10 }}>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} style={{ flex: 1 }}>
              <option value="">-- выбрать --</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  #{w.id} {w.username} ({w.email})
                </option>
              ))}
            </select>
            <button onClick={doAssign} disabled={!workerId}>Назначить</button>
          </div>

          <hr style={{ margin: "14px 0" }} />

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={doVerify}>Запустить проверку (verify)</button>
            <span style={{ fontSize: 12, opacity: 0.7 }}>обычно когда статус ON_CHECK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
