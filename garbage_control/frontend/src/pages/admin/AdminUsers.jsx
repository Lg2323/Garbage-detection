import { useEffect, useMemo, useState } from "react";
import { createUser, listUsers, updateUser } from "../../api/admin";

const ROLES = ["CITIZEN", "WORKER", "COORDINATOR", "ADMIN"];

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    role: "WORKER",
    password: "",
    is_active: true,
  });

  const load = async (query = "") => {
    try {
      const data = await listUsers(query);
      setItems(data);
      setMsg("");
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (u) =>
        (u.username || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        String(u.id).includes(s)
    );
  }, [items, q]);

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getDraft = (u) => ({
    role: u.role,
    is_active: u.is_active,
    email: u.email || "",
    phone: u.phone || "",
    password: "",
    ...(drafts[u.id] || {}),
  });

  const submitCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser(form);
      setForm({ username: "", email: "", phone: "", role: "WORKER", password: "", is_active: true });
      await load();
    } catch (e2) {
      setMsg("Ошибка: " + (e2.response?.data ? JSON.stringify(e2.response.data) : e2.message));
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async (u) => {
    const d = getDraft(u);
    const payload = {
      role: d.role,
      is_active: d.is_active,
      email: d.email,
      phone: d.phone,
    };
    if (d.password) payload.password = d.password;
    setBusy(true);
    try {
      await updateUser(u.id, payload);
      setDrafts((prev) => ({ ...prev, [u.id]: { ...prev[u.id], password: "" } }));
      await load();
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-grid gap-3">
      <div className="card p-3">
        <h4 className="mb-2">Создать пользователя</h4>
        <form className="row g-2" onSubmit={submitCreate}>
          <div className="col-md-3">
            <input
              className="form-control"
              placeholder="Логин"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
          </div>
          <div className="col-md-3">
            <input
              className="form-control"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Телефон"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div className="col-md-2 d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              id="is_active_new"
            />
            <label className="form-check-label" htmlFor="is_active_new">Активен</label>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" disabled={busy}>
              Создать
            </button>
          </div>
        </form>
      </div>

      {msg && <div className="alert alert-danger mb-0">{msg}</div>}

      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="mb-0">Пользователи</h4>
            <div className="text-muted">Список и редактирование ролей/активности</div>
          </div>
          <span className="badge text-bg-light">Всего: {items.length}</span>
        </div>

        <input
          className="form-control mb-3"
          placeholder="Поиск по id/логину/email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Логин</th>
                <th>Email</th>
                <th style={{ width: 140 }}>Роль</th>
                <th style={{ width: 120 }}>Активен</th>
                <th style={{ width: 180 }}>Новый пароль</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const d = getDraft(u);
                return (
                  <tr key={u.id}>
                    <td className="fw-semibold">#{u.id}</td>
                    <td>{u.username}</td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={d.email}
                        onChange={(e) => setDraft(u.id, { email: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={d.role}
                        onChange={(e) => setDraft(u.id, { role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!d.is_active}
                        onChange={(e) => setDraft(u.id, { is_active: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        type="password"
                        placeholder="Оставь пустым"
                        value={d.password}
                        onChange={(e) => setDraft(u.id, { password: e.target.value })}
                      />
                    </td>
                    <td>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => saveUser(u)} disabled={busy}>
                        Сохранить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="text-muted">Ничего не найдено</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
