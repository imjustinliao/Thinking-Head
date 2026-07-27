import type { HeadPointSet } from "./pointset.js";
import { REGION, REGION_COUNT } from "./regions.js";
import type { ThinkingHeadState } from "./states.js";

/**
 * Compact facial control vector.
 *
 * Controls described as signed accept values in [-1, 1]; the rest accept [0, 1]. The
 * deformation kernel clamps every value to that range, so a malformed future custom state cannot
 * tear the point set apart. Left/right follow the existing region tags: left is positive x.
 */
export interface ExpressionParams {
  /** Signed whole-brow lift; negative lowers that side. */
  brow_raiseL: number;
  brow_raiseR: number;
  /** Signed lift of both medial brow ends; negative pulls them down. */
  brow_innerUp: number;
  /** Pulls both medial brow ends inward and down. */
  brow_furrow: number;

  /** Signed socket opening; negative narrows or winks that side. */
  eye_openL: number;
  eye_openR: number;
  /** Signed shared gaze offset in the facial plane. */
  eye_gazeX: number;
  eye_gazeY: number;

  /** Lifts both cheek masses. */
  cheek_raise: number;
  /** Raises and recesses the lower nose mass. */
  nose_scrunch: number;

  /** Signed mouth-corner lift; negative lowers that corner. */
  mouth_cornerUpL: number;
  mouth_cornerUpR: number;
  /** Parts the mouth vertically. */
  mouth_open: number;
  /** Pulls the mouth inward horizontally and forward. */
  mouth_pucker: number;
  /** Compresses the mouth band and recesses it. */
  mouth_press: number;

  /** Rotates the lower jaw down around its measured upper edge. */
  jaw_open: number;
  /** Signed lateral lower-jaw offset. */
  jaw_shiftX: number;
  /** Signed forward lower-jaw offset. */
  jaw_forward: number;
}

export const EXPRESSION_KEYS = [
  "brow_raiseL",
  "brow_raiseR",
  "brow_innerUp",
  "brow_furrow",
  "eye_openL",
  "eye_openR",
  "eye_gazeX",
  "eye_gazeY",
  "cheek_raise",
  "nose_scrunch",
  "mouth_cornerUpL",
  "mouth_cornerUpR",
  "mouth_open",
  "mouth_pucker",
  "mouth_press",
  "jaw_open",
  "jaw_shiftX",
  "jaw_forward",
] as const satisfies readonly (keyof ExpressionParams)[];

export type ExpressionKey = (typeof EXPRESSION_KEYS)[number];

export const NEUTRAL_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  brow_raiseL: 0,
  brow_raiseR: 0,
  brow_innerUp: 0,
  brow_furrow: 0,
  eye_openL: 0,
  eye_openR: 0,
  eye_gazeX: 0,
  eye_gazeY: 0,
  cheek_raise: 0,
  nose_scrunch: 0,
  mouth_cornerUpL: 0,
  mouth_cornerUpR: 0,
  mouth_open: 0,
  mouth_pucker: 0,
  mouth_press: 0,
  jaw_open: 0,
  jaw_shiftX: 0,
  jaw_forward: 0,
});

/** `idle` is the neutral facial baseline every named expression is tuned against. */
export const IDLE_EXPRESSION = NEUTRAL_EXPRESSION;

/**
 * `listening` — alert, receptive attention.
 *
 * The source-facing brow and lid open slightly more than the far side, matching a head cocked
 * toward a speaker without becoming a wide-eyed surprise. A small cheek and mouth-corner lift
 * keeps the attentive face receptive rather than tense.
 */
export const LISTENING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.22,
  brow_raiseR: 0.34,
  brow_innerUp: 0.06,
  eye_openL: 0.12,
  eye_openR: 0.2,
  cheek_raise: 0.1,
  mouth_cornerUpL: 0.08,
  mouth_cornerUpR: 0.08,
  mouth_press: 0.03,
});

/**
 * `reading` — gaze lowered onto existing material with quiet concentration.
 *
 * Both upper lids follow a lowered gaze while the lower lids move less, narrowing the aperture
 * without creating a sleepy symmetric squint. The brows settle only slightly and the mouth stays
 * nearly relaxed; the horizontal shimmer and lateral head motion carry the active scan.
 */
export const READING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: -0.06,
  brow_raiseR: -0.06,
  brow_innerUp: -0.04,
  eye_openL: -0.24,
  eye_openR: -0.24,
  eye_gazeY: -0.38,
  mouth_press: 0.03,
});

