import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  deleteUser,
  getAdminReferenceOptions,
  listUsers,
  updateUser,
} from "../../api/admin";
import Notice from "../../components/Notice";
import BootstrapIcon from "../../components/BootstrapIcon";
import Pagination from "../../components/Pagination";

const ROLES = ["CITIZEN", "COORDINATOR", "ORG_MANAGER", "DEPARTMENT_MANAGER", "WORKER", "ADMIN"];

const INITIAL_FORM = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  city: "",
  role: "WORKER",
  organization: "",
  department: "",
  password: "",
  is_active: true,
};

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [referenceOptions, setReferenceOptions] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [form, setForm] = useState(INITIAL_FORM);

  const load = async (query = "") => {
    const [users, refs] = await Promise.all([
      listUsers(query),
      getAdminReferenceOptions(),
    ]);
    setItems(Array.isArray(users) ? users : []);
    setReferenceOptions(refs);
    setMsg("");
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    });
  }, []);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    if (!search) return items;
    return items.filter((user) =>
      [
        user.username,
        user.first_name,
        user.last_name,
        user.email,
        user.organization_name,
        user.department_name,
        String(user.id),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [items, q]);

  useEffect(() => {
    setPage(1);
  }, [filtered.length, q]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const getDepartmentsForOrganization = (organizationId) => {
    if (!referenceOptions?.departments) return [];
    if (!organizationId) return referenceOptions.departments;
    return referenceOptions.departments.filter(
      (department) => department.organization_id === Number(organizationId)
    );
  };

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getDraft = (user) => ({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    role: user.role,
    is_active: user.is_active,
    email: user.email || "",
    phone: user.phone || "",
    city: user.city || "",
    organization: user.organization ?? "",
    department: user.department ?? "",
    password: "",
    ...(drafts[user.id] || {}),
  });

  const submitCreate = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createUser({
        ...form,
        organization: toNumberOrNull(form.organization),
        department: toNumberOrNull(form.department),
      });
      setForm(INITIAL_FORM);
      await load();
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async (user) => {
    const draft = getDraft(user);
    const payload = {
      first_name: draft.first_name,
      last_name: draft.last_name,
      role: draft.role,
      is_active: draft.is_active,
      email: draft.email,
      phone: draft.phone,
      city: draft.city,
      organization: toNumberOrNull(draft.organization),
      department: toNumberOrNull(draft.department),
    };
    if (draft.password) {
      payload.password = draft.password;
    }

    setBusy(true);
    try {
      await updateUser(user.id, payload);
      setDrafts((prev) => ({ ...prev, [user.id]: { ...prev[user.id], password: "" } }));
      await load();
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Удалить пользователя ${user.username}?`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteUser(user.id);
      await load();
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <h4 className="mb-2">Создать пользователя</h4>
        <form className="row g-2" onSubmit={submitCreate}>
          <div className="col-md-3">
            <input
              className="form-control"
              placeholder="Логин"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Имя"
              value={form.first_name}
              onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Фамилия"
              value={form.last_name}
              onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="col-md-3">
            <input
              className="form-control"
              placeholder="Телефон"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Город"
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={form.organization}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, organization: event.target.value, department: "" }))
              }
            >
              <option value="">Организация не выбрана</option>
              {(referenceOptions?.organizations || []).map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.department}
              onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
            >
              <option value="">Подразделение</option>
              {getDepartmentsForOrganization(form.organization).map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </div>
          <div className="col-md-1 d-flex align-items-center">
            <input
              className="form-check-input me-2"
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              id="new-user-active"
            />
            <label className="form-check-label" htmlFor="new-user-active">Активен</label>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" disabled={busy}>Создать</button>
          </div>
        </form>
      </div>

      <Notice type="danger" text={msg} onClose={() => setMsg("")} />

      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
          <div>
            <h4 className="mb-0">Пользователи</h4>
            <div className="text-muted">Роли, привязка к организации и подразделению, активность и смена пароля.</div>
          </div>
          <span className="badge text-bg-light">Всего: {items.length}</span>
        </div>

        <div className="gc-admin-inline-hint mb-3" data-hint="Поля ниже редактируются прямо в строке таблицы.">
          <BootstrapIcon name="pencil-square" />
          Поля ниже редактируются прямо в строке таблицы.

        </div>

        <input
          className="form-control mb-3"
          placeholder="Поиск по id, логину, имени, email, организации"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />

        <div className="table-responsive">
          <table className="table align-middle gc-admin-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Логин</th>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Email</th>
                <th style={{ width: 150 }}>Роль</th>
                <th style={{ width: 220 }}>Организация</th>
                <th style={{ width: 220 }}>Подразделение</th>
                <th style={{ width: 120 }}>Активен</th>
                <th style={{ width: 180 }}>Новый пароль</th>
                <th style={{ width: 180 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((user) => {
                const draft = getDraft(user);
                const departmentOptions = getDepartmentsForOrganization(draft.organization);

                return (
                  <tr key={user.id}>
                    <td className="fw-semibold">#{user.id}</td>
                    <td>{user.username}</td>
                    <td>
                      <input
                        className="form-control gc-admin-inline-input"
                        value={draft.first_name}
                        onChange={(event) => setDraft(user.id, { first_name: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control gc-admin-inline-input"
                        value={draft.last_name}
                        onChange={(event) => setDraft(user.id, { last_name: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control gc-admin-inline-input"
                        value={draft.email}
                        onChange={(event) => setDraft(user.id, { email: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select gc-admin-inline-select"
                        value={draft.role}
                        onChange={(event) => setDraft(user.id, { role: event.target.value })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select gc-admin-inline-select"
                        value={draft.organization}
                        onChange={(event) =>
                          setDraft(user.id, { organization: event.target.value, department: "" })
                        }
                      >
                        <option value="">Не выбрано</option>
                        {(referenceOptions?.organizations || []).map((organization) => (
                          <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select gc-admin-inline-select"
                        value={draft.department}
                        onChange={(event) => setDraft(user.id, { department: event.target.value })}
                      >
                        <option value="">Не выбрано</option>
                        {departmentOptions.map((department) => (
                          <option key={department.id} value={department.id}>{department.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-check-input gc-admin-inline-check"
                        type="checkbox"
                        checked={!!draft.is_active}
                        onChange={(event) => setDraft(user.id, { is_active: event.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control gc-admin-inline-input"
                        type="password"
                        placeholder="Оставьте пустым"
                        value={draft.password}
                        onChange={(event) => setDraft(user.id, { password: event.target.value })}
                      />
                    </td>
                    <td>
                      <div className="d-flex gap-2 gc-admin-inline-actions">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => saveUser(user)} disabled={busy}>
                          Сохранить
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => removeUser(user)} disabled={busy}>
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={11} className="text-muted">Ничего не найдено.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </div>
    </div>
  );
}
