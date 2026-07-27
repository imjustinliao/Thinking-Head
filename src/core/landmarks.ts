import { classifyRegion, type HeadParams } from "./head.js";
import { REGION, type RegionId } from "./regions.js";

/**
 * Facial feature anchors, used to tag sampled surface points with expression regions.
 *
 * Features are not separate particles placed on top of the surface. The anchors classify points
 * already selected from real anatomy, so expressions retain local handles without changing the
 * neutral silhouette or creating a second synthetic face layer.
 */
export interface FeatureParams {
  /** Horizontal distance from centreline to eye centre. */
  eyeSpread: number;
  eyeHeight: number;
  eyeRadius: number;

  browHeight: number;
  /** Half-length of the brow. */
  browWidth: number;
  /** Vertical rise from the inner to the outer end of the brow. */
  browArc: number;
  browThickness: number;

  mouthHeight: number;
  mouthWidth: number;
  /** Upward bow of the corners. */
  mouthCurve: number;
  mouthThickness: number;

  /** Cells behind this depth are always structural — the face lives on the front. */
  faceDepth: number;
}

export const DEFAULT_FEATURE_PARAMS: FeatureParams = {
  eyeSpread: 0.195,
  eyeHeight: 0.18,
  eyeRadius: 0.085,

  browHeight: 0.25,
  browWidth: 0.15,
  browArc: 0.025,
  browThickness: 0.035,

  mouthHeight: -0.18,
  mouthWidth: 0.2,
  mouthCurve: 0.018,
  mouthThickness: 0.06,

  faceDepth: 0.35,
};

/**
 * Region tag for one surface point. Feature anchors take precedence over structural
 * classification, and only apply on the front of the head.
 */
export function regionOfCell(
  x: number,
  y: number,
  z: number,
  head: HeadParams,
  f: FeatureParams,
): RegionId {
  if (z > f.faceDepth) {
    const ax = Math.abs(x);

    // Eyes: radial, so the tag follows the socket rather than a rectangle.
    const eyeDx = ax - f.eyeSpread;
    const eyeDy = y - f.eyeHeight;
    if (Math.hypot(eyeDx, eyeDy) < f.eyeRadius) {
      return x < 0 ? REGION.eyeR : REGION.eyeL;
    }

    // Brows: a band that rises toward the outer end.
    const along = (ax - f.eyeSpread) / f.browWidth;
    if (Math.abs(along) <= 1) {
      const browY = f.browHeight + Math.abs(along) * f.browArc;
      if (Math.abs(y - browY) < f.browThickness) {
        return x < 0 ? REGION.browR : REGION.browL;
      }
    }

    // Mouth: a bowed band across the centreline.
    if (ax < f.mouthWidth) {
      const t = x / f.mouthWidth;
      const mouthY = f.mouthHeight + t * t * f.mouthCurve;
      if (Math.abs(y - mouthY) < f.mouthThickness) return REGION.mouth;
    }
  }

  return classifyRegion(x, y, z, head);
}

/**
 * Falloff toward the centre of a point's region, 1 at the core. Drives rig influence, so a
 * deformation can taper rather than move a region as a rigid block.
 */
export function weightOfCell(x: number, y: number, region: RegionId, f: FeatureParams): number {
  const ax = Math.abs(x);
  switch (region) {
    case REGION.eyeL:
    case REGION.eyeR: {
      const d = Math.hypot(ax - f.eyeSpread, y - f.eyeHeight) / f.eyeRadius;
      return Math.max(0.05, 1 - d);
    }
    case REGION.browL:
    case REGION.browR:
      return Math.max(0.05, 1 - Math.abs((ax - f.eyeSpread) / f.browWidth));
    case REGION.mouth:
      return Math.max(0.05, 1 - Math.abs(x / f.mouthWidth));
    default:
      return 1;
  }
}
