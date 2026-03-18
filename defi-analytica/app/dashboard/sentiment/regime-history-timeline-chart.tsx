"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  type ScriptableLineSegmentContext,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type {
  SentimentHistoryPoint,
  SentimentLabel,
} from "@/src/server/services/sentiment-scoring/service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type RegimeHistoryTimelineChartProps = {
  points: SentimentHistoryPoint[];
};

const axisLabelColor = "#475569";
const gridColor = "rgba(148, 163, 184, 0.2)";

const regimeToValue: Record<SentimentLabel, number> = {
  bearish: -1,
  neutral: 0,
  bullish: 1,
};

const valueToRegime = new Map<number, string>([
  [-1, "Bearish"],
  [0, "Neutral"],
  [1, "Bullish"],
]);

function shortTimeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(date);
}

const chartOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          const value = context.parsed.y ?? Number.NaN;
          const regime = valueToRegime.get(value) ?? "Unknown";
          return ` Regime: ${regime}`;
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: axisLabelColor,
        maxTicksLimit: 10,
      },
      grid: {
        color: gridColor,
      },
    },
    y: {
      min: -1,
      max: 1,
      ticks: {
        color: axisLabelColor,
        stepSize: 1,
        callback(value) {
          const numeric = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(numeric)) {
            return value;
          }
          return valueToRegime.get(numeric) ?? value;
        },
      },
      grid: {
        color: gridColor,
      },
    },
  },
};

export function RegimeHistoryTimelineChart({ points }: RegimeHistoryTimelineChartProps) {
  if (points.length === 0) {
    return (
      <section
        id="regime-history-timeline"
        className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Regime History Timeline</h2>
        <p className="mt-1 text-xs text-slate-500">
          No history points are available for the selected request window.
        </p>
      </section>
    );
  }

  const labels = points.map((point) => shortTimeLabel(point.timestamp));
  const bullishCount = points.filter((point) => point.label === "bullish").length;
  const neutralCount = points.filter((point) => point.label === "neutral").length;
  const bearishCount = points.filter((point) => point.label === "bearish").length;
  const transitions = points.reduce((count, point, index) => {
    if (index === 0) {
      return 0;
    }
    return point.label === points[index - 1]?.label ? count : count + 1;
  }, 0);

  const data = {
    labels,
    datasets: [
      {
        label: "Bullish Zone",
        data: points.map(() => 1),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: 0.2,
          },
          above: "rgba(16, 185, 129, 0.18)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Neutral Zone",
        data: points.map(() => 0.2),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: -0.2,
          },
          above: "rgba(245, 158, 11, 0.16)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Bearish Zone",
        data: points.map(() => -0.2),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: -1,
          },
          above: "rgba(244, 63, 94, 0.16)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Regime",
        data: points.map((point) => regimeToValue[point.label]),
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(37, 99, 235, 0.32)",
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderWidth: 1.5,
        pointBorderColor: "#ffffff",
        pointBackgroundColor: points.map((point) => {
          if (point.label === "bullish") {
            return "#059669";
          }
          if (point.label === "bearish") {
            return "#e11d48";
          }
          return "#d97706";
        }),
        borderWidth: 2.4,
        segment: {
          borderColor(context: ScriptableLineSegmentContext) {
            const from = context.p0.parsed.y ?? Number.NaN;
            const to = context.p1.parsed.y ?? Number.NaN;
            if (!Number.isFinite(from) || !Number.isFinite(to)) {
              return "#1d4ed8";
            }
            if (to > from) {
              return "#16a34a";
            }
            if (to < from) {
              return "#e11d48";
            }
            return "#1d4ed8";
          },
          borderDash(context: ScriptableLineSegmentContext) {
            const from = context.p0.parsed.y ?? Number.NaN;
            const to = context.p1.parsed.y ?? Number.NaN;
            if (!Number.isFinite(from) || !Number.isFinite(to)) {
              return [0, 0];
            }
            return from === to ? [0, 0] : [6, 4];
          },
        },
        fill: true,
        stepped: true,
      },
    ],
  };

  return (
    <section
      id="regime-history-timeline"
      className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">Regime History Timeline</h2>
      <p className="mt-1 text-xs text-slate-500">
        Intensified timeline with regime zones and transition-aware segment styling.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">Bullish</span>
          <span className="ml-2">{bullishCount}</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Neutral</span>
          <span className="ml-2">{neutralCount}</span>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-900">
          <span className="font-semibold">Bearish</span>
          <span className="ml-2">{bearishCount}</span>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-900">
          <span className="font-semibold">Transitions</span>
          <span className="ml-2">{transitions}</span>
        </div>
      </div>

      <div className="mt-4 h-80">
        <Line data={data} options={chartOptions} />
      </div>
    </section>
  );
}