/**
 * `thinking` — lifted, unfocused attention with restrained facial asymmetry.
 *
 * The gaze rests above and slightly off-centre while one brow carries more lift than the other.
 * Softly narrowed lids and a small lip purse keep the upward look contemplative rather than
 * surprised; the slow wandering posture supplies the larger searching-within quality.
 */
export const THINKING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.14,
  brow_raiseR: 0.06,
  brow_innerUp: 0.08,
  eye_openL: -0.06,
  eye_openR: -0.02,
  eye_gazeX: 0.12,
  eye_gazeY: 0.28,
  mouth_cornerUpL: -0.02,
  mouth_pucker: 0.08,
  mouth_press: 0.02,
});

/**
 * `searching` — alert external scan with an intentionally lateral gaze.
 *
 * The eyes open and look decisively to one side while the brows lift unequally around a very
 * light medial furrow. A closed, lightly pressed mouth keeps the active scan precise rather than
 * anxious; Searching's two-speed yaw changes the apparent target continuously.
 */
export const SEARCHING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.08,
  brow_raiseR: 0.16,
  brow_furrow: 0.1,
  eye_openL: 0.12,
  eye_openR: 0.18,
  eye_gazeX: 0.34,
  mouth_press: 0.06,
});

/**
 * `executing` — precise forward focus with a firmly stabilised lower face.
 *
 * Symmetrically lowered brows and narrowed lids reduce exploratory movement to a task-facing
 * aperture. A compressed mouth and slight jaw projection brace the face without the stronger
 * inward scrutiny reserved for Reviewing.
 */
export const EXECUTING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: -0.12,
  brow_raiseR: -0.12,
  brow_furrow: 0.18,
  eye_openL: -0.18,
  eye_openR: -0.18,
  mouth_press: 0.2,
  jaw_forward: 0.04,
});

/**
 * `generating` — an open, outward-producing face.
 *
 * Lifted cheeks and gently alert eyes support a visibly parted mouth and small jaw opening. The
 * resulting articulation resembles active speech or release, matching the outward particle pulse
 * without becoming a broad completion smile.
 */
export const GENERATING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.12,
  brow_raiseR: 0.12,
  eye_openL: 0.08,
  eye_openR: 0.08,
  cheek_raise: 0.12,
  mouth_cornerUpL: 0.1,
  mouth_cornerUpR: 0.1,
  mouth_open: 0.45,
  jaw_open: 0.18,
});

/**
 * `reviewing` — narrowed, inward scrutiny during verification.
 *
 * The gaze drops slightly beneath an asymmetric lowered brow and stronger medial furrow. The
 * mouth remains closed and compressed, making the expression evaluative rather than action-ready;
 * the state's repeated nod carries the ongoing comparison.
 */
export const REVIEWING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: -0.12,
  brow_raiseR: -0.16,
  brow_furrow: 0.32,
  eye_openL: -0.26,
  eye_openR: -0.28,
  eye_gazeY: -0.14,
  mouth_press: 0.13,
  jaw_forward: 0.02,
});

/**
 * `error` — a clearly blocked, worried interruption.
 *
 * Raised inner brows oppose a medial furrow while the eyes open and the lower face drops into a
 * small parted frown. A restrained nose scrunch adds tension, ensuring the state remains legible
 * from deformation and rejection motion even when colour is unavailable.
 */
export const ERROR_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_innerUp: 0.34,
  brow_furrow: 0.26,
  eye_openL: 0.22,
  eye_openR: 0.22,
  nose_scrunch: 0.1,
  mouth_cornerUpL: -0.28,
  mouth_cornerUpR: -0.28,
  mouth_open: 0.28,
  jaw_open: 0.1,
});

/**
 * `done` — a warm, settled completion.
 *
 * The lids soften as the cheeks and mouth corners rise into a broad closed smile. Unlike
 * Generating's parted articulation, this face has finished producing and can hold as a calm,
 * unmistakable completion before the transition controller returns it to Idle.
 */
export const DONE_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.05,
  brow_raiseR: 0.05,
  eye_openL: -0.14,
  eye_openR: -0.14,
  cheek_raise: 0.36,
  mouth_cornerUpL: 0.62,
  mouth_cornerUpR: 0.62,
});

/**
 * Facial expression per state. Idle remains the neutral anatomical baseline; every active state
 * owns a distinct facial vector and continuous motion signature.
 */
