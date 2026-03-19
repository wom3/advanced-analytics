import Link from "next/link";
import { headers } from "next/headers";

import type { ApiSuccess } from "@/src/server/api/envelope";
import type {
  SentimentHistoryPoint,
  SentimentScoreResult,
} from "@/src/server/services/sentiment-scoring/service";

import { FactorContributionCharts } from "./factor-contribution-charts";
import { ConfidenceTrendChart } from "./confidence-trend-chart";
import { RegimeHistoryTimelineChart } from "./regime-history-timeline-chart";

const SENTIMENT_PARAMS = {
  mode: "live",
  asset: "bitcoin",
  chain: "Ethereum",
  interval: "1h",
  points: "168",
};

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}%`;
}

function cardTone(label: "bullish" | "neutral" | "bearish"): string {
  if (label === "bullish") {
    return "text-emerald-700 border-emerald-300 bg-emerald-50";
  }
  if (label === "bearish") {
    return "text-rose-700 border-rose-300 bg-rose-50";
  }
  return "text-amber-700 border-amber-300 bg-amber-50";
}

async function loadSentimentData(): Promise<{
  score: SentimentScoreResult;
  history: SentimentHistoryPoint[];
}> {
  const params = new URLSearchParams(SENTIMENT_PARAMS);

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Missing host header for dashboard sentiment request.");
  }

  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const scoreUrl = `${proto}://${host}/api/v1/sentiment/score?${params.toString()}`;
  const historyUrl = `${proto}://${host}/api/v1/sentiment/history?${params.toString()}`;

  const [scoreRes, historyRes] = await Promise.all([
    fetch(scoreUrl, { cache: "no-store" }),
    fetch(historyUrl, { cache: "no-store" }),
  ]);

  if (!scoreRes.ok || !historyRes.ok) {
    throw new Error("Failed to load sentiment deep dive data.");
  }

  const scoreEnvelope = (await scoreRes.json()) as ApiSuccess<SentimentScoreResult>;
  const historyEnvelope = (await historyRes.json()) as ApiSuccess<SentimentHistoryPoint[]>;

  return {
    score: scoreEnvelope.data,
    history: historyEnvelope.data,
  };
}

export const metadata = {
  title: "Sentiment Deep Dive | defi-analytica",
  description: "Sentiment deep-dive page for score context and recent regime observations.",
};

export default async function DashboardSentimentPage() {
  const { score, history } = await loadSentimentData();
  const latestHistory = history.slice(-10).reverse();

  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{
        fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
        background:
          "radial-gradient(circle at 15% 15%, #dcfce7 0, transparent 34%), radial-gradient(circle at 88% 0%, #bfdbfe 0, transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 50%, #e2e8f0 100%)",
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Feature 13
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Sentiment Deep Dive
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
              Focused view of regime state, confidence posture, and recent sentiment trajectory.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm backdrop-blur">
            <p>
              As of: <span className="font-medium text-slate-800">{score.asOf}</span>
            </p>
            <p className="mt-1">
              Confidence:{" "}
              <Link
                href="#confidence-trend-chart"
                className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4"
              >
                {formatPercent(score.confidence * 100, 1)}
              </Link>
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Composite Score
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {formatNumber(score.score, 3)}
            </p>
            <div
              className={`mt-3 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${cardTone(score.label)}`}
            >
              {score.label.toUpperCase()}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Weights Version
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{score.weightsVersion}</p>
            <p className="mt-3 text-xs text-slate-500">Current scoring config revision</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Contributor Coverage
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {score.contributors.positive.length + score.contributors.negative.length}
            </p>
            <p className="mt-3 text-xs text-slate-500">Top directional factors represented</p>
          </article>
        </section>

        <FactorContributionCharts
          positive={score.contributors.positive}
          negative={score.contributors.negative}
        />

        <RegimeHistoryTimelineChart points={history} />

        <ConfidenceTrendChart points={history} />

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent Sentiment Observations</h2>
          <p className="mt-1 text-xs text-slate-500">
            Latest 10 points from sentiment history for quick regime and confidence verification.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-right">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {latestHistory.map((point) => (
                  <tr key={point.timestamp}>
                    <td className="px-3 py-2">{point.timestamp}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(point.score, 3)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(point.confidence * 100, 1)}
                    </td>
                    <td className="px-3 py-2 text-right uppercase">{point.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-8 text-sm text-slate-600">
          Feature 13 tasks 1-4 complete: sentiment deep-dive, factor charts, regime timeline, and
          confidence trend.
          <Link
            href="/dashboard"
            className="ml-2 font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
          >
            Back to dashboard
          </Link>
        </footer>
      </section>
    </main>
  );
}
