import { useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";

const PIE_COLORS = [
  "#1f6b4a",
  "#236b46",
  "#2f7d57",
  "#379a69",
  "#6a7a1f",
  "#8a5b20",
  "#4f7d62",
  "#2b5f7a",
];

export default function StatsPieChart({
  title = "Круговая диаграмма",
  subtitle = "",
  items,
  totalLabel = "записей",
  emptyText = "Нет данных для построения диаграммы.",
}) {
  const data = useMemo(
    () =>
      (items || []).map((item, index) => ({
        id: item.label,
        label: item.label,
        value: Number(item.count || item.value || 0),
        color: PIE_COLORS[index % PIE_COLORS.length],
      })),
    [items]
  );

  const total = useMemo(
    () => data.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [data]
  );

  const CenteredMetric = ({ centerX, centerY }) => (
    <g transform={`translate(${centerX}, ${centerY})`} pointerEvents="none">
      <text
        x={0}
        y={-6}
        textAnchor="middle"
        dominantBaseline="central"
        className="gc-pie__svg-value"
      >
        {total}
      </text>
      <text
        x={0}
        y={16}
        textAnchor="middle"
        dominantBaseline="central"
        className="gc-pie__svg-label"
      >
        {totalLabel}
      </text>
    </g>
  );

  return (
    <div className="gc-card gc-card--soft p-3">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <div className="fw-semibold">{title}</div>
          {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
        </div>
      </div>

      {total ? (
        <div className="gc-pie">
          <ResponsivePie
            data={data}
            margin={{ top: 20, right: 140, bottom: 20, left: 20 }}
            innerRadius={0.62}
            padAngle={1}
            cornerRadius={6}
            colors={{ datum: "data.color" }}
            activeOuterRadiusOffset={6}
            enableArcLabels={false}
            layers={["arcs", "arcLinkLabels", "legends", CenteredMetric]}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsColor={{ from: "color" }}
            arcLinkLabelsThickness={2}
            arcLinkLabelsTextColor="var(--text)"
            tooltip={({ datum }) => (
              <div className="gc-pie-tooltip">
                <div className="fw-semibold">{datum.label}</div>
                <div>{datum.value}</div>
              </div>
            )}
            legends={[
              {
                anchor: "right",
                direction: "column",
                translateX: 124,
                itemWidth: 140,
                itemHeight: 18,
                symbolSize: 12,
                symbolShape: "circle",
              },
            ]}
            theme={{
              legends: {
                text: {
                  fill: "var(--text)",
                  fontSize: 12,
                },
              },
              labels: {
                text: {
                  fill: "var(--text)",
                },
              },
              tooltip: {
                container: {
                  background: "#ffffff",
                  color: "var(--text)",
                  fontSize: 12,
                  borderRadius: 12,
                  boxShadow: "0 10px 24px rgba(15,23,42,.12)",
                },
              },
            }}
          />
        </div>
      ) : (
        <div className="text-muted">{emptyText}</div>
      )}
    </div>
  );
}
