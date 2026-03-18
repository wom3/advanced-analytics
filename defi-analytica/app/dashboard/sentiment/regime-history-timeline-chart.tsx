"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
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
  const data = {
    labels,
    datasets: [
      {
        label: "Regime",
        data: points.map((point) => regimeToValue[point.label]),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.18)",
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: points.map((point) => {
          if (point.label === "bullish") {
            return "#059669";
          }
          if (point.label === "bearish") {
            return "#e11d48";
          }
          return "#d97706";
        }),
        borderWidth: 2,
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
        Step timeline of bearish, neutral, and bullish states over the current lookback window.
      </p>
      <div className="mt-4 h-80">
        <Line data={data} options={chartOptions} />
      </div>
    </section>
  );
}
