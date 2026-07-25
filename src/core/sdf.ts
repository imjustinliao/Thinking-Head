import { sdEllipsoid, sdSphere, smin } from "./math.js";
import { REGION, type RegionId } from "./regions.js";

/**
 * The head as a signed distance field: a smooth-minimum union of quadrics.
 *
 * Coordinate frame is right-handed with +y up and **+z forward**, so the face points at the
 * default camera. The head is scaled to roughly unit radius about the origin.
 *
 * Proportions default to neotenous mascot: an oversized rounded cranium over a small tapered
 * jaw, with the eye line set low. That is a deliberate structural choice rather than a
 * stylistic one — infant proportions read as friendly and, more importantly, they cannot fall
 * into the uncanny valley the way a near-accurate adult head can.
 */
export interface HeadParams {
  /** Cranium half-extents. Width is generous relative to jaw — this is the neoteny lever. */
  craniumWidth: number;
  craniumHeight: number;
  craniumDepth: number;
  /** Vertical offset of the cranium mass. Positive lifts the skull, enlarging the forehead. */
  craniumLift: number;

  jawWidth: number;
  jawHeight: number;
  jawDepth: number;
  /** How far below the origin the jaw mass sits. */
  jawDrop: number;
  /** Chin narrowing: 1 is a square jaw, lower values taper to a point. */
  chinTaper: number;
  /** Forward push of the chin, keeping the profile from looking receded. */
  chinForward: number;

  cheekRadius: number;
  cheekSpread: number;
  cheekHeight: number;
  cheekForward: number;

  noseLength: number;
  noseWidth: number;
  noseHeight: number;

  /** Brow ridge protrusion. Subtle — an over-strong ridge reads male and stern. */
  browRidge: number;
  browRidgeHeight: number;

  /** Smooth-min blend radius. The difference between one face and a bag of spheres. */
  smoothK: number;
}

export const DEFAULT_HEAD_PARAMS: HeadParams = {
  // Taller than wide. A cranium as wide as it is tall reads as a ball, not a skull.
  craniumWidth: 0.6,
  craniumHeight: 0.7,
  craniumDepth: 0.64,
  craniumLift: 0.2,

  jawWidth: 0.46,
  jawHeight: 0.34,
  jawDepth: 0.5,
  jawDrop: -0.38,
  // A hard taper spikes the chin into a light-bulb point. Chins are rounded.
  chinTaper: 0.62,
  chinForward: 0.1,

  cheekRadius: 0.22,
  cheekSpread: 0.3,
  cheekHeight: -0.14,
  cheekForward: 0.2,

  noseLength: 0.15,
  noseWidth: 0.085,
  noseHeight: -0.1,

  browRidge: 0.075,
  browRidgeHeight: 0.1,

  // Kept small on purpose. Large values are tempting for smoothness but they dissolve the
  // jaw into the cranium and the head loses its chin entirely.
  smoothK: 0.15,
};

/**
 * How far forward the nose sits, as a fraction of cranium depth. Shared by the field and by
 * {@link headBounds} so the bounding box cannot silently stop containing the nose tip.
 */
const NOSE_DEPTH_FRACTION = 0.82;

/** Index into the parts buffer filled by {@link sdHeadParts}. */
export const PART = {
  cranium: 0,
  jaw: 1,
  cheek: 2,
  nose: 3,
  brow: 4,
} as const;

export const PART_COUNT = 5;

/** Maps a structural part back to the region tag stored per particle. */
const PART_REGION: RegionId[] = [
  REGION.cranium,
  REGION.jaw,
  REGION.cheek,
  REGION.nose,
  REGION.cranium, // the brow ridge is cranium mass; brow *particles* are placed explicitly
];

/**
 * Evaluates every primitive, writes the individual distances into `parts`, and returns the
 * blended distance.
 *
 * Both callers need both results — the field for surface projection, the per-part distances
 * for region tagging — so they share one evaluation rather than computing the primitives
 * twice.
 */
