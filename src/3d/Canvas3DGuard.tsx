import { Suspense, useEffect, useState, type ReactNode } from 'react';

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

interface Canvas3DGuardProps {
  /** The WebGL/R3F scene to render when the device/preference allows it. */
  children: ReactNode;
  /** Lightweight CSS-only replacement shown otherwise — must be a full visual
   * substitute, not a placeholder, since this is the permanent experience on
   * reduced-motion, touch, low-power, and WebGL-unavailable devices. */
  fallback: ReactNode;
}

/**
 * Single gate every 3D scene in the app mounts through. Per the design spec's
 * "WebGL only where it adds value" rule: no 3D scene may be a hard
 * requirement for using the app, so this always resolves to either the real
 * scene or its CSS fallback, never a loading dead-end.
 */
export default function Canvas3DGuard({ children, fallback }: Canvas3DGuardProps) {
  const [canRender3D, setCanRender3D] = useState<boolean | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 2;
    setCanRender3D(detectWebGL() && !reducedMotion && !coarsePointer && !lowPower);
  }, []);

  if (!canRender3D) return <>{fallback}</>;

  return <Suspense fallback={fallback}>{children}</Suspense>;
}