export const STATE_EXPRESSION: Record<ThinkingHeadState, Readonly<ExpressionParams>> = {
  idle: IDLE_EXPRESSION,
  listening: LISTENING_EXPRESSION,
  reading: READING_EXPRESSION,
  thinking: THINKING_EXPRESSION,
  searching: SEARCHING_EXPRESSION,
  executing: EXECUTING_EXPRESSION,
  generating: GENERATING_EXPRESSION,
  reviewing: REVIEWING_EXPRESSION,
  error: ERROR_EXPRESSION,
  done: DONE_EXPRESSION,
};

/**
 * Region-local anchors derived from a point set rather than from the current procedural head.
 *
 * Both arrays are xyz-packed by stable region id. Keeping this outside `HeadPointSet` preserves
 * the Phase 2 data contract; the values are cheap derived metadata cached once per point set.
 */
export interface ExpressionRigMetrics {
  regionCenter: Float32Array;
  regionHalfExtent: Float32Array;
}

const METRIC_COMPONENTS = REGION_COUNT * 3;

export function createExpressionRigMetrics(): ExpressionRigMetrics {
  return {
    regionCenter: new Float32Array(METRIC_COMPONENTS),
    regionHalfExtent: new Float32Array(METRIC_COMPONENTS),
  };
}

/**
 * Measures region bounds into caller-owned storage.
 *
 * During the scan `regionCenter` holds minima and `regionHalfExtent` holds maxima, so no
 * temporary arrays are needed. Returned centres use the same centred object space as rendering.
 */
export function measureExpressionRig(
  pointSet: HeadPointSet,
  out: ExpressionRigMetrics = createExpressionRigMetrics(),
): ExpressionRigMetrics {
  if (
    out.regionCenter.length < METRIC_COMPONENTS ||
    out.regionHalfExtent.length < METRIC_COMPONENTS
  ) {
    throw new RangeError(`Expression rig metrics require ${METRIC_COMPONENTS} components`);
  }

  const minima = out.regionCenter;
  const maxima = out.regionHalfExtent;
  minima.fill(Number.POSITIVE_INFINITY);
  maxima.fill(Number.NEGATIVE_INFINITY);

  for (let i = 0; i < pointSet.count; i++) {
    const region = pointSet.regionId[i];
    if (region === undefined || region >= REGION_COUNT) continue;
    const metricOffset = region * 3;
    const pointOffset = i * 3;
    for (let axis = 0; axis < 3; axis++) {
      const value = pointSet.positions[pointOffset + axis];
      if (value === undefined) continue;
      minima[metricOffset + axis] = Math.min(minima[metricOffset + axis], value);
      maxima[metricOffset + axis] = Math.max(maxima[metricOffset + axis], value);
    }
  }

  const centre = [pointSet.center.x, pointSet.center.y, pointSet.center.z];
  const minimumExtent = Math.max(pointSet.cellSize * 0.5, 1e-6);
  for (let region = 0; region < REGION_COUNT; region++) {
    const offset = region * 3;
    for (let axis = 0; axis < 3; axis++) {
      const minimum = minima[offset + axis];
      const maximum = maxima[offset + axis];
      if (minimum === undefined || maximum === undefined || !Number.isFinite(minimum + maximum)) {
        minima[offset + axis] = 0;
        maxima[offset + axis] = minimumExtent;
        continue;
      }
      minima[offset + axis] = (minimum + maximum) * 0.5 - (centre[axis] ?? 0);
      maxima[offset + axis] = Math.max((maximum - minimum) * 0.5, minimumExtent);
    }
  }

  return out;
}

const RIG_CACHE = new WeakMap<HeadPointSet, ExpressionRigMetrics>();

