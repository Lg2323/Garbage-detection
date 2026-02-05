import { useState } from "react";
import { registerUser, loginUser } from "../api/auth";
import Notice from "../components/Notice";
import { reverseGeocodeCity } from "../utils/geocoding";

export default function Register({ onDone }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);

  const detectCity = () => {
    if (!navigator.geolocation) {
      setMsg({ type: "warning", text: "Геолокация не поддерживается браузером" });
      return;
    }
    setDetectingCity(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const cityName = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
          if (cityName) {
            setCity(cityName);
            setMsg({ type: "info", text: `Город определен: ${cityName}` });
          } else {
            setMsg({ type: "warning", text: "Не удалось определить город. Введите вручную." });
          }
        } catch {
          setMsg({ type: "warning", text: "Не удалось определить город. Введите вручную." });
        } finally {
          setDetectingCity(false);
        }
      },
      () => {
        setDetectingCity(false);
        setMsg({ type: "warning", text: "Нет доступа к геолокации. Введите город вручную." });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const submit = async (e) => {
    e?.preventDefault();
    setMsg(null);
    setBusy(true);
    console.info("[AUTH] register start", { username, email, phone, city });
    try {
      await registerUser({ username, email, phone, city, password });
      console.info("[AUTH] register success", { username, email });
      await loginUser({ username, password });
      console.info("[AUTH] login after register success", { username });
      onDone?.();
    } catch (err) {
      console.error("[AUTH] register failed", {
        username,
        email,
        error: err.response?.data ?? err.message,
      });
      setMsg({ type: "danger", text: "Ошибка: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gc-card gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="m-0">Регистрация</h4>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

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
          <label className="form-label gc-muted">Город</label>
          <div className="d-flex gap-2">
            <input className="form-control gc-input" value={city} onChange={(e)=>setCity(e.target.value)} placeholder="Например: Москва" />
            <button className="btn btn-outline-secondary" type="button" onClick={detectCity} disabled={detectingCity}>
              {detectingCity ? "..." : "Определить"}
            </button>
          </div>
        </div>
        <div className="col-md-6">
          <label className="form-label gc-muted">Пароль</label>
          <input className="form-control gc-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>

        <div className="col-12">
          <button className="btn btn-primary gc-btn" type="submit" disabled={busy}>
            {busy ? "Создаю..." : "Создать аккаунт"}
          </button>
        </div>
      </form>
    </div>
  );
}
