import { useEffect, useMemo, useState } from "react";
import { getCityStats } from "../api/requests";
import Notice from "../components/Notice";
import StatsPieChart from "../components/city-stats/StatsPieChart";
import StatsStatusList from "../components/city-stats/StatsStatusList";
import StatsSummaryCards from "../components/city-stats/StatsSummaryCards";

export default function CityStats() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("");

  const load = async (cityValue = city) => {
    setMsg("");
    setLoading(true);
    try {
      const res = await getCityStats(cityValue || undefined);
      setData(res);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(city);
  }, [city]);

  const byStatus = useMemo(() => data?.by_status ?? [], [data]);
  const cities = useMemo(() => data?.available_cities ?? [], [data]);

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-end justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Статистика города</h4>
          <div className="gc-muted">Общая картина по заявкам и скорости их выполнения</div>
        </div>
        <div className="d-flex gap-2 align-items-end">
          <div>
            <label className="form-label gc-muted mb-1">Город</label>
            <select className="form-select form-select-sm" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Все города</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => load(city)} disabled={loading}>
            Обновить
          </button>
        </div>
      </div>

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <StatsSummaryCards
        total={data?.total}
        completed={data?.completed}
        completionRate={data?.completion_rate}
        avgHours={data?.avg_completion_hours}
      />

      <StatsStatusList items={byStatus} />
      <StatsPieChart items={byStatus} />
    </div>
  );
}
