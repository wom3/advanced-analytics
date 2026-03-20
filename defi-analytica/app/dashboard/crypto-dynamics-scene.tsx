"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { MarketState } from "@/app/dashboard/market-state-scene";
import type { CryptoDynamicsSceneCanvasProps } from "@/app/dashboard/crypto-dynamics-scene-canvas";

type CryptoDynamicsSceneProps = {
  state?: MarketState;
  score?: number;
  confidence?: number;
};

const LazyCryptoDynamicsSceneCanvas = dynamic<CryptoDynamicsSceneCanvasProps>(
  () =>
    import("@/app/dashboard/crypto-dynamics-scene-canvas").then((module) => ({
      default: module.CryptoDynamicsSceneCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-xs font-medium text-cyan-200">
        Loading crypto dynamics scene...
      </div>
    ),
  }
);

function detectLowPowerMode(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  type NetworkInformation = {
    saveData?: boolean;
    effectiveType?: string;
  };

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  const saveData = connection?.saveData === true;
  const slowNetwork = connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";
  const lowConcurrency = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;

  const navWithDeviceMemory = navigator as Navigator & { deviceMemory?: number };
  const lowMemory =
    typeof navWithDeviceMemory.deviceMemory === "number" && navWithDeviceMemory.deviceMemory <= 4;

  return saveData || slowNetwork || lowConcurrency || lowMemory;
}

function toneClass(state: MarketState): string {
  if (state === "bullish") {
    return "border-emerald-300/40 bg-emerald-400/10 text-emerald-200";
  }
  if (state === "bearish") {
    return "border-rose-300/40 bg-rose-400/10 text-rose-200";
  }
  return "border-cyan-300/40 bg-cyan-400/10 text-cyan-200";
}

export function CryptoDynamicsScene({
  state = "neutral",
  score = 0,
  confidence = 0,
}: CryptoDynamicsSceneProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [isLowPowerMode] = useState(() => detectLowPowerMode());

  const sentimentScore = Number.isFinite(score) ? score : 0;
  const sentimentConfidence = Number.isFinite(confidence) ? confidence : 0;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Crypto Dynamics Scene</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
            Neon 3D
          </span>
          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${toneClass(state)}`}>
            {state.toUpperCase()}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        A denser crypto-native visual: rotating flux rings, pulse core, and liquidity bars driven by
        sentiment.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
          Score {sentimentScore.toFixed(2)}
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
          Confidence {(sentimentConfidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="mt-4 h-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {isLowPowerMode ? (
          <div className="flex h-full w-full items-center justify-center p-6 text-center">
            <div>
              <div className={`mx-auto h-16 w-16 rounded-full border ${toneClass(state)}`} />
              <p className="mt-3 text-sm font-semibold text-slate-200">Low-power fallback active</p>
              <p className="mt-1 text-xs text-slate-400">
                Heavy 3D dynamics paused to preserve battery and responsiveness.
              </p>
            </div>
          </div>
        ) : (
          <LazyCryptoDynamicsSceneCanvas
            state={state}
            score={sentimentScore}
            confidence={sentimentConfidence}
            animate={!prefersReducedMotion}
          />
        )}
      </div>

      {prefersReducedMotion ? (
        <p className="mt-2 text-xs text-slate-500">
          Reduced-motion preference detected: animation cadence is minimized.
        </p>
      ) : null}
    </section>
  );
}
