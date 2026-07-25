import { sdEllipsoid, sdSphere, smax, smin } from "./math.js";
import { REGION, type RegionId } from "./regions.js";

/**
 * The head as a signed distance field: a smooth-minimum union of quadrics.
 *
 * Coordinate frame is right-handed with +y up and **+z forward**, so the face points at the
 * default camera. The head is scaled to roughly unit radius about the origin.
 *
 * Proportions default to a defined adult head (Justin's direction, 2026-07-24, superseding the
 * original neotenous mascot): realistic skull masses, carved eye sockets, and a real nose line,
 * with the charm carried by the particle medium and motion rather than infant proportions. The
 * mascot look remains reachable through the same parameters.
 */
export interface HeadParams {
  /** Cranium half-extents. Width relative to jaw is the main youthful-vs-adult lever. */
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
  /** Radius of the rounded chin ball. Real chins read from this small mass, not the jaw taper. */
  chinBoss: number;

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

  /**
   * Eye sockets, carved by smooth subtraction. Sockets are what make lighting model the face:
   * their inverted normals fall away from the key light, so the orbits self-shade dark exactly
   * as on a real head. 0 bite disables.
   */
  socketRadius: number;
  socketSpread: number;
  socketHeight: number;
  socketBite: number;

  /** Smooth-min blend radius. The difference between one face and a bag of spheres. */
  smoothK: number;
}

export const DEFAULT_HEAD_PARAMS: HeadParams = {
  // Adult proportions, approved 2026-07-24: definition-first sculpted head rather than the
  // original neotenous mascot. Taller than wide — a cranium as wide as it is tall reads as a
  // ball, not a skull. Less forehead lift than an infant head.
  craniumWidth: 0.58,
  craniumHeight: 0.72,
  craniumDepth: 0.66,
  craniumLift: 0.14,

  jawWidth: 0.46,
  jawHeight: 0.34,
  jawDepth: 0.5,
  // A longer lower face than the mascot pass — adult heads carry more jaw.
  jawDrop: -0.44,
  // A hard taper spikes the chin into a light-bulb point. Chins are rounded.
  chinTaper: 0.62,
  chinForward: 0.1,
  chinBoss: 0.11,

  // Cheek mass sits high and forward — zygomatic, not jowl. This is most of what separates
  // "face" from "egg" in profile and three-quarter views.
  cheekRadius: 0.19,
  cheekSpread: 0.34,
  cheekHeight: -0.06,
  cheekForward: 0.26,

  noseLength: 0.18,
  noseWidth: 0.09,
  noseHeight: -0.1,

  browRidge: 0.095,
  browRidgeHeight: 0.1,

  socketRadius: 0.17,
  socketSpread: 0.24,
  socketHeight: -0.02,
  socketBite: 0.7,

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
  const jawEllipsoid = sdEllipsoid(
    px,
    jawY,
    pz - p.chinForward,
    taperedWidth,
    p.jawHeight,
    p.jawDepth,
  );
  // Rounded chin ball at the front of the jaw — the taper gives the jawline, this gives the chin.
  const chinY = p.jawDrop - p.jawHeight * 0.35;
  const chinZ = p.chinForward + p.jawDepth * 0.8;
  parts[PART.jaw] = Math.min(jawEllipsoid, sdSphere(px, py - chinY, pz - chinZ, p.chinBoss));

  parts[PART.cheek] = Math.min(
    sdSphere(px - p.cheekSpread, py - p.cheekHeight, pz - p.cheekForward, p.cheekRadius),
    sdSphere(px + p.cheekSpread, py - p.cheekHeight, pz - p.cheekForward, p.cheekRadius),
  );

  // Nose as a bridge-to-tip chain of spheres plus two alar wings, rather than one buried
  // ellipsoid. The chain is what makes the profile read as brow -> bridge -> tip like a real
  // nose instead of a bump; the wings widen the base so it reads front-on too.
  const noseTipY = p.noseHeight;
  const noseTipZ = NOSE_DEPTH_FRACTION * p.craniumDepth + p.noseLength * 0.35;
  const bridgeY = p.browRidgeHeight - 0.02;
  const bridgeZ = NOSE_DEPTH_FRACTION * p.craniumDepth - p.noseLength * 0.45;
  let noseD = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 2; i++) {
    const s = i / 2;
    const cy = bridgeY + (noseTipY - bridgeY) * s;
    const cz = bridgeZ + (noseTipZ - bridgeZ) * s;
    const r = p.noseWidth * (0.55 + 0.45 * s);
    noseD = Math.min(noseD, sdSphere(px, py - cy, pz - cz, r));
  }
  const alaR = p.noseWidth * 0.5;
  const alaY = noseTipY - p.noseWidth * 0.25;
  const alaZ = noseTipZ - alaR * 0.7;
  noseD = Math.min(
    noseD,
    sdSphere(px - p.noseWidth * 0.8, py - alaY, pz - alaZ, alaR),
    sdSphere(px + p.noseWidth * 0.8, py - alaY, pz - alaZ, alaR),
  );
  parts[PART.nose] = noseD;

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

  // Sockets are carved after the base masses (so the brow ridge overhangs them) and before the
  // nose (so the bridge stands intact between them). Their concave normals turn away from the
  // key light, which is what shades the orbits dark on the lit head.
  if (p.socketBite > 0) {
    const socketZ = p.craniumDepth * (0.5 + p.socketBite * 0.5);
    const socket = Math.min(
      sdSphere(px - p.socketSpread, py - p.socketHeight, pz - socketZ, p.socketRadius),
      sdSphere(px + p.socketSpread, py - p.socketHeight, pz - socketZ, p.socketRadius),
    );
    d = smax(d, -socket, p.smoothK * 0.7);
  }

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
    // The nose tip sphere is the furthest-forward mass: chain tip centre plus its radius.
    z:
      Math.max(
        p.craniumDepth,
        NOSE_DEPTH_FRACTION * p.craniumDepth + p.noseLength * 0.35 + p.noseWidth,
        p.chinForward + p.jawDepth * 0.8 + p.chinBoss,
      ) + m,
  };
}
