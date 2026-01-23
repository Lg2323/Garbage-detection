import { useState } from "react";
import { loginUser } from "../api/auth";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      await loginUser({ username, password });
      onDone?.();
    } catch (err) {
      setMsg("Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  return (
    <div className="gc-card p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Вход</h4>
        <span className="gc-muted">JWT + httpOnly refresh</span>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}

      <form onSubmit={submit} className="d-grid gap-3">
        <div>
          <label className="form-label gc-muted">Username</label>
          <input className="form-control gc-input" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="например: testuser" />
        </div>
        <div>
          <label className="form-label gc-muted">Пароль</label>
          <input className="form-control gc-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        <button className="btn btn-primary gc-btn" type="submit">
          Войти
        </button>
      </form>
    </div>
  );
}
