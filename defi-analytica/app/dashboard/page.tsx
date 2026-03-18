import Link from "next/link";

import { buildDashboardOverview } from "@/src/server/services/dashboard/service";

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

export const metadata = {
  title: "Dashboard | defi-analytica",
  description: "KPI dashboard for sentiment-aware crypto analytics.",
};

export default async function DashboardPage() {
  const overview = await buildDashboardOverview({
    mode: "live",
    asset: "bitcoin",
    chain: "Ethereum",
    interval: "1h",
    points: 72,
  });

  const uptimeProviders = overview.providerStatus.filter((provider) => provider.ok).length;
  const uptimePct = Math.round((uptimeProviders / overview.providerStatus.length) * 100);

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

          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm backdrop-blur">
            <p>
              As of: <span className="font-medium text-slate-800">{overview.asOf}</span>
            </p>
            <p className="mt-1">
              Freshness:{" "}
              <span className="font-medium text-slate-800">{overview.freshnessSec}s</span>
            </p>
          </div>
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
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Confidence
            </p>
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
          Next tasks in Feature 12 remain open: charts, sentiment panel, and auto-refresh warnings.
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
