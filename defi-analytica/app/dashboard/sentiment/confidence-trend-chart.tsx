"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { SentimentHistoryPoint } from "@/src/server/services/sentiment-scoring/service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type ConfidenceTrendChartProps = {
  points: SentimentHistoryPoint[];
};

const axisLabelColor = "#475569";
const gridColor = "rgba(148, 163, 184, 0.2)";

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

function toPct(value: number): number {
  return Number((value * 100).toFixed(2));
}

function rollingAverage(values: number[], windowSize: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return Number((sum / window.length).toFixed(2));
  });
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
          const value = typeof context.parsed.y === "number" ? context.parsed.y : Number.NaN;
          if (!Number.isFinite(value)) {
            return " Confidence: N/A";
          }
          return ` Confidence: ${value.toFixed(2)}%`;
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
      min: 0,
      max: 100,
      ticks: {
        color: axisLabelColor,
        callback(value) {
          const numeric = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(numeric)) {
            return value;
          }
          return `${numeric}%`;
        },
      },
      grid: {
        color: gridColor,
      },
    },
  },
};

export function ConfidenceTrendChart({ points }: ConfidenceTrendChartProps) {
  if (points.length === 0) {
    return (
      <section
        id="confidence-trend-chart"
        className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Confidence Trend Chart</h2>
        <p className="mt-1 text-xs text-slate-500">
          No confidence history is available for the selected request window.
        </p>
      </section>
    );
  }

  const labels = points.map((point) => shortTimeLabel(point.timestamp));
  const confidenceValues = points.map((point) => toPct(point.confidence));
  const smoothConfidence = rollingAverage(confidenceValues, 12);
  const data = {
    labels,
    datasets: [
      {
        label: "High Confidence Zone",
        data: points.map(() => 100),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: 70,
          },
          above: "rgba(16, 185, 129, 0.14)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Medium Confidence Zone",
        data: points.map(() => 70),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: 40,
          },
          above: "rgba(245, 158, 11, 0.12)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Low Confidence Zone",
        data: points.map(() => 40),
        borderWidth: 0,
        pointRadius: 0,
        fill: {
          target: {
            value: 0,
          },
          above: "rgba(244, 63, 94, 0.1)",
          below: "rgba(0, 0, 0, 0)",
        },
      },
      {
        label: "Confidence",
        data: confidenceValues,
        borderColor: "#7c3aed",
        backgroundColor: "rgba(124, 58, 237, 0.26)",
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Smoothed Trend (12pt)",
        data: smoothConfidence,
        borderColor: "#0f172a",
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 1.5,
        fill: false,
        tension: 0.25,
      },
    ],
  };

  return (
    <section
      id="confidence-trend-chart"
      className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">Confidence Trend Chart</h2>
      <p className="mt-1 text-xs text-slate-500">
        Enhanced view of confidence with low/medium/high zones and a smoothed trend overlay.
      </p>
      <div className="mt-4 h-80">
        <Line data={data} options={chartOptions} />
      </div>
    </section>
  );
}
