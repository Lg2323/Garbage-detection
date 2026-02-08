import { useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { statusLabel } from "../../ui/status";

const STATUS_COLORS = {
  CREATED: "#1f6b4a",
  VERIFIED: "#1d5f5a",
  IN_PROGRESS: "#2f6e3f",
  ON_CHECK: "#6a7a1f",
  COMPLETED: "#236b46",
};

export default function StatsPieChart({ items }) {
  const data = useMemo(
    () =>
      items.map((s) => ({
        id: s.status,
        label: statusLabel(s.status),
        value: s.count || 0,
        color: STATUS_COLORS[s.status] || "#4f7d62",
      })),
    [items]
  );

  const total = useMemo(
    () => items.reduce((sum, s) => sum + (s.count || 0), 0),
    [items]
  );

  return (
    <div className="gc-card gc-card--soft p-3 mt-3">
      <div className="fw-semibold mb-2">Круговая диаграмма</div>
      {total ? (
        <div className="gc-pie">
          <ResponsivePie
            data={data}
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
  );
}
