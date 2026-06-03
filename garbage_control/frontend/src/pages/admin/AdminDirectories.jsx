import { useEffect, useMemo, useState } from "react";
import {
  createAdminResource,
  deleteAdminResource,
  getAdminReferenceOptions,
  listAdminResource,
  updateAdminResource,
} from "../../api/admin";
import Notice from "../../components/Notice";
import AdminCrudSection from "../../components/admin/AdminCrudSection";

function normalizeValue(field, value) {
  if (field.type === "checkbox") {
    return !!value;
  }
  if (field.type === "multiselect") {
    return Array.isArray(value) ? value : [];
  }
  if (field.type === "select") {
    return value ?? null;
  }
  return value ?? "";
}

function buildInitialForm(fields) {
  return fields.reduce((acc, field) => {
    acc[field.name] = normalizeValue(field, field.defaultValue);
    return acc;
  }, {});
}

function convertFieldValue(field, value) {
  if (field.type === "checkbox") {
    return !!value;
  }
  if (field.type === "multiselect") {
    return Array.isArray(value) ? value.map((entry) => Number(entry)) : [];
  }
  if (field.type === "select") {
    return value === "" || value === null || value === undefined ? null : Number(value);
  }
  return typeof value === "string" ? value.trim() : value;
}

function filterItems(items, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }
  return items.filter((item) =>
    Object.values(item).some((value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (Array.isArray(value)) {
        return value
          .map((entry) =>
            typeof entry === "object" && entry !== null
              ? entry.username || entry.name || entry.label || JSON.stringify(entry)
              : String(entry)
          )
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      }
      return String(value).toLowerCase().includes(normalized);
    })
  );
}