/** Returns stable metrics for an immutable point-set identity. */
export function expressionRigOf(pointSet: HeadPointSet): ExpressionRigMetrics {
  const cached = RIG_CACHE.get(pointSet);
  if (cached) return cached;
  const measured = measureExpressionRig(pointSet);
  RIG_CACHE.set(pointSet, measured);
  return measured;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Applies one expression to one centred rest-space particle.
 *
 * `out` is caller-owned scratch with room for six values: deformed xyz followed by its normal
 * xyz. The function allocates nothing and is intentionally scalar so its equations can be
 * mirrored directly in the vertex shader.
 */
export function deformExpressionPoint(
  out: Float32Array,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  region: number,
  weight: number,
  radius: number,
  rig: ExpressionRigMetrics,
  expression: ExpressionParams,
): void {
  out[0] = px;
  out[1] = py;
  out[2] = pz;
  out[3] = nx;
  out[4] = ny;
  out[5] = nz;

  if (region < 0 || region >= REGION_COUNT || region === REGION.cranium) return;

  const offset = region * 3;
  const cx = rig.regionCenter[offset] ?? 0;
  const cy = rig.regionCenter[offset + 1] ?? 0;
  const cz = rig.regionCenter[offset + 2] ?? 0;
  const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
  const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
  const ez = Math.max(rig.regionHalfExtent[offset + 2] ?? 0, 1e-6);
  const lx = clampSigned((px - cx) / ex);
  const ly = clampSigned((py - cy) / ey);
  const lz = clampSigned((pz - cz) / ez);
  const influence = clampUnit(weight);
  const scale = Math.max(0, radius);

  if (region === REGION.browL || region === REGION.browR) {
    const left = region === REGION.browL;
    const side = left ? 1 : -1;
    const raise = clampSigned(left ? expression.brow_raiseL : expression.brow_raiseR);
    const inner = clampUnit((1 - side * lx) * 0.5);
    const innerUp = clampSigned(expression.brow_innerUp);
    const furrow = clampUnit(expression.brow_furrow);
    out[0] = px - side * scale * 0.018 * furrow * inner * influence;
    out[1] =
      py + scale * (0.036 * raise + 0.028 * innerUp * inner - 0.02 * furrow * inner) * influence;
    return;
  }

  if (region === REGION.eyeL || region === REGION.eyeR) {
    // A front-facing ocular surface belongs to the globe, not the eyelid rig. Eye opening moves
    // the surrounding lid particles while the globe remains anatomically spherical behind them.
    if (nz > 0.35) return;
    const open = clampSigned(region === REGION.eyeL ? expression.eye_openL : expression.eye_openR);
    const upperLid = clampUnit(ly * 0.5 + 0.5);
    const gazeY = clampSigned(expression.eye_gazeY);
    out[0] = px + scale * 0.025 * clampSigned(expression.eye_gazeX) * influence;
    out[1] = py + scale * (0.028 * open * ly + (0.016 + 0.01 * upperLid) * gazeY) * influence;
    return;
  }

  if (region === REGION.cheek) {
    const support = clampUnit(1 - Math.abs(ly)) * clampUnit(1 - Math.abs(lz));
    const raise = clampUnit(expression.cheek_raise);
    out[1] = py + scale * 0.024 * raise * support;
    out[2] = pz + scale * 0.012 * raise * support;
    return;
  }

  if (region === REGION.nose) {
    const lower = clampUnit((1 - ly) * 0.5);
    const support = lower * (0.35 + 0.65 * clampUnit(1 - Math.abs(lx)));
    const scrunch = clampUnit(expression.nose_scrunch);
    out[1] = py + scale * 0.018 * scrunch * support;
    out[2] = pz - scale * 0.014 * scrunch * support;
    return;
  }

  if (region === REGION.mouth) {
    const leftMix = clampUnit(lx * 0.5 + 0.5);
    const cornerControl =
      clampSigned(expression.mouth_cornerUpR) +
      (clampSigned(expression.mouth_cornerUpL) - clampSigned(expression.mouth_cornerUpR)) * leftMix;
    const corner = clampUnit(1 - influence);
    const open = clampUnit(expression.mouth_open);
    const split = ly === 0 ? -1 : Math.sign(ly);
    const openingSupport = 0.3 + 0.7 * influence;
    const pucker = clampUnit(expression.mouth_pucker);
    const press = clampUnit(expression.mouth_press);

    out[0] = px - lx * scale * 0.02 * pucker * influence;
    out[1] =
      py +
      scale *
        (0.032 * cornerControl * corner +
          0.022 * open * split * openingSupport -
          0.016 * press * ly * influence);
    out[2] =
      pz +
      scale * (0.025 * pucker * influence - 0.008 * open * influence - 0.012 * press * influence);
    return;
  }

  if (region === REGION.jaw) {
    const hingeY = cy + ey;
    const hinge = clampUnit((hingeY - py) / (2 * ey));
    const angle = 0.22 * clampUnit(expression.jaw_open) * hinge;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const relativeY = py - hingeY;
    const relativeZ = pz - cz;

    out[0] = px + scale * 0.035 * clampSigned(expression.jaw_shiftX) * hinge;
    out[1] = hingeY + relativeY * cosine - relativeZ * sine;
    out[2] =
      cz +
      relativeY * sine +
      relativeZ * cosine +
      scale * 0.04 * clampSigned(expression.jaw_forward) * hinge;
    out[4] = ny * cosine - nz * sine;
    out[5] = ny * sine + nz * cosine;
  }
}
