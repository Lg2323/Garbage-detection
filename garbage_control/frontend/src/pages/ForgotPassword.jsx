import { useState } from "react";
import Notice from "../components/Notice";
import { requestPasswordReset } from "../api/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setMsg({ type: "success", text: "Если аккаунт существует, письмо отправлено." });
      setEmail("");
    } catch (err) {
      setMsg({ type: "danger", text: "Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gc-card gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Восстановление пароля</h4>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <form onSubmit={submit} className="d-grid gap-3">
        <div>
          <label className="form-label gc-muted">Email</label>
          <input
            className="form-control gc-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            type="email"
            required
          />
        </div>

        <button className="btn btn-primary gc-btn" type="submit" disabled={busy}>
          {busy ? "Отправляю..." : "Отправить письмо"}
        </button>
      </form>
    </div>
  );
}
