"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import type { SentimentContributor } from "@/src/server/services/sentiment-scoring/service";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type FactorContributionChartsProps = {
  positive: SentimentContributor[];
  negative: SentimentContributor[];
};

const axisLabelColor = "#475569";
const gridColor = "rgba(148, 163, 184, 0.2)";

const sharedHorizontalOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
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
    y: {
      ticks: {
        color: axisLabelColor,
      },
      grid: {
        color: "rgba(148, 163, 184, 0.1)",
      },
    },
  },
};

function toPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

export function FactorContributionCharts({ positive, negative }: FactorContributionChartsProps) {
  const positiveData = {
    labels: positive.map((contributor) => contributor.factorId),
    datasets: [
      {
        label: "Positive Contribution",
        data: positive.map((contributor) => toPercent(contributor.weightedContribution)),
        backgroundColor: "rgba(16, 185, 129, 0.45)",
        borderColor: "#059669",
        borderWidth: 1.5,
        borderRadius: 8,
      },
    ],
  };

  const negativeData = {
    labels: negative.map((contributor) => contributor.factorId),
    datasets: [
      {
        label: "Negative Contribution",
        data: negative.map((contributor) => toPercent(contributor.weightedContribution)),
        backgroundColor: "rgba(244, 63, 94, 0.45)",
        borderColor: "#e11d48",
        borderWidth: 1.5,
        borderRadius: 8,
      },
    ],
  };

  return (
    <section
      id="factor-contribution-charts"
      className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">Factor Contribution Charts</h2>
      <p className="mt-1 text-xs text-slate-500">
        Horizontal bars showing top weighted directional contributors to the latest sentiment score.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-semibold text-emerald-800">Positive Contributors</h3>
          {positive.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No positive contributors available.</p>
          ) : (
            <div className="mt-3 h-64">
              <Bar
                data={positiveData}
                options={{
                  ...sharedHorizontalOptions,
                  scales: {
                    ...sharedHorizontalOptions.scales,
                    x: {
                      ...sharedHorizontalOptions.scales?.["x"],
                      min: 0,
                    },
                  },
                }}
              />
            </div>
          )}
        </article>

        <article className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <h3 className="text-sm font-semibold text-rose-800">Negative Contributors</h3>
          {negative.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No negative contributors available.</p>
          ) : (
            <div className="mt-3 h-64">
              <Bar
                data={negativeData}
                options={{
                  ...sharedHorizontalOptions,
                  scales: {
                    ...sharedHorizontalOptions.scales,
                    x: {
                      ...sharedHorizontalOptions.scales?.["x"],
                      max: 0,
                    },
                  },
                }}
              />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
