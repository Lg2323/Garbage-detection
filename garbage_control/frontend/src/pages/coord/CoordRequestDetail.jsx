import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import http from "../../api/http";
import { assignWorker, getWorkers } from "../../api/coord";
import { returnToWork } from "../../api/requests";
import { statusClass, statusLabel } from "../../ui/status";
import Notice from "../../components/Notice";

export default function CoordRequestDetail() {
  const { id } = useParams();
  const [req, setReq] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [reassignWorkerId, setReassignWorkerId] = useState("");

  const load = async () => {
    setMsg("");
    const [r, w] = await Promise.all([
      http.get(`/api/requests/${id}/`).then((x) => x.data),
      getWorkers(),
    ]);
    setReq(r);
    setWorkers(w);
    setWorkerId(r?.assigned_worker || "");
  };

  useEffect(() => {
    load().catch((e) => setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message)));
  }, [id]);

  const doAssign = async () => {
    setMsg("");
    setBusy(true);
    try {
      await assignWorker(id, Number(workerId));
      await load();
      setMsg("Исполнитель назначен");
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setBusy(false);
    }
  };

  const doReturnToWork = async () => {
    if (!returnComment.trim()) {
      setMsg("Ошибка: укажите комментарий");
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      await returnToWork(id, {
        comment: returnComment.trim(),
        reassign_worker_id: reassignWorkerId ? Number(reassignWorkerId) : null,
      });
      setReturnComment("");
      setReassignWorkerId("");
      await load();
      setMsg("Заявка возвращена на доработку");
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setBusy(false);
    }
  };

  const beforeUrl = useMemo(() => req?.before_photo || "", [req]);
  const afterUrl = useMemo(() => req?.after_photo || "", [req]);
  const verification = req?.verification || null;
  const verificationDetails = verification?.details || {};
  const reduction =
    typeof verification?.score === "number"
      ? verification.score
      : typeof verificationDetails.reduction === "number"
        ? verificationDetails.reduction
        : null;
  const reductionPct = typeof reduction === "number" ? Math.round(reduction * 100) : null;

  if (!req) return <div className="card p-3">Загрузка...</div>;

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h4 className="mb-0">Заявка #{req.id}</h4>
            <div className="text-muted">{req.title}</div>
          </div>
          <span className={statusClass(req.status)}>{statusLabel(req.status)}</span>
        </div>
        <Notice type="info" text={msg} onClose={() => setMsg("")} />
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Детали</div>
            <div className="d-grid gap-1">
              <div><b>Заявитель:</b> {req.created_by}</div>
              <div><b>Исполнитель:</b> {req.assigned_worker ?? "-"}</div>
              <div><b>Координатор:</b> {req.coordinator ?? "-"}</div>
              <div><b>Создана:</b> {new Date(req.created_at).toLocaleString()}</div>
              <div><b>Обновлена:</b> {new Date(req.updated_at).toLocaleString()}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                location: {typeof req.location === "string" ? req.location : JSON.stringify(req.location)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Назначить исполнителя</div>
            <div className="d-flex gap-2">
              <select
                className="form-select"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
              >
                <option value="">— выбрать —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    #{w.id} {w.username} ({w.email})
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={doAssign} disabled={!workerId || busy}>
                Назначить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото до</div>
            {beforeUrl ? (
              <img src={beforeUrl} alt="before" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Нет фото</div>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Фото после</div>
            {afterUrl ? (
              <img src={afterUrl} alt="after" className="img-fluid rounded" />
            ) : (
              <div className="text-muted">Нет фото</div>
            )}
          </div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">AI Result</div>
            {verification ? (
              <div className="d-grid gap-1">
                <div><b>Status:</b> {verification.is_clean ? "Clean" : "Not clean"}</div>
                {reductionPct !== null && (
                  <div><b>Reduction:</b> {reductionPct}%</div>
                )}
                {typeof verificationDetails.before_count === "number" && (
                  <div><b>Before:</b> {verificationDetails.before_count}</div>
                )}
                {typeof verificationDetails.after_count === "number" && (
                  <div><b>After:</b> {verificationDetails.after_count}</div>
                )}
                {verificationDetails.error && (
                  <div className="text-danger"><b>AI Error:</b> {String(verificationDetails.error)}</div>
                )}
                {verification.created_at && (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Checked: {new Date(verification.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted">AI check has not run yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">Возврат на доработку</div>
            <div className="d-grid gap-2">
              <textarea
                className="form-control"
                rows={3}
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="Опишите, что нужно исправить"
              />
              <select
                className="form-select"
                value={reassignWorkerId}
                onChange={(e) => setReassignWorkerId(e.target.value)}
              >
                <option value="">Оставить текущего исполнителя</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    #{w.id} {w.username} ({w.email})
                  </option>
                ))}
              </select>
              <button className="btn btn-outline-danger" onClick={doReturnToWork} disabled={busy}>
                Вернуть на доработку
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card p-3 h-100">
            <div className="fw-semibold mb-2">История доработок</div>
            {req.rework_events?.length ? (
              <div className="d-grid gap-2">
                {req.rework_events.map((ev) => (
                  <div key={ev.id} className="border rounded p-2">
                    <div className="fw-semibold">{new Date(ev.created_at).toLocaleString()}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {ev.created_by_username || "—"} • Статус: {statusLabel(ev.previous_status) || ev.previous_status}
                    </div>
                    <div>Комментарий: {ev.comment}</div>
                    {(ev.previous_worker_username || ev.new_worker_username) && (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Исполнитель: {ev.previous_worker_username || "—"} → {ev.new_worker_username || "—"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted">Нет возвратов на доработку</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
