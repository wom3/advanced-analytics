import Link from "next/link";
import { headers } from "next/headers";

import type { ApiSuccess } from "@/src/server/api/envelope";
import type {
  DashboardOverviewResult,
  SentimentBuildMode,
} from "@/src/server/services/dashboard/service";

import { LiveStatus } from "./live-status";
import { TrendWidgets } from "./trend-widgets";

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null, digits = 2): string {
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

function confidenceState(value: number): "high" | "medium" | "low" {
  if (value >= 0.7) {
    return "high";
  }
  if (value >= 0.4) {
    return "medium";
  }
  return "low";
}

export const metadata = {
  title: "Dashboard | defi-analytica",
  description: "KPI dashboard for sentiment-aware crypto analytics.",
};

type SearchParams = Record<string, string | string[] | undefined>;

type DashboardPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveMode(searchParams: SearchParams | undefined): SentimentBuildMode {
  const requestedMode = firstValue(searchParams?.["mode"])?.trim().toLowerCase();
  if (requestedMode === "demo") {
    return "demo";
  }
  if (requestedMode === "live") {
    return "live";
  }
  return process.env.NODE_ENV === "test" ? "demo" : "live";
}

async function loadOverview(mode: SentimentBuildMode): Promise<DashboardOverviewResult> {
  const params = new URLSearchParams({
    mode,
    asset: "bitcoin",
    chain: "Ethereum",
    interval: "1h",
    points: "72",
  });

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Missing host header for dashboard overview request.");
  }

  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/v1/dashboard/overview?${params.toString()}`;
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard overview.");
  }

  const envelope = (await response.json()) as ApiSuccess<DashboardOverviewResult>;
  return envelope.data;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const mode = resolveMode(resolvedSearchParams);
  const overview = await loadOverview(mode);

  const uptimeProviders = overview.providerStatus.filter((provider) => provider.ok).length;
  const uptimePct = Math.round((uptimeProviders / overview.providerStatus.length) * 100);
  const confidenceBand = confidenceState(overview.score.confidence);

  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{
        fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
        background:
          "radial-gradient(circle at 20% 20%, #fef3c7 0, transparent 40%), radial-gradient(circle at 80% 0%, #bae6fd 0, transparent 35%), linear-gradient(180deg, #fff7ed 0%, #f8fafc 60%, #f1f5f9 100%)",
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Feature 12
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Dashboard KPI Cards
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
              Snapshot of current regime, confidence, provider readiness, and core market anchors.
            </p>
          </div>

          <LiveStatus asOf={overview.asOf} freshnessSec={overview.freshnessSec} />
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Composite Score
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {formatNumber(overview.score.score, 3)}
            </p>
            <div
              className={`mt-3 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${cardTone(overview.score.label)}`}
            >
              {overview.score.label.toUpperCase()}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Link
              href={`/dashboard/sentiment?mode=${mode}#confidence-trend-chart`}
              className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 underline decoration-slate-300 underline-offset-4"
            >
              Confidence
            </Link>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {formatPercent(overview.score.confidence * 100, 1)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Weights version {overview.score.weightsVersion}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Provider Readiness
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{uptimePct}%</p>
            <p className="mt-3 text-xs text-slate-500">
              {uptimeProviders} / {overview.providerStatus.length} providers healthy
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              BTC 24H Change
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {formatPercent(overview.market.priceChangePct24h, 2)}
            </p>
            <p className="mt-3 text-xs text-slate-500">Asset: {overview.market.asset}</p>
          </article>
        </section>

        <TrendWidgets
          points={overview.history.map((point) => ({
            timestamp: point.timestamp,
            score: point.score,
            confidence: point.confidence,
          }))}
        />

        {/* <MarketStateScene
          state={overview.score.label}
          score={overview.score.score}
          confidence={overview.score.confidence}
        />

        <CryptoDynamicsScene
          state={overview.score.label}
          score={overview.score.score}
          confidence={overview.score.confidence}
        />

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Crypto Coin Scene</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
              BTC 3D
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            A coin-centric 3D view to complement the broader market-state visualizations.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <CryptoCoinScene
              symbol={overview.market.asset.toUpperCase()}
              {...(overview.market.latestPrice === null
                ? {}
                : { price: overview.market.latestPrice })}
            />
          </div>
        </section> */}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Sentiment State Panel</h2>
            <Link
              href={`/dashboard/sentiment?mode=${mode}`}
              className="text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-4"
            >
              Open deep dive
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Current regime, confidence band, and strongest directional contributors.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <Link
                href={`/dashboard/sentiment?mode=${mode}#regime-history-timeline`}
                className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 underline decoration-slate-300 underline-offset-4"
              >
                Regime State
              </Link>
              <div
                className={`mt-3 inline-flex rounded-full border px-2 py-1 text-xs font-semibold uppercase ${cardTone(overview.score.label)}`}
              >
                {overview.score.label}
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Score:{" "}
                <span className="font-medium text-slate-900">
                  {formatNumber(overview.score.score, 3)}
                </span>
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <Link
                href={`/dashboard/sentiment?mode=${mode}#confidence-trend-chart`}
                className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 underline decoration-slate-300 underline-offset-4"
              >
                Confidence Band
              </Link>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatPercent(overview.score.confidence * 100, 1)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Band:{" "}
                <span className="font-medium capitalize text-slate-900">{confidenceBand}</span>
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Sentiment Anchors
              </p>
              <p className="mt-3 text-sm text-slate-700">
                Fear & Greed:{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(overview.anchors.fearGreedValue, 0)}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Classification:{" "}
                <span className="font-semibold capitalize text-slate-900">
                  {overview.anchors.fearGreedClassification ?? "N/A"}
                </span>
              </p>
            </article>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <Link
                href={`/dashboard/sentiment?mode=${mode}#factor-contribution-charts`}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 underline decoration-emerald-300 underline-offset-4"
              >
                Top Positive Contributors
              </Link>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {overview.score.contributors.positive.length === 0 ? (
                  <li className="text-slate-500">No positive contributors available.</li>
                ) : (
                  overview.score.contributors.positive.map((contributor) => (
                    <li
                      key={`pos-${contributor.factorId}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{contributor.factorId}</span>
                      <span className="font-medium text-emerald-700">
                        +{formatNumber(contributor.weightedContribution * 100, 2)}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </article>

            <article className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <Link
                href={`/dashboard/sentiment?mode=${mode}#factor-contribution-charts`}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 underline decoration-rose-300 underline-offset-4"
              >
                Top Negative Contributors
              </Link>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {overview.score.contributors.negative.length === 0 ? (
                  <li className="text-slate-500">No negative contributors available.</li>
                ) : (
                  overview.score.contributors.negative.map((contributor) => (
                    <li
                      key={`neg-${contributor.factorId}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{contributor.factorId}</span>
                      <span className="font-medium text-rose-700">
                        {formatNumber(contributor.weightedContribution * 100, 2)}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-900">Provider Status</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {overview.providerStatus.map((provider) => (
              <article
                key={provider.provider}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize text-slate-900">
                    {provider.provider}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      provider.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : provider.fallback
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {provider.ok ? "healthy" : provider.fallback ? "fallback" : "degraded"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">Points: {provider.points}</p>
                <p className="mt-1 text-xs text-slate-600">Latency: {provider.latencyMs}ms</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-8 text-sm text-slate-600">
          Feature 12 dashboard core is now complete with live status refresh handling.
          <Link
            href="/"
            className="ml-2 font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
          >
            Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}
