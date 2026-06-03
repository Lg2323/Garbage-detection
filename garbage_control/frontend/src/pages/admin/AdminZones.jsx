import { useEffect, useMemo, useState } from "react";
import {
  createAdminResource,
  deleteAdminResource,
  getAdminReferenceOptions,
  listAdminResource,
  updateAdminResource,
} from "../../api/admin";
import Notice from "../../components/Notice";
import ZoneGeometryEditor from "../../components/admin/ZoneGeometryEditor";

const INITIAL_FORM = {
  name: "",
  organization: null,
  department: null,
  brigade: null,
  federal_subject: null,
  municipality: null,
  locality: null,
  territory_type: null,
  comment: "",
  is_active: true,
  geometry_input: null,
};

function toNumberOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

export default function AdminZones() {
  const [options, setOptions] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const [referenceOptions, zones] = await Promise.all([
      getAdminReferenceOptions(),
      listAdminResource("responsibilityZones"),
    ]);
    setOptions(referenceOptions);
    setItems(zones);
  };

  useEffect(() => {
    load().catch((error) => {
      setMsg({
        type: "danger",
        text: "Не удалось загрузить зоны ответственности: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    });
  }, []);

  const visibleItems = useMemo(() => {
    const normalized = q.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      [item.name, item.organization_name, item.department_name, item.brigade_name, item.territory_type_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [items, q]);

  const departments = useMemo(() => {
    if (!options) {
      return [];
    }
    if (!form.organization) {
      return options.departments;
    }
    return options.departments.filter((department) => department.organization_id === Number(form.organization));
  }, [options, form.organization]);

  const brigades = useMemo(() => {
    if (!options) {
      return [];
    }
    let filtered = options.brigades;
    if (form.organization) {
      filtered = filtered.filter((brigade) => brigade.organization_id === Number(form.organization));
    }
    if (form.department) {
      filtered = filtered.filter((brigade) => brigade.department_id === Number(form.department));
    }
    return filtered;
  }, [options, form.organization, form.department]);

  const municipalities = useMemo(() => {
    if (!options) {
      return [];
    }
    if (!form.federal_subject) {
      return options.municipalities;
    }
    return options.municipalities.filter((municipality) => municipality.federal_subject_id === Number(form.federal_subject));
  }, [options, form.federal_subject]);

  const localities = useMemo(() => {
    if (!options) {
      return [];
    }
    if (!form.municipality) {
      return options.localities;
    }
    return options.localities.filter((locality) => locality.municipality_id === Number(form.municipality));
  }, [options, form.municipality]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      organization: item.organization ?? null,
      department: item.department ?? null,
      brigade: item.brigade ?? null,
      federal_subject: item.federal_subject ?? null,
      municipality: item.municipality ?? null,
      locality: item.locality ?? null,
      territory_type: item.territory_type ?? null,
      comment: item.comment || "",
      is_active: !!item.is_active,
      geometry_input: item.geometry_geojson || null,
    });
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        name: form.name.trim(),
        organization: toNumberOrNull(form.organization),
        department: toNumberOrNull(form.department),
        brigade: toNumberOrNull(form.brigade),
        federal_subject: toNumberOrNull(form.federal_subject),
        municipality: toNumberOrNull(form.municipality),
        locality: toNumberOrNull(form.locality),
        territory_type: toNumberOrNull(form.territory_type),
        comment: form.comment.trim(),
        is_active: !!form.is_active,
        geometry_input: form.geometry_input,
      };

      if (editingId) {
        await updateAdminResource("responsibilityZones", editingId, payload);
      } else {
        await createAdminResource("responsibilityZones", payload);
      }

      await load();
      resetForm();
      setMsg({ type: "success", text: "Зона ответственности сохранена." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Не удалось сохранить зону: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Удалить зону "${item.name}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteAdminResource("responsibilityZones", item.id);
      await load();
      if (editingId === item.id) {
        resetForm();
      }
      setMsg({ type: "success", text: "Зона удалена." });
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Не удалось удалить зону: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!options) {
    return <div className="card p-3">Загрузка зон ответственности...</div>;
  }

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <h4 className="mb-1">Зоны ответственности</h4>
        <div className="text-muted">
          Привязка организаций и бригад к территории с сохранением полигона на карте.
        </div>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <form className="card p-3" onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label">Название зоны</label>
            <input className="form-control" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
          </div>
          <div className="col-lg-4">
            <label className="form-label">Организация</label>
            <select className="form-select" value={form.organization ?? ""} onChange={(event) => updateField("organization", event.target.value || null)} required>
              <option value="">Выберите организацию</option>
              {options.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Подразделение</label>
            <select className="form-select" value={form.department ?? ""} onChange={(event) => updateField("department", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Бригада</label>
            <select className="form-select" value={form.brigade ?? ""} onChange={(event) => updateField("brigade", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {brigades.map((brigade) => (
                <option key={brigade.id} value={brigade.id}>
                  {brigade.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Субъект РФ</label>
            <select className="form-select" value={form.federal_subject ?? ""} onChange={(event) => updateField("federal_subject", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.federal_subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Муниципалитет</label>
            <select className="form-select" value={form.municipality ?? ""} onChange={(event) => updateField("municipality", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {municipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Населенный пункт</label>
            <select className="form-select" value={form.locality ?? ""} onChange={(event) => updateField("locality", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>
                  {locality.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4">
            <label className="form-label">Тип территории</label>
            <select className="form-select" value={form.territory_type ?? ""} onChange={(event) => updateField("territory_type", event.target.value || null)}>
              <option value="">Не выбрано</option>
              {options.territory_types.map((territoryType) => (
                <option key={territoryType.id} value={territoryType.id}>
                  {territoryType.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 d-flex align-items-end">
            <div className="form-check">
              <input
                id="zone-active"
                className="form-check-input"
                type="checkbox"
                checked={!!form.is_active}
                onChange={(event) => updateField("is_active", event.target.checked)}
              />
              <label className="form-check-label" htmlFor="zone-active">
                Активная зона
              </label>
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Комментарий</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.comment}
              onChange={(event) => updateField("comment", event.target.value)}
            />
          </div>
          <div className="col-12">
            <ZoneGeometryEditor value={form.geometry_input} onChange={(geometry) => updateField("geometry_input", geometry)} />
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          {editingId && (
            <button className="btn btn-outline-secondary" type="button" onClick={resetForm} disabled={busy}>
              Отменить
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "..." : editingId ? "Сохранить изменения" : "Создать зону"}
          </button>
        </div>
      </form>

      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
          <div>
            <h5 className="mb-1">Список зон</h5>
            <div className="text-muted">Можно искать по названию, организации, бригаде и типу территории.</div>
          </div>
          <input className="form-control" style={{ minWidth: 260 }} placeholder="Поиск" value={q} onChange={(event) => setQ(event.target.value)} />
        </div>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Название</th>
                <th>Организация</th>
                <th>Подразделение</th>
                <th>Бригада</th>
                <th>Тип территории</th>
                <th style={{ width: 180 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="fw-semibold">#{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.organization_name || "-"}</td>
                  <td>{item.department_name || "-"}</td>
                  <td>{item.brigade_name || "-"}</td>
                  <td>{item.territory_type_name || "-"}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleEdit(item)}>
                        Изменить
                      </button>
                      <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => handleDelete(item)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleItems.length && (
                <tr>
                  <td colSpan={7} className="text-muted">
                    Зоны не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
