import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Notice from "../components/Notice";
import { confirmPasswordReset } from "../api/auth";

export default function ResetPassword() {
  const { uid, token } = useParams();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await confirmPasswordReset({ uid, token, newPassword: password });
      setDone(true);
    } catch (err) {
      setMsg({ type: "danger", text: "Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gc-card gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Новый пароль</h4>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      {done ? (
        <div className="d-grid gap-3">
          <div className="gc-muted">Пароль обновлён. Теперь можно войти.</div>
          <Link className="btn btn-primary" to="/login">Перейти ко входу</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="d-grid gap-3">
          <div>
            <label className="form-label gc-muted">Новый пароль</label>
            <input
              className="form-control gc-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
              required
              minLength={6}
            />
          </div>

          <button className="btn btn-primary gc-btn" type="submit" disabled={busy}>
            {busy ? "Сохраняю..." : "Сохранить"}
          </button>
        </form>
      )}
    </div>
  );
}
