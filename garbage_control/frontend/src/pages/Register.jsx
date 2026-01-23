import { useState } from "react";
import { registerUser, loginUser } from "../api/auth";

export default function Register({ onDone }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      await registerUser({ username, email, phone, password });
      await loginUser({ username, password });
      onDone?.();
    } catch (err) {
      setMsg("Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  return (
    <div className="gc-card p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Регистрация</h4>
        <span className="gc-muted">роль: CITIZEN по умолчанию</span>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}

      <form onSubmit={submit} className="row g-3">
        <div className="col-md-6">
          <label className="form-label gc-muted">Username</label>
          <input className="form-control gc-input" value={username} onChange={(e)=>setUsername(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label gc-muted">Email</label>
          <input className="form-control gc-input" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label gc-muted">Телефон</label>
          <input className="form-control gc-input" value={phone} onChange={(e)=>setPhone(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label gc-muted">Пароль</label>
          <input className="form-control gc-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>

        <div className="col-12">
          <button className="btn btn-primary gc-btn" type="submit">
            Создать аккаунт
          </button>
        </div>
      </form>
    </div>
  );
}
