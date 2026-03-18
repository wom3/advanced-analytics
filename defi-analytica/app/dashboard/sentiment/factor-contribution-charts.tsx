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

function colorForPositive(value: number): string {
  const normalized = value / 100;
  if (normalized >= 0.8) {
    return "rgba(5, 150, 105, 0.9)";
  }
  if (normalized >= 0.4) {
    return "rgba(16, 185, 129, 0.72)";
  }
  return "rgba(110, 231, 183, 0.65)";
}

function colorForNegative(value: number): string {
  const normalized = value / 100;
  if (normalized <= -0.8) {
    return "rgba(190, 18, 60, 0.9)";
  }
  if (normalized <= -0.4) {
    return "rgba(244, 63, 94, 0.72)";
  }
  return "rgba(253, 164, 175, 0.65)";
}

export function FactorContributionCharts({ positive, negative }: FactorContributionChartsProps) {
  const positiveValues = positive.map((contributor) => toPercent(contributor.weightedContribution));
  const negativeValues = negative.map((contributor) => toPercent(contributor.weightedContribution));

  const positiveAbsSum = Number(
    positive
      .reduce((sum, contributor) => sum + Math.abs(contributor.weightedContribution), 0)
      .toFixed(4)
  );
  const negativeAbsSum = Number(
    negative
      .reduce((sum, contributor) => sum + Math.abs(contributor.weightedContribution), 0)
      .toFixed(4)
  );

  const positiveData = {
    labels: positive.map((contributor) => contributor.factorId),
    datasets: [
      {
        label: "Positive Contribution",
        data: positiveValues,
        backgroundColor: positiveValues.map((value) => colorForPositive(value)),
        borderColor: "#059669",
        borderWidth: 1.8,
        borderRadius: 8,
        borderSkipped: false,
        minBarLength: 2,
      },
    ],
  };

  const negativeData = {
    labels: negative.map((contributor) => contributor.factorId),
    datasets: [
      {
        label: "Negative Contribution",
        data: negativeValues,
        backgroundColor: negativeValues.map((value) => colorForNegative(value)),
        borderColor: "#e11d48",
        borderWidth: 1.8,
        borderRadius: 8,
        borderSkipped: false,
        minBarLength: 2,
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
        Enhanced directional bars with intensity shading by contribution magnitude.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">Positive Intensity</span>
          <span className="ml-2">{toPercent(positiveAbsSum)}%</span>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-900">
          <span className="font-semibold">Negative Intensity</span>
          <span className="ml-2">{toPercent(negativeAbsSum)}%</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Net Tilt</span>
          <span className="ml-2">{toPercent(positiveAbsSum - negativeAbsSum)}%</span>
        </div>
      </div>

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
                      grid: {
                        color: "rgba(16, 185, 129, 0.15)",
                      },
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
                      grid: {
                        color: "rgba(244, 63, 94, 0.15)",
                      },
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
