"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

type MarketState = "bullish" | "neutral" | "bearish";

type ScenePalette = {
  core: string;
  halo: string;
  accents: string[];
};

type MarketStateSceneProps = {
  state?: MarketState;
};

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

function AnimatedScene({ state }: { state: MarketState }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);

  const palette = useMemo(() => paletteForState(state), [state]);

  useFrame((clockState) => {
    const t = clockState.clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.25;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.08;
    }

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.4) * 0.06;
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y = t * 0.45;
    }

    if (ringARef.current) {
      ringARef.current.rotation.z = t * 0.35;
      ringARef.current.rotation.x = t * 0.2;
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * 0.25;
      ringBRef.current.rotation.y = t * 0.2;
    }
  });

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 3]} intensity={20} color={palette.halo} />
      <pointLight position={[-3, -2, -2]} intensity={8} color="#ffffff" />

      <group ref={groupRef}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[0.75, 1]} />
          <meshStandardMaterial
            color={palette.core}
            emissive={palette.halo}
            emissiveIntensity={0.25}
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
          <meshStandardMaterial color={palette.accents[2]} opacity={0.2} transparent />
        </mesh>
      </group>
    </>
  );
}

export function MarketStateScene({ state = "neutral" }: MarketStateSceneProps) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Market-State Scene</h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
          Three.js
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Feature 15 task 1 scaffold: single scene component with baseline animated geometry.
      </p>
      <div className="mt-4 h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <Canvas camera={{ position: [0, 0, 4.6], fov: 45 }} dpr={[1, 1.75]}>
          <AnimatedScene state={state} />
        </Canvas>
      </div>
    </section>
  );
}
