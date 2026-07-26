import { REGION, type RegionId } from "./regions.js";
import { classifyRegion, type HeadParams } from "./sdf.js";

/**
 * Facial feature anchors, used to tag lattice cells with expression regions.
 *
 * Features are no longer separate particles placed on top of the surface. On a lattice that
 * would break the one rule the whole render model rests on — every particle the same size, on
 * the same grid — because extra points would sit between cells at their own spacing. Instead the
 * anchors *classify* cells that already exist: a cell near the eye centre simply becomes an eye
 * cell. Spacing stays uniform, and the rig still gets its region handles.
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
  eyeSpread: 0.24,
  eyeHeight: -0.02,
  eyeRadius: 0.115,

  browHeight: 0.15,
  browWidth: 0.15,
  browArc: 0.035,
  browThickness: 0.035,

  mouthHeight: -0.3,
  mouthWidth: 0.15,
  mouthCurve: 0.03,
  mouthThickness: 0.08,

  faceDepth: 0.1,
};

/**
 * Region tag for one lattice cell. Feature anchors take precedence over structural
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
 * Falloff toward the centre of a cell's region, 1 at the core. Drives rig influence, so a
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
