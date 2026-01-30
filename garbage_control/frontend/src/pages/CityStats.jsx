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

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await getCityStats();
      setData(res);
    } catch (e) {
      setMsg("Ошибка: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byStatus = useMemo(() => data?.by_status ?? [], [data]);

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="d-flex align-items-end justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Статистика города</h4>
          <div className="gc-muted">Общая картина по заявкам и скорости их выполнения</div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
          Обновить
        </button>
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
