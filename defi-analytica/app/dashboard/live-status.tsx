"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type LiveStatusProps = {
  asOf: string;
  freshnessSec: number;
  autoRefreshMs?: number;
};

type FreshnessTone = "fresh" | "warning" | "stale";

function formatRelativeSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes === 0 ? `${hours}h ago` : `${hours}h ${remMinutes}m ago`;
}

function toneClasses(tone: FreshnessTone): string {
  if (tone === "fresh") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (tone === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-rose-300 bg-rose-50 text-rose-700";
}

export function LiveStatus({ asOf, freshnessSec, autoRefreshMs = 60_000 }: LiveStatusProps) {
  const router = useRouter();
  const parsedAsOfMs = Number.isFinite(Date.parse(asOf)) ? Date.parse(asOf) : null;
  const initialNowMs = parsedAsOfMs === null ? 0 : parsedAsOfMs + freshnessSec * 1_000;

  const [nowMs, setNowMs] = useState(() => initialNowMs);
  const [isPending, startTransition] = useTransition();
  const isPendingRef = useRef(isPending);

  const autoRefreshSec = Math.max(Math.floor(autoRefreshMs / 1_000), 10);
  const autoRefreshIntervalMs = autoRefreshSec * 1_000;

  useEffect(() => {
    const clock = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const autoRefresh = window.setInterval(() => {
      if (isPendingRef.current) {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, autoRefreshIntervalMs);

    return () => {
      window.clearInterval(autoRefresh);
    };
  }, [autoRefreshIntervalMs, router]);

  const dataAgeSec = useMemo(() => {
    if (parsedAsOfMs === null) {
      return Math.max(freshnessSec, 0);
    }
    return Math.max(Math.floor((nowMs - parsedAsOfMs) / 1_000), 0);
  }, [freshnessSec, nowMs, parsedAsOfMs]);

  const warningAfterSec = Math.max(freshnessSec + autoRefreshSec * 2, autoRefreshSec * 3);
  const staleAfterSec = Math.max(freshnessSec + autoRefreshSec * 5, autoRefreshSec * 6);

  const tone: FreshnessTone =
    dataAgeSec >= staleAfterSec ? "stale" : dataAgeSec >= warningAfterSec ? "warning" : "fresh";

  const warningText =
    tone === "stale"
      ? "Data appears stale. Provider updates may be delayed."
      : tone === "warning"
        ? "Data is older than expected. Auto-refresh will keep retrying."
        : "Data freshness is healthy.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${toneClasses(tone)}`}
        >
          {tone}
        </span>
        <span>Auto-refresh every {autoRefreshSec}s</span>
      </div>

      <p className="mt-2">
        As of: <span className="font-medium text-slate-800">{asOf}</span>
      </p>
      <p className="mt-1">
        Data age:{" "}
        <span className="font-medium text-slate-800">{formatRelativeSeconds(dataAgeSec)}</span>
      </p>

      <p className={`mt-2 rounded-lg border px-2 py-1 ${toneClasses(tone)}`}>{warningText}</p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
          disabled={isPending}
        >
          {isPending ? "Refreshing..." : "Refresh now"}
        </button>
      </div>
    </div>
  );
}
