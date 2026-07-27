import { REGION, type RegionId } from "./regions.js";

/**
 * Global proportions around the baked neutral human surface.
 *
 * These controls scale one coherent identity. They deliberately cannot move isolated facial
 * primitives, because the anatomy now comes from one continuous human surface rather than a
 * composition of procedural shapes.
 */
export interface HeadParams {
  /** Half-width at the broadest cranial section. */
  width: number;
  /** Half-height from crown to the base of the neck. */
  height: number;
  /** Distance from the head centre to the nasal tip. */
  frontDepth: number;
  /** Distance from the head centre to the rear cranium. */
  backDepth: number;
}

export const DEFAULT_HEAD_PARAMS: HeadParams = {
  width: 0.5765,
  height: 0.8412,
  frontDepth: 0.7294,
  backDepth: 0.5885,
};

/**
 * Structural region for a sampled surface point.
 *
 * Feature regions come from the higher-priority landmark classifier. This fallback tags the
 * remaining anatomy without coupling the expression rig to source topology.
 */
export function classifyRegion(px: number, py: number, pz: number, p: HeadParams): RegionId {
  const x = px / p.width;
  const y = py / p.height;
  const front = pz / p.frontDepth;

  if (y < -0.2 && y > -0.7 && front > -0.18) return REGION.jaw;
  if (front > 0.38 && Math.abs(x) < 0.19 && y > -0.34 && y < 0.38) return REGION.nose;
  if (front > 0.18 && Math.abs(x) > 0.14 && Math.abs(x) < 0.76 && y > -0.4 && y < 0.24) {
    return REGION.cheek;
  }
  return REGION.cranium;
}

export function headBounds(p: HeadParams): { x: number; y: number; z: number } {
  return {
    x: p.width,
    y: p.height,
    z: Math.max(p.frontDepth, p.backDepth),
  };
}
