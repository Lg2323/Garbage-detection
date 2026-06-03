import { useEffect, useMemo, useState } from "react";
import { getMe, getMySubmittedRequests, updateMe } from "../api/auth";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";
import RequestsTable from "../components/requests/RequestsTable";

const PAGE_SIZE = 5;

function buildForm(user) {
  return {
    username: user?.username || "",
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    city: user?.city || "",
    current_password: "",
    new_password: "",
  };
}

export default function Profile({ initialMe = null, onUpdated = null }) {
  const [profile, setProfile] = useState(initialMe);
  const [form, setForm] = useState(() => buildForm(initialMe));
  const [loading, setLoading] = useState(!initialMe);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [submittedRequests, setSubmittedRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsMsg, setRequestsMsg] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialMe) {
      setProfile(initialMe);
      setForm(buildForm(initialMe));
    }
  }, [initialMe]);

  const loadSubmittedRequests = async () => {
    setRequestsLoading(true);
    setRequestsMsg(null);
    try {
      const items = await getMySubmittedRequests();
      setSubmittedRequests(Array.isArray(items) ? items : []);
    } catch (error) {
      setRequestsMsg({
        type: "danger",
        text: "Не удалось загрузить отправленные заявки: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const me = initialMe || (await getMe());
        setProfile(me);
        setForm(buildForm(me));
      } catch (error) {
        setMsg({
          type: "danger",
          text: "Не удалось загрузить профиль: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
        });
      } finally {
        setLoading(false);
      }
    })();

    loadSubmittedRequests();
  }, [initialMe]);

  useEffect(() => {
    setPage(1);
  }, [submittedRequests.length]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
      };

      if (form.new_password.trim()) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }

      const updated = await updateMe(payload);
      setProfile(updated);
      setForm({
        ...buildForm(updated),
        current_password: "",
        new_password: "",
      });
      onUpdated?.(updated);
      setMsg({ type: "success", text: "Профиль обновлен." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Не удалось сохранить профиль: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setSaving(false);
    }
  };

  const requestStats = useMemo(() => {
    const completed = submittedRequests.filter((item) => item.status === "COMPLETED").length;
    const transferred = submittedRequests.filter((item) => item.status === "TRANSFERRED").length;
    return {
      total: submittedRequests.length,
      completed,
      active: submittedRequests.length - completed - transferred,
    };
  }, [submittedRequests]);

  const pagedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return submittedRequests.slice(start, start + PAGE_SIZE);
  }, [submittedRequests, page]);

  if (loading) {
    return <div className="card p-3">Загрузка профиля...</div>;
  }

  return (
    <div className="gc-profile gc-anim gc-anim--up">
      <div className="gc-profile__hero card p-4 mb-3">
        <div>
          <h4 className="mb-1">Профиль аккаунта</h4>
          <div className="text-muted">
            Управление личными данными, контактами и просмотр собственных обращений.
          </div>
        </div>
        <div className="gc-profile__hero-side">
          <div className="gc-profile__meta">
            <div className="gc-profile__meta-label">Роль</div>
            <div className="gc-profile__meta-value">{profile?.role || "-"}</div>
          </div>
          <div className="gc-profile__meta">
            <div className="gc-profile__meta-label">Организация</div>
            <div className="gc-profile__meta-value gc-profile__meta-value--compact">
              {profile?.organization_name || "-"}
            </div>
          </div>
          <div className="gc-profile__meta">
            <div className="gc-profile__meta-label">Отправлено заявок</div>
            <div className="gc-profile__meta-value">{requestStats.total}</div>
          </div>
        </div>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <form className="card p-4" onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Логин</label>
            <input className="form-control" value={form.username} onChange={(event) => updateField("username", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Город</label>
            <input className="form-control" value={form.city} onChange={(event) => updateField("city", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Имя</label>
            <input className="form-control" value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Фамилия</label>
            <input className="form-control" value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Телефон</label>
            <input className="form-control" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Организация</label>
            <input className="form-control" value={profile?.organization_name || ""} disabled />
          </div>
          <div className="col-md-6">
            <label className="form-label">Подразделение</label>
            <input className="form-control" value={profile?.department_name || ""} disabled />
          </div>
        </div>

        <div className="gc-profile__divider" />

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Текущий пароль</label>
            <input
              className="form-control"
              type="password"
              value={form.current_password}
              onChange={(event) => updateField("current_password", event.target.value)}
              placeholder="Заполните только если меняете пароль"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Новый пароль</label>
            <input
              className="form-control"
              type="password"
              value={form.new_password}
              onChange={(event) => updateField("new_password", event.target.value)}
              placeholder="Минимум 6 символов"
            />
          </div>
        </div>

        <div className="d-flex justify-content-end mt-4">
          <button className="btn btn-primary" disabled={saving} type="submit">
            {saving ? "Сохраняю..." : "Сохранить изменения"}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
          <div>
            <h5 className="mb-1">Мои отправленные заявки</h5>
            <div className="text-muted">
              Список обращений, которые были созданы из этого аккаунта.
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="gc-pill">Всего: {requestStats.total}</span>
            <span className="gc-pill">Активные: {requestStats.active}</span>
            <span className="gc-pill">Завершенные: {requestStats.completed}</span>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadSubmittedRequests} disabled={requestsLoading}>
              {requestsLoading ? "Обновление..." : "Обновить"}
            </button>
          </div>
        </div>

        <Notice type={requestsMsg?.type} text={requestsMsg?.text} onClose={() => setRequestsMsg(null)} />

        <RequestsTable items={pagedRequests} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={submittedRequests.length} onPageChange={setPage} />
      </div>
    </div>
  );
}
