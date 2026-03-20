"use client";

import dynamic from "next/dynamic";

import type { MarketStateSceneCanvasProps } from "@/app/dashboard/market-state-scene-canvas";
import { useLowPowerMode, usePrefersReducedMotion } from "@/app/dashboard/scene-preferences";

export type MarketState = "bullish" | "neutral" | "bearish";

type MarketStateSceneProps = {
  state?: MarketState;
  score?: number;
  confidence?: number;
};

const LazyMarketStateSceneCanvas = dynamic<MarketStateSceneCanvasProps>(
  () =>
    import("@/app/dashboard/market-state-scene-canvas").then((module) => ({
      default: module.MarketStateSceneCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-600">
        Loading 3D scene...
      </div>
    ),
  }
);

export function MarketStateScene({
  state = "neutral",
  score = 0,
  confidence = 0,
}: MarketStateSceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLowPowerMode = useLowPowerMode();

  const sentimentScore = Number.isFinite(score) ? score : 0;
  const sentimentConfidence = Number.isFinite(confidence) ? confidence : 0;

  const fallbackToneClass =
    state === "bullish"
      ? "border-emerald-200 bg-emerald-50"
      : state === "bearish"
        ? "border-rose-200 bg-rose-50"
        : "border-sky-200 bg-sky-50";

  const fallbackOrbClass =
    state === "bullish" ? "bg-emerald-500" : state === "bearish" ? "bg-rose-500" : "bg-sky-500";

  const showCanvas = !isLowPowerMode;
  const animate = !prefersReducedMotion;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Market-State Scene</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
            Three.js
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
            Score {sentimentScore.toFixed(2)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
            Confidence {(sentimentConfidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Scene lighting and motion are driven by live sentiment score strength and model confidence.
      </p>
      <div className="mt-4 h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {showCanvas ? (
          <LazyMarketStateSceneCanvas
            state={state}
            score={sentimentScore}
            confidence={sentimentConfidence}
            animate={animate}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center p-5 ${fallbackToneClass}`}
          >
            <div className="text-center">
              <div className={`mx-auto h-16 w-16 rounded-full shadow-sm ${fallbackOrbClass}`} />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Low-power fallback mode active
              </p>
              <p className="mt-1 text-xs text-slate-600">
                WebGL scene paused to reduce device power and data usage.
              </p>
            </div>
          </div>
        )}
      </div>
      {prefersReducedMotion ? (
        <p className="mt-2 text-xs text-slate-500">
          Reduced-motion preference detected: scene animation is paused.
        </p>
      ) : null}
    </section>
  );
}
