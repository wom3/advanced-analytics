import Link from "next/link";
import { headers } from "next/headers";

import type { ApiSuccess } from "@/src/server/api/envelope";
import type { LlamaNormalizedSeries } from "@/src/server/adapters/defillama/client";

import { FlowCharts } from "./flow-charts";
import { FlowExportActions } from "./flow-export-actions";

export const metadata = {
  title: "Flows Deep Dive | defi-analytica",
  description: "Flows deep-dive page scaffold for DEX volume and TVL analytics.",
};

const DEFAULT_CHAIN = "Ethereum";
const DEFAULT_INTERVAL = "1d";

const CHAIN_OPTIONS = [
  "Ethereum",
  "Solana",
  "Arbitrum",
  "Base",
  "BNB",
  "Polygon",
  "Avalanche",
] as const;

function isSupportedChain(value: string): value is (typeof CHAIN_OPTIONS)[number] {
  return CHAIN_OPTIONS.includes(value as (typeof CHAIN_OPTIONS)[number]);
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveFilters(searchParams: SearchParams | undefined): {
  chain: string;
  protocol: string | undefined;
} {
  const selectedChain = normalizeFilter(firstValue(searchParams?.["chain"]));
  const selectedProtocol = normalizeFilter(firstValue(searchParams?.["protocol"]));
  const chain = selectedChain && isSupportedChain(selectedChain) ? selectedChain : DEFAULT_CHAIN;

  return {
    chain,
    protocol: selectedProtocol,
  };
}

async function loadFlowSeries(filters: { chain: string; protocol?: string }): Promise<{
  volume: LlamaNormalizedSeries;
  tvl: LlamaNormalizedSeries;
  chain: string;
  protocol: string | undefined;
}> {
  const params = new URLSearchParams({
    chain: filters.chain,
    interval: DEFAULT_INTERVAL,
  });
  if (filters.protocol) {
    params.set("protocol", filters.protocol);
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Missing host header for dashboard flows requests.");
  }

  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const volumeUrl = `${proto}://${host}/api/v1/llama/metrics/volume?${params.toString()}`;
  const tvlUrl = `${proto}://${host}/api/v1/llama/metrics/tvl?${params.toString()}`;

  const [volumeRes, tvlRes] = await Promise.all([
    fetch(volumeUrl, { cache: "no-store" }),
    fetch(tvlUrl, { cache: "no-store" }),
  ]);

  if (!volumeRes.ok || !tvlRes.ok) {
    throw new Error("Failed to load flows chart data.");
  }

  const volumeEnvelope = (await volumeRes.json()) as ApiSuccess<LlamaNormalizedSeries>;
  const tvlEnvelope = (await tvlRes.json()) as ApiSuccess<LlamaNormalizedSeries>;

  return {
    volume: volumeEnvelope.data,
    tvl: tvlEnvelope.data,
    chain: filters.chain,
    protocol: filters.protocol,
  };
}

type DashboardFlowsPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

export default async function DashboardFlowsPage({ searchParams }: DashboardFlowsPageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = resolveFilters(resolvedSearchParams);
  const loadFilters = filters.protocol
    ? { chain: filters.chain, protocol: filters.protocol }
    : { chain: filters.chain };
  const { volume, tvl, chain, protocol } = await loadFlowSeries(loadFilters);

  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{
        fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
        background:
          "radial-gradient(circle at 12% 16%, #dbeafe 0, transparent 35%), radial-gradient(circle at 90% 5%, #cffafe 0, transparent 30%), linear-gradient(180deg, #f8fafc 0%, #ecfeff 45%, #e2e8f0 100%)",
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Feature 14
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Flows Deep Dive
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
              Dedicated workspace for volume and TVL flow analytics, built in staged tasks.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-xs text-slate-600 shadow-sm backdrop-blur">
            <p>
              Route: <span className="font-medium text-slate-800">/dashboard/flows</span>
            </p>
            <p className="mt-1">
              Status: <span className="font-medium text-slate-800">Task 4 implemented</span>
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Protocol and Chain Controls</h2>
            <p className="text-xs text-slate-500">Filters are applied via URL query params.</p>
          </div>
          <form action="/dashboard/flows" method="get" className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 md:col-span-1">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Chain
              </span>
              <select
                name="chain"
                defaultValue={chain}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-sky-500 transition focus:ring-2"
              >
                {CHAIN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Protocol (optional)
              </span>
              <input
                name="protocol"
                type="text"
                defaultValue={protocol ?? ""}
                placeholder="uniswap"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-sky-500 transition placeholder:text-slate-400 focus:ring-2"
              />
            </label>

            <div className="flex items-end gap-2 md:col-span-1">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Apply
              </button>
              <Link
                href="/dashboard/flows"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Reset
              </Link>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Active scope: <span className="font-medium text-slate-700">{chain}</span>
            {protocol ? (
              <>
                {" · Protocol: "}
                <span className="font-medium text-slate-700">{protocol}</span>
              </>
            ) : (
              <>{" · Protocol: all"}</>
            )}
          </p>
        </section>

        <FlowCharts volumePoints={volume.points} tvlPoints={tvl.points} chain={chain} />

        <FlowExportActions
          chain={chain}
          protocol={protocol}
          volumePoints={volume.points}
          tvlPoints={tvl.points}
        />

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Feature 14 Complete</h2>
          <p className="mt-2 text-sm text-slate-600">
            Flows route, core charts, protocol-chain controls, and CSV/JSON exports are all
            implemented for Feature 14.
          </p>
        </section>

        <footer className="mt-8 text-sm text-slate-600">
          Feature 14 tasks 1-4 complete: route scaffold, charts, controls, and exports.
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
