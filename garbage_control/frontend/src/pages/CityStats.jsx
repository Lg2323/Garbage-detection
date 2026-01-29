import { useEffect, useMemo, useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import { getCityStats } from "../api/requests";
import { statusLabel } from "../ui/status";
import Notice from "../components/Notice";

const STATUS_COLORS = {
  CREATED: "#a855f7",
  VERIFIED: "#7c3aed",
  IN_PROGRESS: "#ec4899",
  ON_CHECK: "#f472b6",
  COMPLETED: "#8b5cf6",
};

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
      setMsg("??????: " + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byStatus = useMemo(() => {
    if (!data?.by_status) return [];
    return data.by_status;
  }, [data]);

  const pieData = useMemo(() => {
    return byStatus.map((s) => ({
      id: s.status,
      label: statusLabel(s.status),
      value: s.count || 0,
      color: STATUS_COLORS[s.status] || "#c084fc",
    }));
  }, [byStatus]);

  const total = useMemo(() => {
    return byStatus.reduce((sum, s) => sum + (s.count || 0), 0);
  }, [byStatus]);

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

      <div className="gc-stats-grid">
        <div className="gc-stat-card">
          <div className="gc-muted">Всего заявок</div>
          <div className="gc-stat-value">{data?.total ?? "-"}</div>
        </div>
        <div className="gc-stat-card">
          <div className="gc-muted">Завершено</div>
          <div className="gc-stat-value">{data?.completed ?? "-"}</div>
        </div>
        <div className="gc-stat-card">
          <div className="gc-muted">Доля завершенных</div>
          <div className="gc-stat-value">{data ? `${data.completion_rate}%` : "-"}</div>
        </div>
        <div className="gc-stat-card">
          <div className="gc-muted">Среднее время выполнения, час</div>
          <div className="gc-stat-value">{data?.avg_completion_hours ?? "-"}</div>
        </div>
      </div>

      <div className="gc-card gc-card--soft p-3 mt-3">
        <div className="fw-semibold mb-2">Статусы заявок</div>
        <div className="d-grid gap-2">
          {byStatus.map((s) => (
            <div key={s.status} className="d-flex align-items-center justify-content-between">
              <span className="gc-muted">{statusLabel(s.status)}</span>
              <span className="fw-semibold">{s.count}</span>
            </div>
          ))}
          {!byStatus.length && <div className="text-muted">-</div>}
        </div>
      </div>

      <div className="gc-card gc-card--soft p-3 mt-3">
        <div className="fw-semibold mb-2">Круговая диаграмма</div>
        {total ? (
          <div className="gc-pie">
            <ResponsivePie
              data={pieData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              innerRadius={0.6}
              padAngle={1}
              cornerRadius={6}
              colors={{ datum: "data.color" }}
              activeOuterRadiusOffset={6}
              enableArcLabels={false}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsColor={{ from: "color" }}
              arcLinkLabelsThickness={2}
              arcLinkLabelsTextColor="var(--text)"
              legends={[
                {
                  anchor: "right",
                  direction: "column",
                  translateX: 140,
                  itemWidth: 140,
                  itemHeight: 18,
                  symbolSize: 12,
                  symbolShape: "circle",
                },
              ]}
            />
            <div className="gc-pie__center">
              <div className="gc-pie__value">{total}</div>
              <div className="gc-muted">заявок</div>
            </div>
          </div>
        ) : (
          <div className="text-muted">-</div>
        )}
      </div>
    </div>
  );
}
