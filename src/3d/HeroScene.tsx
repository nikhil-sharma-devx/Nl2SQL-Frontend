import { Suspense, useRef } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, Line, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useThreeThemePalette } from './useThreeThemePalette';

interface SqlFragmentDef {
  text: string;
  position: [number, number, number];
}

const SQL_FRAGMENTS: SqlFragmentDef[] = [
  { text: 'SELECT *', position: [-1.9, 1.3, -1.0] },
  { text: 'WHERE id =', position: [2.0, -0.5, -0.5] },
  { text: 'JOIN users', position: [-1.7, -1.4, 0.4] },
  { text: 'GROUP BY', position: [1.8, 1.5, 0.5] },
  { text: 'ORDER BY', position: [0.2, -1.9, -1.2] },
];

/** The signature layered glow sphere — icosahedron core + soft outer glow +
 * an independently-rotating energy ring, echoing the existing CSS `AiOrb`
 * but with real depth and lighting. */
function Orb({ color, glow }: { color: string; glow: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (coreRef.current) coreRef.current.rotation.y += delta * 0.15;
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 0.08;
      ringRef.current.rotation.z -= delta * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.25} metalness={0.35} />
      </mesh>
      <mesh scale={1.4}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={glow} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.7, 0.008, 8, 96]} />
        <meshBasicMaterial color={glow} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A floating SQL keyword chip — real DOM text (legible, themeable, no font
 * loading) billboarded at a 3D anchor point via drei's <Html>. */
function SqlFragment({ text, position, color }: SqlFragmentDef & { color: string }) {
  return (
    <Float speed={1.3} rotationIntensity={0.25} floatIntensity={1.1}>
      <Html position={position} center style={{ pointerEvents: 'none' }}>
        <span
          className="whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-[11px]"
          style={{ borderColor: `${color}55`, background: 'rgba(10,12,17,0.55)', color }}
        >
          {text}
        </span>
      </Html>
    </Float>
  );
}

/** Cursor-reactive parallax — the whole scene tilts gently toward the
 * pointer, capped small (spec: no continuous parallax throw > ~100px). */
function CursorParallax({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const targetY = state.pointer.x * 0.22;
    const targetX = -state.pointer.y * 0.16;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
  });
  return <group ref={group}>{children}</group>;
}

/** Faint glowing lines from the orb to each SQL fragment — the "neural
 * connections" implying structure emerging from ambiguity. */
function NeuralLinks({ color }: { color: string }) {
  return (
    <>
      {SQL_FRAGMENTS.map((f) => (
        <Line key={f.text} points={[[0, 0, 0], f.position]} color={color} lineWidth={0.6} transparent opacity={0.16} />
      ))}
    </>
  );
}

/**
 * Cinematic hero background: layered AI orb, floating SQL fragments, curved
 * particles, neural-link glow, cursor-reactive parallax. Transparent canvas
 * so the page's existing atmospheric gradient shows through behind it.
 * Always mounted behind `Canvas3DGuard`, which supplies the CSS fallback.
 */
export default function HeroScene() {
  const palette = useThreeThemePalette();

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
      style={{
        position: 'absolute',
        inset: 0,
        // Fade the top strip of the viewport to transparent so nothing here
        // (sparkles, SQL chips) visually collides with browser-native UI that
        // anchors to the top of the window — password-manager prompts, the
        // Google account picker, etc. — which always render above the page
        // and can't be pushed behind it with z-index.
        maskImage: 'linear-gradient(to bottom, transparent, black 110px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 110px)',
      }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 3, 4]} intensity={1.1} color={palette.chart2} />
      <pointLight position={[-4, -2, -3]} intensity={0.6} color={palette.chart3} />
      <Suspense fallback={null}>
        {/* Offset well clear of the centered auth card (which sits at world
            x≈0) — echoes the CSS fallback's `right-[8%]` orb placement. */}
        <group position={[2.6, -0.3, -0.8]}>
          <CursorParallax>
            <NeuralLinks color={palette.chart2} />
            <Orb color={palette.primary} glow={palette.chart2} />
            {SQL_FRAGMENTS.map((f) => (
              <SqlFragment key={f.text} text={f.text} position={f.position} color={palette.chart2} />
            ))}
          </CursorParallax>
        </group>
        <Sparkles count={90} scale={10} size={1.6} speed={0.25} color={palette.chart3} opacity={0.45} />
      </Suspense>
    </Canvas>
  );
}
