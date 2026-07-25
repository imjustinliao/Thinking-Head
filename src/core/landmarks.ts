import { sunflowerDisc } from "./math.js";
import { REGION, type RegionId } from "./regions.js";
import { type HeadParams, headBounds, sdHead, sdHeadNormal } from "./sdf.js";

/**
 * Explicit particle placement for the expressive features.
 *
 * These are generated rather than sampled from the field, because expression legibility
 * depends on particles landing exactly on a brow line or exactly at an eye centre. Stochastic
 * surface sampling will not oblige — and at 20px an eye is roughly nine particles, which is
 * far too few for a random process to be trusted with.
 *
 * Placement works in face-plane (x, y) coordinates and solves for z **on** the head surface,
 * so features are always bonded to the geometry rather than floating in front of it.
 */
export interface FeatureParams {
  /** Horizontal distance from centreline to eye centre. */
  eyeSpread: number;
  /** Eye line height. Set low — a low eye line is most of what reads as neotenous. */
  eyeHeight: number;
  eyeRadius: number;
  /** Particles per eye. */
  eyeDensity: number;

  browHeight: number;
  /** Half-length of the brow stroke. */
  browWidth: number;
  /** Vertical rise from the inner to the outer end of the brow. */
  browArc: number;
  /** Rows of particles making up the brow's thickness. */
  browRows: number;
  browDensity: number;

  mouthHeight: number;
  mouthWidth: number;
  /** Downward bow of the mouth. Positive curves the corners up into a faint smile. */
  mouthCurve: number;
  /** Vertical gap between the upper and lower lip strokes. 0 collapses to a single line. */
  mouthLipGap: number;
  mouthDensity: number;

  /** Explicit nose landmark dots (tip, alae, bridge) so the nose reads front-on. 0 disables. */
  noseDots: number;
}

export const DEFAULT_FEATURE_PARAMS: FeatureParams = {
  eyeSpread: 0.24,
  eyeHeight: -0.04,
  eyeRadius: 0.115,
  eyeDensity: 34,

  browHeight: 0.16,
  browWidth: 0.14,
  browArc: 0.035,
  browRows: 2,
  browDensity: 14,

  mouthHeight: -0.31,
  mouthWidth: 0.15,
  mouthCurve: 0.03,
  mouthLipGap: 0.032,
  mouthDensity: 20,

  noseDots: 5,
};

export interface LandmarkPoints {
  positions: Float32Array;
  normals: Float32Array;
  regionId: Uint8Array;
  /** Falloff toward the feature centre: 1 at the core, approaching 0 at the rim. */
  weight: Float32Array;
  count: number;
}

/**
 * Solves for the surface z at a given (x, y) by scanning inward from outside the head and
 * bisecting the first sign change.
 *
 * A gradient-descent projection would be shorter but it slides x and y as it converges, which
 * is exactly what must not happen here — the whole point is that the caller controls where the
 * feature sits on the face.
 */