export default function AdminDirectories() {
  const [referenceOptions, setReferenceOptions] = useState(null);
  const [msg, setMsg] = useState(null);
  const [activeSection, setActiveSection] = useState("federalSubjects");
  const [sectionState, setSectionState] = useState({});

  const sections = useMemo(() => ({
    federalSubjects: {
      title: "Субъекты РФ",
      description: "Регионы, к которым привязываются муниципалитеты и организации.",
      resourceKey: "federalSubjects",
      fields: [
        { name: "code", label: "Код", defaultValue: "" },
        { name: "name", label: "Название", defaultValue: "" },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    municipalities: {
      title: "Муниципальные образования",
      description: "Районы и округа для маршрутизации заявок.",
      resourceKey: "municipalities",
      fields: [
        {
          name: "name",
          label: "Название",
          defaultValue: "",
        },
        {
          name: "federal_subject",
          label: "Субъект РФ",
          type: "select",
          options: referenceOptions?.federal_subjects ?? [],
          optionLabel: "name",
          displayField: "federal_subject_name",
        },
        {
          name: "kind",
          label: "Вид",
          type: "select",
          options: referenceOptions?.choices?.municipality_kind || [],
          getOptionLabel: (option) => option.label,
          displayField: "kind",
          defaultValue: "CITY_DISTRICT",
        },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    localities: {
      title: "Населенные пункты",
      description: "Города, поселки и села внутри муниципалитетов.",
      resourceKey: "localities",
      fields: [
        { name: "name", label: "Название", defaultValue: "" },
        {
          name: "municipality",
          label: "Муниципалитет",
          type: "select",
          options: referenceOptions?.municipalities ?? [],
          optionLabel: "name",
          displayField: "municipality_name",
        },
        {
          name: "kind",
          label: "Вид",
          type: "select",
          options: referenceOptions?.choices?.locality_kind || [],
          getOptionLabel: (option) => option.label,
          displayField: "kind",
          defaultValue: "CITY",
        },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    organizationTypes: {
      title: "Типы организаций",
      description: "Муниципальные службы, подрядчики, надзорные и другие структуры.",
      resourceKey: "organizationTypes",
      fields: [
        { name: "code", label: "Код", defaultValue: "" },
        { name: "name", label: "Название", defaultValue: "" },
        { name: "description", label: "Описание", type: "textarea", defaultValue: "" },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    organizations: {
      title: "Организации",
      description: "Юридические и муниципальные субъекты ответственности.",
      resourceKey: "organizations",
      fields: [
        { name: "name", label: "Название", defaultValue: "" },
        { name: "short_name", label: "Краткое имя", defaultValue: "" },
        {
          name: "organization_type",
          label: "Тип",
          type: "select",
          options: referenceOptions?.organization_types || [],
          optionLabel: "name",
          displayField: "organization_type_name",
        },
        {
          name: "federal_subject",
          label: "Субъект РФ",
          type: "select",
          options: referenceOptions?.federal_subjects || [],
          optionLabel: "name",
          displayField: "federal_subject_name",
        },
        {
          name: "municipality",
          label: "Муниципалитет",
          type: "select",
          options: referenceOptions?.municipalities ?? [],
          optionLabel: "name",
          displayField: "municipality_name",
        },
        {
          name: "locality",
          label: "Населенный пункт",
          type: "select",
          options: referenceOptions?.localities ?? [],
          optionLabel: "name",
          displayField: "locality_name",
        },
        { name: "address", label: "Адрес", defaultValue: "" },
        { name: "contact_phone", label: "Телефон", defaultValue: "" },
        { name: "email", label: "Email", type: "email", defaultValue: "" },
        { name: "is_external", label: "Внешняя организация", type: "checkbox", defaultValue: false, displayField: "is_external" },
        { name: "is_active", label: "Активна", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    departments: {
      title: "Подразделения",
      description: "Участки, диспетчерские и отделы внутри организаций.",
      resourceKey: "departments",
      fields: [
        { name: "name", label: "Название", defaultValue: "" },
        {
          name: "organization",
          label: "Организация",
          type: "select",
          options: referenceOptions?.organizations ?? [],
          optionLabel: "name",
          displayField: "organization_name",
        },
        {
          name: "parent_department",
          label: "Родительское подразделение",
          type: "select",
          options: referenceOptions?.departments ?? [],
          optionLabel: "name",
          displayField: "parent_department_name",
        },
        {
          name: "department_type",
          label: "Тип",
          type: "select",
          options: referenceOptions?.choices?.department_type || [],
          getOptionLabel: (option) => option.label,
          displayField: "department_type",
          defaultValue: "OTHER",
        },
        { name: "code", label: "Код", defaultValue: "" },
        { name: "is_active", label: "Активно", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    brigades: {
      title: "Бригады",
      description: "Исполнительские группы с руководителем и составом.",
      resourceKey: "brigades",
      fields: [
        { name: "name", label: "Название", defaultValue: "" },
        {
          name: "organization",
          label: "Организация",
          type: "select",
          options: referenceOptions?.organizations ?? [],
          optionLabel: "name",
          displayField: "organization_name",
        },
        {
          name: "department",
          label: "Подразделение",
          type: "select",
          options: referenceOptions?.departments ?? [],
          optionLabel: "name",
          displayField: "department_name",
        },
        {
          name: "supervisor",
          label: "Руководитель",
          type: "select",
          options: referenceOptions?.users || [],
          getOptionLabel: (option) => `${option.username} (${option.role})`,
          displayField: "supervisor_username",
        },
        {
          name: "members",
          label: "Состав",
          type: "multiselect",
          options: referenceOptions?.users || [],
          getOptionLabel: (option) => `${option.username} (${option.role})`,
          displayField: "member_usernames",
          defaultValue: [],
        },
        {
          name: "brigade_type",
          label: "Тип",
          type: "select",
          options: referenceOptions?.choices?.brigade_type || [],
          getOptionLabel: (option) => option.label,
          displayField: "brigade_type",
          defaultValue: "CLEANUP",
        },
        { name: "is_active", label: "Активна", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    territoryTypes: {
      title: "Типы территорий",
      description: "Муниципальная, частная, дорожная и другие категории.",
      resourceKey: "territoryTypes",
      fields: [
        { name: "code", label: "Код", defaultValue: "" },
        { name: "name", label: "Название", defaultValue: "" },
        { name: "description", label: "Описание", type: "textarea", defaultValue: "" },
        {
          name: "requires_external_transfer",
          label: "Требует внешней передачи",
          type: "checkbox",
          defaultValue: false,
          displayField: "requires_external_transfer",
        },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
    ownershipTypes: {
      title: "Типы собственности",
      description: "Справочник правового режима территории.",
      resourceKey: "ownershipTypes",
      fields: [
        { name: "code", label: "Код", defaultValue: "" },
        { name: "name", label: "Название", defaultValue: "" },
        { name: "description", label: "Описание", type: "textarea", defaultValue: "" },
        { name: "is_active", label: "Активен", type: "checkbox", defaultValue: true, displayField: "is_active" },
      ],
    },
  }), [referenceOptions]);

  useEffect(() => {
    const initialState = Object.entries(sections).reduce((acc, [key, config]) => {
      acc[key] = {
        items: [],
        filters: { q: "" },
        form: buildInitialForm(config.fields),
        editingId: null,
        busy: false,
      };
      return acc;
    }, {});
    setSectionState(initialState);
  }, [sections]);

  useEffect(() => {
    (async () => {
      try {
        const options = await getAdminReferenceOptions();
        setReferenceOptions(options);
      } catch (error) {
        setMsg({
          type: "danger",
          text: "Не удалось загрузить справочники: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (!referenceOptions) {
      return;
    }
    Object.keys(sections).forEach((key) => {
      loadSection(key);
    });
  }, [referenceOptions, sections]);

  const loadSection = async (key) => {
    try {
      const items = await listAdminResource(sections[key].resourceKey);
      setSectionState((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          items,
        },
      }));
    } catch (error) {
      setMsg({
        type: "danger",
        text: "Не удалось загрузить данные: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    }
  };

  const refreshAll = async () => {
    const options = await getAdminReferenceOptions();
    setReferenceOptions(options);
    Object.keys(sections).forEach((key) => {
      loadSection(key);
    });
  };

  const updateSectionState = (key, patch) => {
    setSectionState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const handleFilterChange = (key, field, value) => {
    updateSectionState(key, {
      filters: {
        ...sectionState[key].filters,
        [field]: value,
      },
    });
  };

  const handleFieldChange = (key, fieldName, value) => {
    updateSectionState(key, {
      form: {
        ...sectionState[key].form,
        [fieldName]: value,
      },
    });
  };

  const handleEdit = (key, item) => {
    const nextForm = buildInitialForm(sections[key].fields);
    sections[key].fields.forEach((field) => {
      nextForm[field.name] = normalizeValue(field, item[field.name]);
    });
    updateSectionState(key, { form: nextForm, editingId: item.id });
  };

  const handleCancelEdit = (key) => {
    updateSectionState(key, {
      form: buildInitialForm(sections[key].fields),
      editingId: null,
    });
  };

  const handleSubmit = async (key, event) => {
    event.preventDefault();
    const config = sections[key];
    const current = sectionState[key];

    updateSectionState(key, { busy: true });
    try {
      const payload = config.fields.reduce((acc, field) => {
        acc[field.name] = convertFieldValue(field, current.form[field.name]);
        return acc;
      }, {});

      if (current.editingId) {
        await updateAdminResource(config.resourceKey, current.editingId, payload);
      } else {
        await createAdminResource(config.resourceKey, payload);
      }

      await refreshAll();
      updateSectionState(key, {
        busy: false,
        editingId: null,
        form: buildInitialForm(config.fields),
      });
      setMsg({ type: "success", text: "Изменения сохранены." });
    } catch (error) {
      updateSectionState(key, { busy: false });
      setMsg({
        type: "danger",
        text: "Не удалось сохранить запись: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    }
  };

  const handleDelete = async (key, item) => {
    const confirmed = window.confirm(`Удалить запись "${item.name || item.code || item.username || item.id}"?`);
    if (!confirmed) {
      return;
    }
    updateSectionState(key, { busy: true });
    try {
      await deleteAdminResource(sections[key].resourceKey, item.id);
      await refreshAll();
      updateSectionState(key, { busy: false });
      setMsg({ type: "success", text: "Запись удалена." });
    } catch (error) {
      updateSectionState(key, { busy: false });
      setMsg({
        type: "danger",
        text: "Не удалось удалить запись: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
      });
    }
  };

  const visibleItems = useMemo(() => {
    const active = sectionState[activeSection];
    if (!active) {
      return [];
    }
    return filterItems(active.items, active.filters.q);
  }, [activeSection, sectionState]);

  if (!referenceOptions || !sectionState[activeSection]) {
    return <div className="card p-3">Загрузка справочников...</div>;
  }

  return (
    <div className="d-grid gap-3 gc-anim gc-anim--up">
      <div className="card p-3">
        <h4 className="mb-1">Справочники и структура</h4>
        <div className="text-muted">
          Единое управление территориями, организациями, подразделениями и служебными справочниками.
        </div>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <div className="gc-admin-tabs">
        {Object.entries(sections).map(([key, config]) => (
          <button
            key={key}
            className={`gc-admin-tabs__item ${activeSection === key ? "gc-admin-tabs__item--active" : ""}`}
            type="button"
            onClick={() => setActiveSection(key)}
          >
            {config.title}
          </button>
        ))}
      </div>

      <AdminCrudSection
        title={sections[activeSection].title}
        description={sections[activeSection].description}
        fields={sections[activeSection].fields}
        items={visibleItems}
        form={sectionState[activeSection].form}
        filters={sectionState[activeSection].filters}
        onFilterChange={(field, value) => handleFilterChange(activeSection, field, value)}
        onFieldChange={(field, value) => handleFieldChange(activeSection, field, value)}
        onSubmit={(event) => handleSubmit(activeSection, event)}
        onEdit={(item) => handleEdit(activeSection, item)}
        onDelete={(item) => handleDelete(activeSection, item)}
        onCancelEdit={() => handleCancelEdit(activeSection)}
        busy={sectionState[activeSection].busy}
        editingId={sectionState[activeSection].editingId}
      />
    </div>
  );
}
