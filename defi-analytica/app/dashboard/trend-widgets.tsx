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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type TrendPoint = {
  timestamp: string;
  score: number;
  confidence: number;
};

type TrendWidgetsProps = {
  points: TrendPoint[];
};

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

const axisLabelColor = "#475569";
const gridColor = "rgba(148, 163, 184, 0.2)";

const sharedOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      labels: {
        color: "#0f172a",
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: axisLabelColor,
        maxTicksLimit: 8,
      },
      grid: {
        color: gridColor,
      },
    },
    y: {
      ticks: {
        color: axisLabelColor,
      },
      grid: {
        color: gridColor,
      },
    },
  },
};

export function TrendWidgets({ points }: TrendWidgetsProps) {
  const labels = points.map((point) => shortTimeLabel(point.timestamp));

  const scoreChartData = {
    labels,
    datasets: [
      {
        label: "Composite Score",
        data: points.map((point) => Number(point.score.toFixed(4))),
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.18)",
        pointRadius: 1.8,
        pointHoverRadius: 3.8,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Bullish Threshold",
        data: points.map(() => 1),
        borderColor: "#10b981",
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: "Bearish Threshold",
        data: points.map(() => -1),
        borderColor: "#f43f5e",
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };

  const confidenceChartData = {
    labels,
    datasets: [
      {
        label: "Confidence (%)",
        data: points.map((point) => Number((point.confidence * 100).toFixed(2))),
        borderColor: "#7c3aed",
        backgroundColor: "rgba(124, 58, 237, 0.16)",
        pointRadius: 1.8,
        pointHoverRadius: 3.8,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sentiment Score Trend</h2>
        <p className="mt-1 text-xs text-slate-500">
          Rolling composite sentiment with bullish and bearish threshold overlays.
        </p>
        <div className="mt-4 h-72">
          <Line data={scoreChartData} options={sharedOptions} />
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Confidence Trend</h2>
        <p className="mt-1 text-xs text-slate-500">
          Model confidence over time based on score strength and factor coverage.
        </p>
        <div className="mt-4 h-72">
          <Line
            data={confidenceChartData}
            options={{
              ...sharedOptions,
              scales: {
                ...sharedOptions.scales,
                y: {
                  ...sharedOptions.scales?.["y"],
                  min: 0,
                  max: 100,
                },
              },
            }}
          />
        </div>
      </article>
    </section>
  );
}
