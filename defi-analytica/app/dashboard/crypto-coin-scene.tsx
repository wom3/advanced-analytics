"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

type CryptoCoinSceneProps = {
  symbol: string;
  price?: number;
  color?: string;
};

function Coin({ color = "#f7931a" }: { color?: string | undefined }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Thin cylinder as a coin */}
      <cylinderGeometry args={[1, 1, 0.1, 64]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export const CryptoCoinScene: React.FC<CryptoCoinSceneProps> = ({ symbol, price, color }) => {
  const coinColorProps = color === undefined ? {} : { color };

  return (
    <div style={{ width: "100%", height: "400px", position: "relative" }}>
      <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} aria-hidden="true" role="presentation">
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1} />

        <Coin {...coinColorProps} />

        <OrbitControls enablePan enableZoom enableRotate />

        {/* Floating UI overlay in 3D space */}
        <Html position={[0, 1.3, 0]} center>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: "12px",
              whiteSpace: "nowrap",
            }}
          >
            {symbol} {price ? `– $${price.toLocaleString()}` : ""}
          </div>
        </Html>
      </Canvas>
    </div>
  );
};