function surfaceZ(x: number, y: number, p: HeadParams): number | null {
  const zFar = headBounds(p).z;
  const steps = 24;
  let prevZ = zFar;
  let prevD = sdHead(x, y, prevZ, p);
  if (prevD < 0) return null; // started inside; (x, y) is outside the face plane

  for (let i = 1; i <= steps; i++) {
    const z = zFar - (2 * zFar * i) / steps;
    const d = sdHead(x, y, z, p);
    if (d <= 0) {
      let lo = z;
      let hi = prevZ;
      for (let j = 0; j < 40; j++) {
        const mid = (lo + hi) / 2;
        if (sdHead(x, y, mid, p) <= 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prevZ = z;
    prevD = d;
  }
  return null;
}

/**
 * Generates every feature cluster. Left and right are emitted under separate region ids so the
 * rig can later drive them independently.
 */
export function generateLandmarks(
  head: HeadParams,
  features: FeatureParams,
  jitter: () => number,
): LandmarkPoints {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const regions: number[] = [];
  const weights: number[] = [];

  const push = (x: number, y: number, region: RegionId, weight: number) => {
    const z = surfaceZ(x, y, head);
    if (z === null) return;
    xs.push(x);
    ys.push(y);
    zs.push(z);
    regions.push(region);
    weights.push(weight);
  };

  // --- Eyes: filled discs, golden-angle distributed so even a nine-particle eye is even ---
  for (const side of [-1, 1] as const) {
    const region = side < 0 ? REGION.eyeR : REGION.eyeL;
    const cx = side * features.eyeSpread;
    for (let i = 0; i < features.eyeDensity; i++) {
      const d = sunflowerDisc(i, features.eyeDensity);
      const r = Math.hypot(d.x, d.y);
      const jx = (jitter() - 0.5) * 0.05;
      const jy = (jitter() - 0.5) * 0.05;
      push(
        cx + (d.x + jx) * features.eyeRadius,
        features.eyeHeight + (d.y + jy) * features.eyeRadius,
        region,
        1 - r * 0.85,
      );
    }
  }

  // --- Brows: short arcs rising toward the outer end ---
  for (const side of [-1, 1] as const) {
    const region = side < 0 ? REGION.browR : REGION.browL;
    const perRow = Math.max(2, Math.round(features.browDensity / features.browRows));
    for (let row = 0; row < features.browRows; row++) {
      const rowOffset = (row / Math.max(1, features.browRows - 1) - 0.5) * 0.035;
      for (let i = 0; i < perRow; i++) {
        const t = perRow === 1 ? 0.5 : i / (perRow - 1);
        const along = (t - 0.5) * 2; // -1 inner .. +1 outer
        const x = side * (features.eyeSpread + along * features.browWidth);
        const y = features.browHeight + Math.abs(along) * features.browArc + rowOffset;
        push(x, y, region, 1 - Math.abs(along) * 0.5);
      }
    }
  }

  // --- Mouth: two lip strokes that converge at the corners; corners bow into a half-smile ---
  // Two lips rather than one line is most of what makes the mouth read as a mouth instead of a
  // scratch. The gap collapses toward the corners so the strokes meet like real lips.
  const upperCount = Math.max(3, Math.round(features.mouthDensity * 0.45));
  const lowerCount = Math.max(3, features.mouthDensity - upperCount);
  for (const [rowCount, rowOffset] of [
    [upperCount, features.mouthLipGap / 2],
    [lowerCount, -features.mouthLipGap / 2],
  ] as const) {
    for (let i = 0; i < rowCount; i++) {
      const t = rowCount === 1 ? 0.5 : i / (rowCount - 1);
      const along = (t - 0.5) * 2;
      const gapT = 1 - Math.abs(along); // lips meet at the corners
      const x = along * features.mouthWidth;
      const y = features.mouthHeight + rowOffset * gapT + along * along * features.mouthCurve;
      push(x, y, REGION.mouth, 1 - Math.abs(along) * 0.6);
    }
  }

  // --- Nose landmarks: tip first, then alae, then bridge, in priority order ---
  // The SDF gives the nose its silhouette, but front-on at small sizes only explicit dots make
  // it visible at all.
  const noseTipY = head.noseHeight;
  const noseCandidates: [number, number][] = [
    [0, noseTipY + 0.01],
    [-head.noseWidth * 0.85, noseTipY - 0.025],
    [head.noseWidth * 0.85, noseTipY - 0.025],
    [0, (head.browRidgeHeight + noseTipY) / 2],
    [0, noseTipY - head.noseWidth * 0.5],
  ];
  for (let i = 0; i < Math.min(features.noseDots, noseCandidates.length); i++) {
    const [nx, ny] = noseCandidates[i];
    push(nx, ny, REGION.nose, 1 - i * 0.12);
  }

  const count = xs.length;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regionId = new Uint8Array(count);
  const weight = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = xs[i];
    const y = ys[i];
    const z = zs[i];
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sdHeadNormal(x, y, z, head, normals, i * 3);
    regionId[i] = regions[i];
    weight[i] = weights[i];
  }

  return { positions, normals, regionId, weight, count };
}
