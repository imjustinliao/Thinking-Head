import { sampleCanonicalRelief } from "./canonicalAtlas.js";
import { clamp } from "./math.js";
import { REGION, type RegionId } from "./regions.js";

/**
 * Global proportions around the authored canonical human-head atlas.
 *
 * Facial anatomy is no longer assembled from independently tunable spheres. These controls
 * scale one coherent surface, while `relief` controls how strongly its measured facial planes
 * depart from the underlying ellipsoid.
 */
export interface HeadParams {
  /** Half-width at the broadest cranial section. */
  width: number;
  /** Half-height from crown to chin. */
  height: number;
  /** Front depth before authored facial relief. */
  frontDepth: number;
  /** Rear cranial depth. Human skulls extend further behind the centre than in front. */
  backDepth: number;
  /** Multiplier for the atlas's skull, jaw and facial displacement. */
  relief: number;
}

export const DEFAULT_HEAD_PARAMS: HeadParams = {
  width: 0.63,
  height: 0.8,
  frontDepth: 0.53,
  backDepth: 0.68,
  relief: 1,
};

const MAX_RELIEF = 0.33;

export function headSurfaceRadius(theta: number, phi: number, p: HeadParams): number {
  return 1 + clamp(p.relief, 0, 1.5) * sampleCanonicalRelief(theta, phi);
}

/**
 * Signed radial field of the canonical head.
 *
 * Coordinates are first normalised into an asymmetric ellipsoid, then a regular spherical
 * atlas supplies the target radial displacement. The result is sign-correct and smooth near
 * the surface, which is what voxelisation and normal estimation require. It is not claimed to
 * be an exact Euclidean distance.
 */
export function sdHead(px: number, py: number, pz: number, p: HeadParams): number {
  const qx = px / p.width;
  const qy = py / p.height;
  const depth = pz >= 0 ? p.frontDepth : p.backDepth;
  const qz = pz / depth;
  const radius = Math.hypot(qx, qy, qz);
  const scale = Math.min(p.width, p.height, p.frontDepth, p.backDepth);
  if (radius < 1e-8) return -scale;

  const theta = Math.atan2(qx, qz);
  const phi = Math.asin(clamp(qy / radius, -1, 1));
  const targetRadius = headSurfaceRadius(theta, phi, p);
  return (radius - targetRadius) * scale;
}

/**
 * Structural region for a surface point.
 *
 * Feature regions still come from the higher-priority canonical landmark classifier. This
 * fallback tags the remaining surface by anatomical zone without coupling the rig to atlas
 * texel indices.
 */
export function classifyRegion(px: number, py: number, pz: number, p: HeadParams): RegionId {
  const x = px / p.width;
  const y = py / p.height;
  if (y < -0.24) return REGION.jaw;
  if (pz > 0 && Math.abs(x) < 0.18 && y > -0.3 && y < 0.34) return REGION.nose;
  if (pz > 0 && Math.abs(x) > 0.14 && Math.abs(x) < 0.74 && y > -0.38 && y < 0.23) {
    return REGION.cheek;
  }
  return REGION.cranium;
}

/** Surface normal by central differences, evaluated only during point-set generation. */
export function sdHeadNormal(
  px: number,
  py: number,
  pz: number,
  p: HeadParams,
  out: Float32Array,
  offset: number,
  eps = 1e-3,
): void {
  const nx = sdHead(px + eps, py, pz, p) - sdHead(px - eps, py, pz, p);
  const ny = sdHead(px, py + eps, pz, p) - sdHead(px, py - eps, pz, p);
  const nz = sdHead(px, py, pz + eps, p) - sdHead(px, py, pz - eps, p);
  const length = Math.hypot(nx, ny, nz) || 1;
  out[offset] = nx / length;
  out[offset + 1] = ny / length;
  out[offset + 2] = nz / length;
}

/** Conservative half-extents enclosing the most displaced atlas texel. */
export function headBounds(p: HeadParams): { x: number; y: number; z: number } {
  const reliefBound = 1 + MAX_RELIEF * clamp(p.relief, 0, 1.5);
  return {
    x: p.width * reliefBound,
    y: p.height * reliefBound,
    z: Math.max(p.frontDepth, p.backDepth) * reliefBound,
  };
}
