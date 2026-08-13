import { lazy } from 'react';
import Canvas3DGuard from '@/3d/Canvas3DGuard';
import SchemaGraph from './SchemaGraph';

// The R3F 3D graph (three/@react-three/fiber/drei) is heavy — keep it out of
// this chunk and only fetch it if Canvas3DGuard decides to render it at all.
const SchemaGraph3D = lazy(() => import('@/3d/SchemaGraph3D'));

interface SchemaGraphExplorerProps {
  highlightedTables?: string[];
}

/**
 * Public entry point for the schema explorer: renders the 3D interactive
 * graph on capable desktop browsers, falling back to the existing 2D
 * (@xyflow/react) graph on reduced-motion/touch/low-power/no-WebGL devices.
 * Both renderers share the same data via `useSchemaGraphData`.
 */
export default function SchemaGraphExplorer({ highlightedTables = [] }: SchemaGraphExplorerProps) {
  return (
    <Canvas3DGuard fallback={<SchemaGraph highlightedTables={highlightedTables} />}>
      <SchemaGraph3D highlightedTables={highlightedTables} />
    </Canvas3DGuard>
  );
}
