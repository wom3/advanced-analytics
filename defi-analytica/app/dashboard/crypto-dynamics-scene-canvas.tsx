"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

import type { MarketState } from "@/app/dashboard/market-state-scene";

type ScenePalette = {
  core: string;
  glow: string;
  ring: string;
  bars: string;
  haze: string;
};

type SceneDynamics = {
  bg: string;
  pulseAmplitude: number;
  coreSpeed: number;
  ringSpeedA: number;
  ringSpeedB: number;
  barSpeed: number;
  barScaleBase: number;
  barScaleSwing: number;
  lightIntensity: number;
  rimIntensity: number;
  emissiveIntensity: number;
};

export type CryptoDynamicsSceneCanvasProps = {
  state: MarketState;
  score: number;
  confidence: number;
  animate: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function paletteForState(state: MarketState): ScenePalette {
  if (state === "bullish") {
    return {
      core: "#22c55e",
      glow: "#86efac",
      ring: "#14b8a6",
      bars: "#4ade80",
      haze: "#052e16",
    };
  }

  if (state === "bearish") {
    return {
      core: "#f43f5e",
      glow: "#fda4af",
      ring: "#fb7185",
      bars: "#f97316",
      haze: "#3f0a1d",
    };
  }

  return {
    core: "#22d3ee",
    glow: "#67e8f9",
    ring: "#60a5fa",
    bars: "#38bdf8",
    haze: "#082f49",
  };
}

function dynamicsForSentiment(score: number, confidence: number): SceneDynamics {
  const normalizedScore = clamp(score / 2, -1, 1);
  const confidence01 = clamp(confidence, 0, 1);
  const energy = Math.abs(normalizedScore);

  return {
    bg: normalizedScore >= 0 ? "#020617" : "#09090b",
    pulseAmplitude: 0.04 + confidence01 * 0.06 + energy * 0.05,
    coreSpeed: 0.25 + confidence01 * 0.35,
    ringSpeedA: 0.18 + energy * 0.35,
    ringSpeedB: 0.14 + confidence01 * 0.28,
    barSpeed: 0.9 + energy * 1.2,
    barScaleBase: 0.5 + confidence01 * 0.25,
    barScaleSwing: 0.4 + energy * 0.55,
    lightIntensity: 18 + confidence01 * 8 + energy * 8,
    rimIntensity: 9 + confidence01 * 5,
    emissiveIntensity: 0.35 + confidence01 * 0.25 + energy * 0.2,
  };
}

function CryptoDynamicsGeometry({
  state,
  score,
  confidence,
  animate,
}: CryptoDynamicsSceneCanvasProps) {
  const rootRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);
  const barRefs = useRef<Array<Mesh | null>>([]);

  const palette = useMemo(() => paletteForState(state), [state]);
  const dynamics = useMemo(() => dynamicsForSentiment(score, confidence), [confidence, score]);

  const barAngles = useMemo(
    () => Array.from({ length: 18 }, (_, index) => (index / 18) * Math.PI * 2),
    []
  );

  useFrame((clockState) => {
    if (!animate) {
      return;
    }

    const t = clockState.clock.getElapsedTime();

    if (rootRef.current) {
      rootRef.current.rotation.y = t * 0.14;
      rootRef.current.rotation.x = Math.sin(t * 0.3) * 0.06;
    }

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.9) * dynamics.pulseAmplitude;
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y = t * dynamics.coreSpeed;
    }

    if (ringARef.current) {
      ringARef.current.rotation.z = t * dynamics.ringSpeedA;
      ringARef.current.rotation.x = t * 0.18;
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * dynamics.ringSpeedB;
      ringBRef.current.rotation.y = t * 0.2;
    }

    barRefs.current.forEach((bar, index) => {
      if (!bar) {
        return;
      }

      const wave = Math.sin(t * dynamics.barSpeed + index * 0.4) * 0.5 + 0.5;
      const scaleY = dynamics.barScaleBase + wave * dynamics.barScaleSwing;
      bar.scale.y = Math.max(scaleY, 0.12);
    });
  });

  return (
    <>
      <color attach="background" args={[dynamics.bg]} />
      <fog attach="fog" args={[palette.haze, 4.8, 11]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 2.5, 2]} intensity={dynamics.lightIntensity} color={palette.glow} />
      <pointLight
        position={[-3, -1.5, -2]}
        intensity={dynamics.rimIntensity}
        color={palette.ring}
      />

      <group ref={rootRef}>
        <mesh ref={coreRef}>
          <torusKnotGeometry args={[0.48, 0.16, 170, 32]} />
          <meshStandardMaterial
            color={palette.core}
            emissive={palette.glow}
            emissiveIntensity={dynamics.emissiveIntensity}
            roughness={0.2}
            metalness={0.68}
          />
        </mesh>

        <mesh ref={ringARef} rotation={[Math.PI / 2.2, 0, 0.2]}>
          <torusGeometry args={[1.5, 0.045, 24, 160]} />
          <meshStandardMaterial color={palette.ring} roughness={0.22} metalness={0.8} />
        </mesh>

        <mesh ref={ringBRef} rotation={[Math.PI / 2.7, 0.5, -0.1]}>
          <torusGeometry args={[1.16, 0.03, 20, 132]} />
          <meshStandardMaterial color={palette.glow} roughness={0.2} metalness={0.74} />
        </mesh>

        {barAngles.map((angle, index) => {
          const x = Math.cos(angle) * 2.1;
          const z = Math.sin(angle) * 2.1;
          return (
            <mesh
              key={`flow-bar-${angle.toFixed(6)}`}
              ref={(node) => {
                barRefs.current[index] = node;
              }}
              position={[x, -0.2, z]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[0.08, 0.8, 0.16]} />
              <meshStandardMaterial color={palette.bars} roughness={0.24} metalness={0.7} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

export function CryptoDynamicsSceneCanvas(props: CryptoDynamicsSceneCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 44 }}
      dpr={[1, 1.7]}
      frameloop={props.animate ? "always" : "demand"}
      aria-hidden="true"
      role="presentation"
    >
      <CryptoDynamicsGeometry {...props} />
    </Canvas>
  );
}
