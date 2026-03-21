"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

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

type TrendChartInstance = ChartJS<"line", number[], string>;
const isDev = process.env.NODE_ENV !== "production";

function logTrendTelemetry(message: string, payload?: Record<string, number | string | boolean>) {
  if (!isDev) {
    return;
  }

  if (payload) {
    console.debug(`[trend-widgets] ${message}`, payload);
    return;
  }

  console.debug(`[trend-widgets] ${message}`);
}

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
  resizeDelay: 100,
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
  const scoreChartRef = useRef<TrendChartInstance | null>(null);
  const confidenceChartRef = useRef<TrendChartInstance | null>(null);
  const lastPointCountRef = useRef<number | null>(null);

  const normalizedPoints = useMemo(
    () =>
      points.filter((point) => {
        const timestampMs = Date.parse(point.timestamp);
        return (
          Number.isFinite(timestampMs) &&
          Number.isFinite(point.score) &&
          Number.isFinite(point.confidence)
        );
      }),
    [points]
  );

  const chartPoints = normalizedPoints;

  useEffect(() => {
    const previousCount = lastPointCountRef.current;
    const currentCount = chartPoints.length;

    if (
      previousCount === null ||
      previousCount !== currentCount ||
      currentCount !== points.length
    ) {
      logTrendTelemetry("point-count", {
        receivedPoints: points.length,
        normalizedPoints: currentCount,
        droppedPoints: Math.max(points.length - currentCount, 0),
        previousNormalizedPoints: previousCount ?? -1,
      });
    }

    lastPointCountRef.current = currentCount;
  }, [chartPoints.length, points.length]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const scoreBefore = scoreChartRef.current
        ? {
            width: scoreChartRef.current.width,
            height: scoreChartRef.current.height,
          }
        : null;
      const confidenceBefore = confidenceChartRef.current
        ? {
            width: confidenceChartRef.current.width,
            height: confidenceChartRef.current.height,
          }
        : null;

      scoreChartRef.current?.resize();
      confidenceChartRef.current?.resize();

      logTrendTelemetry("resize-pass", {
        chartPoints: chartPoints.length,
        scoreWidthBefore: scoreBefore?.width ?? -1,
        scoreHeightBefore: scoreBefore?.height ?? -1,
        scoreWidthAfter: scoreChartRef.current?.width ?? -1,
        scoreHeightAfter: scoreChartRef.current?.height ?? -1,
        confidenceWidthBefore: confidenceBefore?.width ?? -1,
        confidenceHeightBefore: confidenceBefore?.height ?? -1,
        confidenceWidthAfter: confidenceChartRef.current?.width ?? -1,
        confidenceHeightAfter: confidenceChartRef.current?.height ?? -1,
      });
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [chartPoints]);

  const labels = chartPoints.map((point) => shortTimeLabel(point.timestamp));

  const scoreChartData = {
    labels,
    datasets: [
      {
        label: "Composite Score",
        data: chartPoints.map((point) => Number(point.score.toFixed(4))),
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
        data: chartPoints.map(() => 1),
        borderColor: "#10b981",
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: "Bearish Threshold",
        data: chartPoints.map(() => -1),
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
        data: chartPoints.map((point) => Number((point.confidence * 100).toFixed(2))),
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Sentiment Score Trend</h2>
          <Link
            href="/dashboard/sentiment"
            className="text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-4"
          >
            Open deep dive
          </Link>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Rolling composite sentiment with bullish and bearish threshold overlays.
        </p>
        <div className="relative mt-4 h-72 min-h-72">
          {chartPoints.length > 0 ? (
            <Line
              ref={scoreChartRef}
              data={scoreChartData}
              options={sharedOptions}
              updateMode="resize"
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50/80 text-xs text-slate-500">
              Trend data is temporarily unavailable. Widgets will recover on the next refresh.
            </div>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Confidence Trend</h2>
          <Link
            href="/dashboard/sentiment#confidence-trend-chart"
            className="text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-4"
          >
            Open deep dive
          </Link>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Model confidence over time based on score strength and factor coverage.
        </p>
        <div className="relative mt-4 h-72 min-h-72">
          {chartPoints.length > 0 ? (
            <Line
              ref={confidenceChartRef}
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
              updateMode="resize"
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50/80 text-xs text-slate-500">
              Confidence data is temporarily unavailable. Widgets will recover on the next refresh.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
