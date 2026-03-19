"use client";

import {
  BarElement,
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
import { Bar, Line } from "react-chartjs-2";

import type { LlamaTimeSeriesPoint } from "@/src/server/adapters/defillama/client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

type FlowChartsProps = {
  volumePoints: LlamaTimeSeriesPoint[];
  tvlPoints: LlamaTimeSeriesPoint[];
  chain: string;
};

const axisLabelColor = "#334155";
const gridColor = "rgba(148, 163, 184, 0.2)";

function shortTimeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function toNetFlowSeries(points: LlamaTimeSeriesPoint[]): number[] {
  return points.map((point, index) => {
    if (index === 0) {
      return 0;
    }

    const current = Number(point.value);
    const previous = Number(points[index - 1]?.value ?? Number.NaN);
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return 0;
    }

    return Number((current - previous).toFixed(2));
  });
}

const lineBaseOptions: ChartOptions<"line"> = {
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
        maxTicksLimit: 10,
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

const barBaseOptions: ChartOptions<"bar"> = {
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
        maxTicksLimit: 10,
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

export function FlowCharts({ volumePoints, tvlPoints, chain }: FlowChartsProps) {
  if (volumePoints.length === 0 && tvlPoints.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">DEX Volume and TVL Flow Charts</h2>
        <p className="mt-2 text-sm text-slate-600">
          No flow series are available yet for the selected baseline chain.
        </p>
      </section>
    );
  }

  const volumeLabels = volumePoints.map((point) => shortTimeLabel(point.timestamp));
  const tvlLabels = tvlPoints.map((point) => shortTimeLabel(point.timestamp));
  const netFlow = toNetFlowSeries(tvlPoints);

  const latestVolume = volumePoints.at(-1)?.value ?? null;
  const latestTvl = tvlPoints.at(-1)?.value ?? null;
  const latestNetFlow = netFlow.at(-1) ?? null;

  const volumeData = {
    labels: volumeLabels,
    datasets: [
      {
        label: "DEX Volume",
        data: volumePoints.map((point) => Number(point.value.toFixed(2))),
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.2)",
        pointRadius: 1.8,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const tvlData = {
    labels: tvlLabels,
    datasets: [
      {
        label: "TVL",
        data: tvlPoints.map((point) => Number(point.value.toFixed(2))),
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.16)",
        pointRadius: 1.6,
        pointHoverRadius: 3.8,
        borderWidth: 2,
        fill: true,
        tension: 0.25,
      },
    ],
  };

  const netFlowData = {
    labels: tvlLabels,
    datasets: [
      {
        label: "Net TVL Flow",
        data: netFlow,
        borderColor: "#1d4ed8",
        backgroundColor: netFlow.map((value) =>
          value >= 0 ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"
        ),
        borderWidth: 1,
      },
    ],
  };

  return (
    <section className="mt-8 space-y-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">DEX Volume Trend</h2>
          <p className="text-xs text-slate-500">
            Chain: <span className="font-medium text-slate-800">{chain}</span>
          </p>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Daily liquidity turnover trend from DefiLlama DEX volume summaries.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Latest volume:{" "}
          <span className="font-semibold text-slate-900">
            {formatUsdCompact(Number(latestVolume ?? Number.NaN))}
          </span>
        </p>
        <div className="mt-4 h-72">
          <Line
            data={volumeData}
            options={{
              ...lineBaseOptions,
              plugins: {
                ...lineBaseOptions.plugins,
                tooltip: {
                  callbacks: {
                    label(context) {
                      const value =
                        typeof context.parsed.y === "number" ? context.parsed.y : Number.NaN;
                      return ` Volume: ${formatUsdCompact(value)}`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">TVL and Net Flow</h2>
          <p className="text-xs text-slate-500">TVL delta approximates net capital flow per day.</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Latest TVL:{" "}
            <span className="font-semibold text-slate-900">
              {formatUsdCompact(Number(latestTvl ?? Number.NaN))}
            </span>
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Latest net flow:{" "}
            <span className="font-semibold text-slate-900">
              {formatUsdCompact(Number(latestNetFlow ?? Number.NaN))}
            </span>
          </p>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="h-72">
            <Line
              data={tvlData}
              options={{
                ...lineBaseOptions,
                plugins: {
                  ...lineBaseOptions.plugins,
                  tooltip: {
                    callbacks: {
                      label(context) {
                        const value =
                          typeof context.parsed.y === "number" ? context.parsed.y : Number.NaN;
                        return ` TVL: ${formatUsdCompact(value)}`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          <div className="h-72">
            <Bar
              data={netFlowData}
              options={{
                ...barBaseOptions,
                plugins: {
                  ...barBaseOptions.plugins,
                  tooltip: {
                    callbacks: {
                      label(context) {
                        const value =
                          typeof context.parsed.y === "number" ? context.parsed.y : Number.NaN;
                        return ` Net flow: ${formatUsdCompact(value)}`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </article>
    </section>
  );
}
