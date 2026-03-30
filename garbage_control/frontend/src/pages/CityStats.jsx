import { useEffect, useMemo, useState } from "react";
import { getCityStats } from "../api/requests";
import Notice from "../components/Notice";
import StatsBarChart from "../components/city-stats/StatsBarChart";
import StatsFiltersPanel from "../components/city-stats/StatsFiltersPanel";
import StatsPieChart from "../components/city-stats/StatsPieChart";
import StatsStatusList from "../components/city-stats/StatsStatusList";
import StatsSummaryCards from "../components/city-stats/StatsSummaryCards";
import StatsTimelineChart from "../components/city-stats/StatsTimelineChart";
import { HANDLING_MODE_LABELS, STATUS_LABELS, handlingModeLabel, statusLabel } from "../ui/status";

const INITIAL_FILTERS = {
  q: "",
  city: "",
  status: "",
  handling_mode: "",
  created_from: "",
  created_to: "",
  updated_from: "",
  updated_to: "",
  assigned_worker: "",
  federal_subject: "",
  municipality: "",
  locality: "",
  territory_type: "",
  ownership_type: "",
  responsible_organization: "",
};

function toPercent(value, total) {
  if (!total) return 0;
  return Number(((Number(value || 0) / total) * 100).toFixed(1));
}

function normalizeStatusData(items, total) {
  return (items || []).map((item) => ({
    ...item,
    label: statusLabel(item.status),
    count: Number(item.count || 0),
    percent: toPercent(item.count, total),
  }));
}

function normalizeHandlingModeData(items, total) {
  return (items || []).map((item) => ({
    ...item,
    label: handlingModeLabel(item.handling_mode),
    count: Number(item.count || 0),
    percent: toPercent(item.count, total),
  }));
}

function normalizeNamedData(items, nameKey, emptyLabel = "Не указано") {
  return (items || []).map((item) => ({
    ...item,
    label: item[nameKey] || emptyLabel,
    count: Number(item.count || 0),
  }));
}

function createActiveFilterBadges(filters, filtersData) {
  const optionLabel = (items, value, fallback = value) =>
    items?.find((item) => String(item.value) === String(value))?.label || fallback;

  const cityLabel = filters.city || "";
  const statusValue = filters.status;
  const handlingModeValue = filters.handling_mode;

  const badges = [];

  if (filters.q) badges.push(`Поиск: ${filters.q}`);
  if (cityLabel) badges.push(`Город: ${cityLabel}`);
  if (statusValue) badges.push(`Статус: ${optionLabel(filtersData.statuses, statusValue, statusLabel(statusValue))}`);
  if (handlingModeValue) {
    badges.push(
      `Режим: ${optionLabel(filtersData.handling_modes, handlingModeValue, handlingModeLabel(handlingModeValue))}`
    );
  }
  if (filters.created_from || filters.created_to) {
    badges.push(`Создание: ${filters.created_from || "..." } - ${filters.created_to || "..."}`);
  }
  if (filters.updated_from || filters.updated_to) {
    badges.push(`Обновление: ${filters.updated_from || "..." } - ${filters.updated_to || "..."}`);
  }
  if (filters.assigned_worker) {
    badges.push(
      filters.assigned_worker === "unassigned"
        ? "Исполнитель: не назначен"
        : `Исполнитель: ${optionLabel(filtersData.workers, filters.assigned_worker, filters.assigned_worker)}`
    );
  }
  if (filters.federal_subject) {
    badges.push(`Субъект: ${optionLabel(filtersData.federal_subjects, filters.federal_subject)}`);
  }
  if (filters.municipality) {
    badges.push(`Муниципалитет: ${optionLabel(filtersData.municipalities, filters.municipality)}`);
  }
  if (filters.locality) {
    badges.push(`Населенный пункт: ${optionLabel(filtersData.localities, filters.locality)}`);
  }
  if (filters.territory_type) {
    badges.push(`Тип территории: ${optionLabel(filtersData.territory_types, filters.territory_type)}`);
  }
  if (filters.ownership_type) {
    badges.push(`Тип собственности: ${optionLabel(filtersData.ownership_types, filters.ownership_type)}`);
  }
  if (filters.responsible_organization) {
    badges.push(`Организация: ${optionLabel(filtersData.organizations, filters.responsible_organization)}`);
  }

  return badges;
}

function normalizeOptionItems(items, { valueKey = "id", labelKey = "name", labelBuilder = null } = {}) {
  return (items || []).map((item) => ({
    ...item,
    value: item[valueKey],
    label: labelBuilder ? labelBuilder(item) : item[labelKey],
  }));
}

