"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

type MarketState = "bullish" | "neutral" | "bearish";

type ScenePalette = {
  core: string;
  halo: string;
  accents: [string, string, string];
};

type MarketStateSceneProps = {
  state?: MarketState;
  score?: number;
  confidence?: number;
};

type SceneDynamics = {
  background: string;
  groupRotateYSpeed: number;
  groupTiltAmplitude: number;
  corePulseAmplitude: number;
  coreRotateYSpeed: number;
  ringASpeed: number;
  ringBSpeed: number;
  baseLightIntensity: number;
  fillLightIntensity: number;
  emissiveIntensity: number;
  floorOpacity: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function paletteForState(state: MarketState): ScenePalette {
  if (state === "bullish") {
    return {
      core: "#10b981",
      halo: "#86efac",
      accents: ["#34d399", "#059669", "#6ee7b7"],
    };
  }

  if (state === "bearish") {
    return {
      core: "#f43f5e",
      halo: "#fda4af",
      accents: ["#fb7185", "#be123c", "#fecdd3"],
    };
  }

  return {
    core: "#0ea5e9",
    halo: "#93c5fd",
    accents: ["#38bdf8", "#0284c7", "#7dd3fc"],
  };
}

function dynamicsForSentiment(score: number, confidence: number): SceneDynamics {
  const normalizedScore = clamp(score / 2, -1, 1);
  const confidence01 = clamp(confidence, 0, 1);
  const energy = Math.abs(normalizedScore);
  const directionalBoost = normalizedScore > 0 ? normalizedScore : 0;

  return {
    background:
      normalizedScore > 0
        ? "#f0fdf4"
        : normalizedScore < 0
          ? "#fff1f2"
          : "#f8fafc",
    groupRotateYSpeed: 0.22 + confidence01 * 0.2 + energy * 0.08,
    groupTiltAmplitude: 0.05 + confidence01 * 0.05,
    corePulseAmplitude: 0.035 + confidence01 * 0.045 + energy * 0.025,
    coreRotateYSpeed: 0.35 + confidence01 * 0.25 + directionalBoost * 0.2,
    ringASpeed: 0.22 + energy * 0.3,
    ringBSpeed: 0.18 + confidence01 * 0.22,
    baseLightIntensity: 12 + confidence01 * 6 + energy * 5,
    fillLightIntensity: 6 + confidence01 * 3,
    emissiveIntensity: 0.15 + confidence01 * 0.2 + energy * 0.2,
    floorOpacity: 0.13 + confidence01 * 0.1,
  };
}

function AnimatedScene({
  state,
  score,
  confidence,
}: {
  state: MarketState;
  score: number;
  confidence: number;
}) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);

  const palette = useMemo(() => paletteForState(state), [state]);
  const dynamics = useMemo(() => dynamicsForSentiment(score, confidence), [confidence, score]);

  useFrame((clockState) => {
    const t = clockState.clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * dynamics.groupRotateYSpeed;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * dynamics.groupTiltAmplitude;
    }

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.4) * dynamics.corePulseAmplitude;
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y = t * dynamics.coreRotateYSpeed;
    }

    if (ringARef.current) {
      ringARef.current.rotation.z = t * dynamics.ringASpeed;
      ringARef.current.rotation.x = t * (dynamics.ringASpeed * 0.58);
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * dynamics.ringBSpeed;
      ringBRef.current.rotation.y = t * (dynamics.ringBSpeed * 0.88);
    }
  });

  return (
    <>
      <color attach="background" args={[dynamics.background]} />
      <ambientLight intensity={0.55} />
      <pointLight
        position={[4, 3, 3]}
        intensity={dynamics.baseLightIntensity}
        color={palette.halo}
      />
      <pointLight position={[-3, -2, -2]} intensity={dynamics.fillLightIntensity} color="#ffffff" />

      <group ref={groupRef}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[0.75, 1]} />
          <meshStandardMaterial
            color={palette.core}
            emissive={palette.halo}
            emissiveIntensity={dynamics.emissiveIntensity}
            roughness={0.28}
            metalness={0.35}
          />
        </mesh>

        <mesh ref={ringARef} rotation={[Math.PI / 2.8, 0.2, 0.15]}>
          <torusGeometry args={[1.45, 0.04, 20, 120]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.25} metalness={0.72} />
        </mesh>

        <mesh ref={ringBRef} rotation={[Math.PI / 2.2, -0.3, -0.15]}>
          <torusGeometry args={[1.2, 0.03, 20, 100]} />
          <meshStandardMaterial color={palette.accents[1]} roughness={0.28} metalness={0.68} />
        </mesh>

        <mesh position={[0, -1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.8, 72]} />
          <meshStandardMaterial
            color={palette.accents[2]}
            opacity={dynamics.floorOpacity}
            transparent
          />
        </mesh>
      </group>
    </>
  );
}

export function MarketStateScene({
  state = "neutral",
  score = 0,
  confidence = 0,
}: MarketStateSceneProps) {
  const sentimentScore = Number.isFinite(score) ? score : 0;
  const sentimentConfidence = Number.isFinite(confidence) ? confidence : 0;

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
        <Canvas camera={{ position: [0, 0, 4.6], fov: 45 }} dpr={[1, 1.75]}>
          <AnimatedScene state={state} score={sentimentScore} confidence={sentimentConfidence} />
        </Canvas>
      </div>
    </section>
  );
}
