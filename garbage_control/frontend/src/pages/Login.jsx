import { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../api/auth";
import Notice from "../components/Notice";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await loginUser({ username, password });
      onDone?.();
    } catch (err) {
      setMsg({ type: "danger", text: "Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gc-card gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Вход</h4>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <form onSubmit={submit} className="d-grid gap-3">
        <div>
          <label className="form-label gc-muted">Username</label>
          <input
            className="form-control gc-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="например: testuser"
          />
        </div>
        <div>
          <label className="form-label gc-muted">Пароль</label>
          <input
            className="form-control gc-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button className="btn btn-primary gc-btn" type="submit" disabled={busy}>
          {busy ? "Вхожу..." : "Войти"}
        </button>
        <Link className="gc-link-muted" to="/forgot-password">Forgot password?</Link>
      </form>
    </div>
  );
}