export default function CityStats() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (nextFilters = filters) => {
    setMsg("");
    setLoading(true);
    try {
      const response = await getCityStats(nextFilters);
      setData(response);
    } catch (error) {
      setMsg("Ошибка загрузки статистики: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(INITIAL_FILTERS);
  }, []);

  const filtersData = useMemo(() => {
    const available = data?.available_filters || {};
    return {
      cities: available.cities || [],
      statuses:
        available.statuses ||
        Object.keys(STATUS_LABELS).map((value) => ({ value, label: statusLabel(value) })),
      handling_modes:
        available.handling_modes ||
        Object.keys(HANDLING_MODE_LABELS).map((value) => ({ value, label: handlingModeLabel(value) })),
      workers: normalizeOptionItems(available.workers, {
        labelKey: "username",
        labelBuilder: (item) => (item.city ? `${item.username} (${item.city})` : item.username),
      }),
      federal_subjects: normalizeOptionItems(available.federal_subjects),
      municipalities: normalizeOptionItems(available.municipalities),
      localities: normalizeOptionItems(available.localities),
      territory_types: normalizeOptionItems(available.territory_types),
      ownership_types: normalizeOptionItems(available.ownership_types),
      organizations: normalizeOptionItems(available.organizations, {
        labelBuilder: (item) => item.short_name || item.name,
      }),
    };
  }, [data]);

  const total = Number(data?.total || 0);
  const byStatus = useMemo(() => normalizeStatusData(data?.by_status, total), [data, total]);
  const byHandlingMode = useMemo(
    () => normalizeHandlingModeData(data?.by_handling_mode, total),
    [data, total]
  );
  const byCity = useMemo(() => normalizeNamedData(data?.by_city, "city"), [data]);
  const byTerritoryType = useMemo(
    () => normalizeNamedData(data?.by_territory_type, "territory_type__name"),
    [data]
  );
  const byOrganization = useMemo(
    () => normalizeNamedData(data?.by_organization, "responsible_organization__name"),
    [data]
  );
  const byMunicipality = useMemo(
    () => normalizeNamedData(data?.by_municipality, "municipality__name"),
    [data]
  );
  const timeline = useMemo(() => data?.timeline || [], [data]);
  const activeFilterBadges = useMemo(() => createActiveFilterBadges(filters, filtersData), [filters, filtersData]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = async () => {
    await load(filters);
  };

  const resetFilters = async () => {
    setFilters(INITIAL_FILTERS);
    await load(INITIAL_FILTERS);
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <h4 className="mb-1">Статистика и аналитика заявок</h4>
          <div className="gc-muted">
            Фильтруемая сводка по статусам, срокам, территориям и ответственным организациям.
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="gc-pill">Всего заявок: {total}</span>
          <span className="gc-pill">Активных фильтров: {activeFilterBadges.length}</span>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => setFiltersOpen((prev) => !prev)}
            type="button"
          >
            {filtersOpen ? "Скрыть фильтры" : "Показать фильтры"}
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => load(filters)} disabled={loading}>
            {loading ? "Обновление..." : "Обновить"}
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <StatsFiltersPanel
          value={filters}
          filtersData={filtersData}
          onChange={updateFilter}
          onApply={applyFilters}
          onReset={resetFilters}
          loading={loading}
        />
      ) : null}

      {activeFilterBadges.length ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {activeFilterBadges.map((badge) => (
            <span key={badge} className="gc-pill">
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <StatsSummaryCards
        total={total}
        active={data?.active}
        completed={data?.completed}
        transferred={data?.transferred}
        completionRate={data?.completion_rate}
        transferRate={data?.transfer_rate}
        avgHours={data?.avg_completion_hours}
        reworkRequests={data?.rework_requests}
      />

      <div className="gc-chart-grid gc-chart-grid--primary mt-3">
        <StatsPieChart
          title="Структура заявок по статусам"
          subtitle="Показывает, на каких этапах сейчас сосредоточен поток обращений."
          items={byStatus}
          totalLabel="заявок"
        />
        <StatsStatusList
          title="Статусы и доли"
          subtitle="Количество и удельный вес каждого статуса внутри выбранной выборки."
          items={byStatus}
          total={total}
        />
      </div>

      <div className="gc-chart-grid mt-3">
        <StatsTimelineChart items={timeline} />
        <StatsBarChart
          title="Режимы обработки"
          subtitle="Сравнение заявок, направленных в уборку, и случаев внешней передачи."
          items={byHandlingMode}
          emptyText="Нет данных по режимам обработки."
        />
      </div>

      <div className="gc-chart-grid mt-3">
        <StatsBarChart
          title="Топ городов"
          subtitle="Где фиксируется наибольшее число обращений."
          items={byCity}
          emptyText="Нет данных по городам."
        />
        <StatsBarChart
          title="Муниципалитеты"
          subtitle="Распределение заявок по муниципальным образованиям."
          items={byMunicipality}
          emptyText="Нет данных по муниципалитетам."
        />
      </div>

      <div className="gc-chart-grid mt-3">
        <StatsBarChart
          title="Ответственные организации"
          subtitle="Кто чаще всего получает обращения в обработку."
          items={byOrganization}
          emptyText="Нет данных по организациям."
        />
        <StatsBarChart
          title="Типы территорий"
          subtitle="На каких типах территорий чаще всего появляются обращения."
          items={byTerritoryType}
          emptyText="Нет данных по типам территорий."
        />
      </div>
    </div>
  );
}