export function sdHeadParts(
  px: number,
  py: number,
  pz: number,
  p: HeadParams,
  parts: Float64Array,
): number {
  parts[PART.cranium] = sdEllipsoid(
    px,
    py - p.craniumLift,
    pz,
    p.craniumWidth,
    p.craniumHeight,
    p.craniumDepth,
  );

  // The jaw tapers along its own height rather than being a plain ellipsoid, so the chin
  // comes to a point while the jaw hinge stays wide.
  const jawY = py - p.jawDrop;
  const t = Math.min(Math.max(jawY / p.jawHeight + 1, 0), 2) * 0.5;
  const taperedWidth = p.jawWidth * (p.chinTaper + (1 - p.chinTaper) * t);
  parts[PART.jaw] = sdEllipsoid(
    px,
    jawY,
    pz - p.chinForward,
    taperedWidth,
    p.jawHeight,
    p.jawDepth,
  );

  parts[PART.cheek] = Math.min(
    sdSphere(px - p.cheekSpread, py - p.cheekHeight, pz - p.cheekForward, p.cheekRadius),
    sdSphere(px + p.cheekSpread, py - p.cheekHeight, pz - p.cheekForward, p.cheekRadius),
  );

  // Seated far enough forward that its tip clears the surrounding face. Placed shallower and
  // it simply lives inside the cranium and never shows in profile.
  parts[PART.nose] = sdEllipsoid(
    px,
    py - p.noseHeight,
    pz - NOSE_DEPTH_FRACTION * p.craniumDepth,
    p.noseWidth,
    p.noseWidth * 1.5,
    p.noseLength,
  );

  parts[PART.brow] = sdEllipsoid(
    px,
    py - p.browRidgeHeight,
    pz - p.craniumDepth * 0.45,
    p.craniumWidth * 0.82,
    p.browRidge,
    p.craniumDepth * 0.5,
  );

  let d = smin(parts[PART.cranium], parts[PART.jaw], p.smoothK);
  d = smin(d, parts[PART.cheek], p.smoothK);
  d = smin(d, parts[PART.brow], p.smoothK);
  // The nose blends tighter than everything else, or it dissolves into the face entirely.
  d = smin(d, parts[PART.nose], p.smoothK * 0.45);
  return d;
}

const scratchParts = new Float64Array(PART_COUNT);

export function sdHead(px: number, py: number, pz: number, p: HeadParams): number {
  return sdHeadParts(px, py, pz, p, scratchParts);
}

/**
 * Region tag for a surface point, taken as the nearest contributing primitive.
 *
 * Only structural regions come from here. Eyes, brows and mouth are placed explicitly by the
 * landmark generator, because expression legibility depends on particles landing precisely on
 * a brow line, and an implicit surface will not oblige.
 */
export function classifyRegion(px: number, py: number, pz: number, p: HeadParams): RegionId {
  sdHeadParts(px, py, pz, p, scratchParts);
  let best = 0;
  let bestD = scratchParts[0];
  for (let i = 1; i < PART_COUNT; i++) {
    if (scratchParts[i] < bestD) {
      bestD = scratchParts[i];
      best = i;
    }
  }
  return PART_REGION[best] ?? REGION.cranium;
}

/**
 * Surface normal by central differences. Six field evaluations per point, which is only
 * acceptable because this runs at generation time and never per frame.
 */
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
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  out[offset] = nx / len;
  out[offset + 1] = ny / len;
  out[offset + 2] = nz / len;
}

/**
 * Conservative bounding half-extents. Smooth-min only ever pulls the surface outward from the
 * component primitives, so a margin of `smoothK` covers the blend.
 */
export function headBounds(p: HeadParams): { x: number; y: number; z: number } {
  const m = p.smoothK * 0.5;
  return {
    x: Math.max(p.craniumWidth, p.jawWidth, p.cheekSpread + p.cheekRadius) + m,
    y: Math.max(p.craniumLift + p.craniumHeight, Math.abs(p.jawDrop) + p.jawHeight) + m,
    z: Math.max(p.craniumDepth, NOSE_DEPTH_FRACTION * p.craniumDepth + p.noseLength) + m,
  };
}
