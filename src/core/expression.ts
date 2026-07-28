import type { MotionParams, MotionPhase } from "./motion.js";
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

  /** Continuous local facial-life amplitudes, blended with the static pose. */
  eye_blink: number;
  eye_scanX: number;
  eye_scanY: number;
  brow_pulse: number;
  mouth_articulate: number;
  jaw_articulate: number;
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
  "eye_blink",
  "eye_scanX",
  "eye_scanY",
  "brow_pulse",
  "mouth_articulate",
  "jaw_articulate",
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
  eye_blink: 0,
  eye_scanX: 0,
  eye_scanY: 0,
  brow_pulse: 0,
  mouth_articulate: 0,
  jaw_articulate: 0,
});

/** `idle` is the neutral facial baseline every named expression is tuned against. */
export const IDLE_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  eye_blink: 0.42,
  eye_scanX: 0.035,
  eye_scanY: 0.02,
});

/**
 * `listening` — alert, receptive attention.
 *
 * The source-facing brow and lid open slightly more than the far side, matching a head cocked
 * toward a speaker without becoming a wide-eyed surprise. A small cheek and mouth-corner lift
 * keeps the attentive face receptive rather than tense.
 */
export const LISTENING_EXPRESSION: Readonly<ExpressionParams> = Object.freeze({
  ...NEUTRAL_EXPRESSION,
  brow_raiseL: 0.42,
  brow_raiseR: 0.58,
  brow_innerUp: 0.12,
  eye_openL: 0.22,
  eye_openR: 0.34,
  cheek_raise: 0.2,
  mouth_cornerUpL: 0.16,
  mouth_cornerUpR: 0.18,
  mouth_press: 0.05,
  eye_blink: 0.32,
  eye_scanX: 0.08,
  eye_scanY: 0.04,
  brow_pulse: 0.06,
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
  brow_raiseL: -0.16,
  brow_raiseR: -0.16,
  brow_innerUp: -0.1,
  eye_openL: -0.38,
  eye_openR: -0.38,
  eye_gazeY: -0.65,
  mouth_cornerUpL: -0.04,
  mouth_cornerUpR: -0.04,
  mouth_press: 0.08,
  eye_blink: 0.24,
  eye_scanX: 0.42,
  eye_scanY: 0.06,
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
  brow_raiseL: 0.34,
  brow_raiseR: 0.08,
  brow_innerUp: 0.16,
  eye_openL: -0.14,
  eye_openR: -0.02,
  eye_gazeX: 0.28,
  eye_gazeY: 0.52,
  mouth_cornerUpL: -0.08,
  mouth_pucker: 0.22,
  mouth_press: 0.05,
  eye_blink: 0.22,
  eye_scanX: 0.16,
  eye_scanY: 0.12,
  brow_pulse: 0.14,
  mouth_articulate: 0.04,
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
  brow_raiseL: 0.18,
  brow_raiseR: 0.36,
  brow_furrow: 0.16,
  eye_openL: 0.24,
  eye_openR: 0.34,
  eye_gazeX: 0.62,
  mouth_cornerUpL: -0.03,
  mouth_cornerUpR: -0.03,
  mouth_press: 0.13,
  eye_blink: 0.16,
  eye_scanX: 0.56,
  eye_scanY: 0.18,
  brow_pulse: 0.08,
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
  brow_raiseL: -0.28,
  brow_raiseR: -0.28,
  brow_furrow: 0.42,
  eye_openL: -0.32,
  eye_openR: -0.32,
  mouth_cornerUpL: -0.05,
  mouth_cornerUpR: -0.05,
  mouth_press: 0.38,
  jaw_forward: 0.12,
  eye_blink: 0.18,
  eye_scanX: 0.04,
  brow_pulse: 0.08,
  mouth_articulate: 0.06,
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
  brow_raiseL: 0.2,
  brow_raiseR: 0.2,
  eye_openL: 0.16,
  eye_openR: 0.16,
  cheek_raise: 0.12,
  mouth_cornerUpL: 0.05,
  mouth_cornerUpR: 0.05,
  mouth_open: 0.28,
  jaw_open: 0.16,
  eye_blink: 0.2,
  eye_scanX: 0.06,
  eye_scanY: 0.04,
  brow_pulse: 0.06,
  mouth_articulate: 0.34,
  jaw_articulate: 0.14,
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
  brow_raiseL: -0.2,
  brow_raiseR: -0.4,
  brow_furrow: 0.65,
  eye_openL: -0.42,
  eye_openR: -0.52,
  eye_gazeX: -0.1,
  eye_gazeY: -0.35,
  mouth_cornerUpL: -0.08,
  mouth_cornerUpR: -0.12,
  mouth_press: 0.3,
  jaw_forward: 0.05,
  eye_blink: 0.2,
  eye_scanX: 0.16,
  eye_scanY: 0.12,
  brow_pulse: 0.14,
  mouth_articulate: 0.04,
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
  brow_innerUp: 0.65,
  brow_furrow: 0.36,
  eye_openL: 0.32,
  eye_openR: 0.32,
  nose_scrunch: 0.35,
  mouth_cornerUpL: -0.62,
  mouth_cornerUpR: -0.62,
  mouth_open: 0.38,
  jaw_open: 0.18,
  eye_blink: 0.14,
  eye_scanX: 0.05,
  eye_scanY: 0.03,
  brow_pulse: 0.16,
  mouth_articulate: 0.1,
  jaw_articulate: 0.05,
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
  brow_raiseL: 0.1,
  brow_raiseR: 0.1,
  eye_openL: -0.32,
  eye_openR: -0.32,
  cheek_raise: 0.58,
  mouth_cornerUpL: 0.85,
  mouth_cornerUpR: 0.85,
  eye_blink: 0.3,
  eye_scanX: 0.04,
  brow_pulse: 0.04,
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

/** Creates caller-owned expression storage for allocation-free frame composition. */
export function createExpressionParams(
  source: Readonly<ExpressionParams> = NEUTRAL_EXPRESSION,
): ExpressionParams {
  return { ...source };
}

/**
 * Composes a settled facial pose with its continuous local behaviour.
 *
 * The integrated facial phase belongs to the transition controller, so changing a state's speed
 * bends the oscillator trajectory instead of jumping it. All amplitude controls are themselves
 * spring-blended expression values. Renderers call this once per frame into persistent storage.
 */
export function animateExpressionInto(
  out: ExpressionParams,
  base: Readonly<ExpressionParams>,
  time: number,
  motion: Readonly<MotionParams>,
  phase?: Readonly<MotionPhase>,
): ExpressionParams {
  for (let i = 0; i < EXPRESSION_KEYS.length; i++) {
    const key = EXPRESSION_KEYS[i];
    out[key] = base[key];
  }

  if (motion.facialSpeed === 0) return out;

  const facialPhase = phase?.facial ?? time * motion.facialSpeed;
  const blinkPhase = phase?.blink ?? time * motion.blinkSpeed;
  const blinkRise = clampUnit((Math.sin(blinkPhase) - 0.992) / 0.008);
  const blink = blinkRise * blinkRise * (3 - 2 * blinkRise);
  const scanX = Math.sin(facialPhase * 1.6180339887 + 0.41);
  const scanY = Math.sin(facialPhase * Math.SQRT2 + 1.17);
  const pulse = Math.sin(facialPhase * 0.73 + 0.82);
  const articulation = 0.5 + 0.5 * Math.sin(facialPhase * 2.31 + 2.04);

  const blinkClosure = base.eye_blink > 0 ? blink * (0.78 + base.eye_blink * 0.22) : 0;
  out.eye_openL = clampSigned(base.eye_openL - blinkClosure);
  out.eye_openR = clampSigned(base.eye_openR - blinkClosure * 0.96);
  out.eye_gazeX = clampSigned(base.eye_gazeX + base.eye_scanX * scanX);
  out.eye_gazeY = clampSigned(base.eye_gazeY + base.eye_scanY * scanY);
  out.brow_raiseL = clampSigned(base.brow_raiseL + base.brow_pulse * pulse);
  out.brow_raiseR = clampSigned(base.brow_raiseR + base.brow_pulse * pulse * 0.78);
  out.mouth_open = clampUnit(base.mouth_open + base.mouth_articulate * articulation);
  out.jaw_open = clampUnit(base.jaw_open + base.jaw_articulate * articulation);
  return out;
}

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

function regionInfluence(
  px: number,
  py: number,
  pz: number,
  region: number,
  weight: number,
  targetRegion: number,
  rig: ExpressionRigMetrics,
  expansion: number,
  haloStrength: number,
): number {
  const offset = targetRegion * 3;
  const cx = rig.regionCenter[offset] ?? 0;
  const cy = rig.regionCenter[offset + 1] ?? 0;
  const cz = rig.regionCenter[offset + 2] ?? 0;
  const ex = Math.max((rig.regionHalfExtent[offset] ?? 0) * expansion, 1e-6);
  const ey = Math.max((rig.regionHalfExtent[offset + 1] ?? 0) * expansion, 1e-6);
  const ez = Math.max((rig.regionHalfExtent[offset + 2] ?? 0) * expansion, 1e-6);
  const distance = Math.hypot((px - cx) / ex, (py - cy) / ey, (pz - cz) / ez);
  const halo = clampUnit((1.65 - distance) / 0.8);
  const core = region === targetRegion ? clampUnit(weight) : 0;
  return Math.max(core, halo * halo * haloStrength);
}

function normaliseExpressionNormal(out: Float32Array): void {
  const length = Math.hypot(out[3], out[4], out[5]) || 1;
  out[3] /= length;
  out[4] /= length;
  out[5] /= length;
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
  expressionScale = 1,
): void {
  out[0] = px;
  out[1] = py;
  out[2] = pz;
  out[3] = nx;
  out[4] = ny;
  out[5] = nz;

  if (region < 0 || region >= REGION_COUNT) return;

  const scale = Math.max(0, radius) * expressionScale;
  if (scale === 0) return;

  for (let brow = 0; brow < 2; brow++) {
    const target = brow === 0 ? REGION.browL : REGION.browR;
    const left = target === REGION.browL;
    const side = left ? 1 : -1;
    const offset = target * 3;
    const cx = rig.regionCenter[offset] ?? 0;
    const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
    const lx = clampSigned((px - cx) / ex);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.45, 0.52);
    if (influence <= 0) continue;
    const raise = clampSigned(left ? expression.brow_raiseL : expression.brow_raiseR);
    const inner = clampUnit((1 - side * lx) * 0.5);
    const innerUp = clampSigned(expression.brow_innerUp);
    const furrow = clampUnit(expression.brow_furrow);
    out[0] -= side * scale * 0.038 * furrow * inner * influence;
    out[1] += scale * (0.058 * raise + 0.05 * innerUp * inner - 0.034 * furrow * inner) * influence;
    out[3] -= side * 0.12 * furrow * inner * influence;
    out[4] += 0.16 * (raise + innerUp * inner) * influence;
  }

  for (let eye = 0; eye < 2; eye++) {
    const target = eye === 0 ? REGION.eyeL : REGION.eyeR;
    const offset = target * 3;
    const cx = rig.regionCenter[offset] ?? 0;
    const cy = rig.regionCenter[offset + 1] ?? 0;
    const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
    const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
    const lx = clampSigned((px - cx) / ex);
    const ly = clampSigned((py - cy) / ey);
    const upperLid = clampUnit(ly * 0.5 + 0.5);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.38, 0.46);
    if (influence <= 0) continue;
    const open = clampSigned(target === REGION.eyeL ? expression.eye_openL : expression.eye_openR);
    const globe = region === target && nz > 0.35;
    const lidInfluence = globe ? 0 : influence;
    const gazeInfluence = globe ? Math.max(0.72, clampUnit(weight)) : influence * 0.24;
    const positionalGazeInfluence = globe ? 0 : influence * 0.18;
    const gazeX = clampSigned(expression.eye_gazeX);
    const gazeY = clampSigned(expression.eye_gazeY);
    out[0] += scale * 0.042 * gazeX * positionalGazeInfluence;
    out[1] +=
      scale *
      (0.056 * open * ly * lidInfluence +
        (0.03 + 0.016 * upperLid) * gazeY * positionalGazeInfluence);
    out[2] -= scale * 0.016 * Math.max(0, -open) * lidInfluence;
    out[3] += 0.08 * gazeX * gazeInfluence - 0.05 * lx * open * lidInfluence;
    out[4] += 0.12 * open * ly * lidInfluence + 0.07 * gazeY * gazeInfluence;
  }

  {
    const target = REGION.cheek;
    const offset = target * 3;
    const cy = rig.regionCenter[offset + 1] ?? 0;
    const cz = rig.regionCenter[offset + 2] ?? 0;
    const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
    const ez = Math.max(rig.regionHalfExtent[offset + 2] ?? 0, 1e-6);
    const ly = clampSigned((py - cy) / ey);
    const lz = clampSigned((pz - cz) / ez);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.18, 0.34);
    const support = influence * clampUnit(1 - Math.abs(ly)) * clampUnit(1 - Math.abs(lz));
    const smile =
      Math.max(
        0,
        (clampSigned(expression.mouth_cornerUpL) + clampSigned(expression.mouth_cornerUpR)) * 0.5,
      ) * 0.38;
    const raise = clampUnit(expression.cheek_raise) + smile;
    out[1] += scale * 0.052 * raise * support;
    out[2] += scale * 0.028 * raise * support;
    out[4] += 0.12 * raise * support;
    out[5] += 0.08 * raise * support;
  }

  {
    const target = REGION.nose;
    const offset = target * 3;
    const cx = rig.regionCenter[offset] ?? 0;
    const cy = rig.regionCenter[offset + 1] ?? 0;
    const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
    const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
    const lx = clampSigned((px - cx) / ex);
    const ly = clampSigned((py - cy) / ey);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.3, 0.38);
    const lower = clampUnit((1 - ly) * 0.5);
    const support = influence * lower * (0.35 + 0.65 * clampUnit(1 - Math.abs(lx)));
    const scrunch = clampUnit(expression.nose_scrunch);
    out[0] += lx * scale * 0.022 * scrunch * support;
    out[1] += scale * 0.036 * scrunch * support;
    out[2] -= scale * 0.03 * scrunch * support;
    out[4] += 0.1 * scrunch * support;
    out[5] -= 0.08 * scrunch * support;
  }

  {
    const target = REGION.mouth;
    const offset = target * 3;
    const cx = rig.regionCenter[offset] ?? 0;
    const cy = rig.regionCenter[offset + 1] ?? 0;
    const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
    const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
    const lx = clampSigned((px - cx) / ex);
    const ly = clampSigned((py - cy) / ey);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.42, 0.42);
    const openingInfluence =
      region === target ? Math.max(clampUnit(weight), influence * 0.65) : influence * 0.08;
    const leftMix = clampUnit(lx * 0.5 + 0.5);
    const cornerControl =
      clampSigned(expression.mouth_cornerUpR) +
      (clampSigned(expression.mouth_cornerUpL) - clampSigned(expression.mouth_cornerUpR)) * leftMix;
    const corner = clampUnit((Math.abs(lx) - 0.2) / 0.8);
    const open = clampUnit(expression.mouth_open);
    const split = ly >= 0 ? 0.3 : -0.7;
    const pucker = clampUnit(expression.mouth_pucker);
    const press = clampUnit(expression.mouth_press);

    out[0] +=
      scale * (-0.046 * lx * pucker + 0.024 * lx * Math.abs(cornerControl) * corner) * influence;
    out[1] +=
      scale *
      (0.068 * cornerControl * corner * influence +
        (0.052 * open * split - 0.032 * press * ly) * openingInfluence);
    out[2] +=
      scale * (0.042 * pucker * influence - (0.014 * open + 0.024 * press) * openingInfluence);
    out[4] +=
      0.18 * cornerControl * corner * influence +
      (0.12 * open * split - 0.1 * press * ly) * openingInfluence;
    out[5] += 0.1 * pucker * influence - 0.08 * press * openingInfluence;
  }

  {
    const target = REGION.jaw;
    const offset = target * 3;
    const cy = rig.regionCenter[offset + 1] ?? 0;
    const cz = rig.regionCenter[offset + 2] ?? 0;
    const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
    const influence = regionInfluence(px, py, pz, region, weight, target, rig, 1.24, 0.48);
    const hingeY = cy + ey;
    const softAttachment = influence * clampUnit((hingeY - py) / (1.65 * ey));
    const jawCoreAttachment = region === target ? clampUnit((hingeY - py) / (0.45 * ey)) : 0;
    const mouthOffset = REGION.mouth * 3;
    const mouthCy = rig.regionCenter[mouthOffset + 1] ?? 0;
    const mouthEy = Math.max(rig.regionHalfExtent[mouthOffset + 1] ?? 0, 1e-6);
    const mouthLy = clampSigned((py - mouthCy) / mouthEy);
    const lowerLipAttachment =
      region === REGION.mouth ? clampUnit((-mouthLy + 0.05) / 0.55) * 0.82 : 0;
    const attachment = Math.max(softAttachment, jawCoreAttachment, lowerLipAttachment);
    const angle = 0.28 * expressionScale * clampUnit(expression.jaw_open);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const relativeY = out[1] - hingeY;
    const relativeZ = out[2] - cz;
    const rotatedY = hingeY + relativeY * cosine - relativeZ * sine;
    const rotatedZ = cz + relativeY * sine + relativeZ * cosine;
    out[0] += attachment * scale * 0.052 * clampSigned(expression.jaw_shiftX);
    out[1] += (rotatedY - out[1]) * attachment;
    out[2] +=
      (rotatedZ - out[2]) * attachment +
      attachment * scale * 0.058 * clampSigned(expression.jaw_forward);
    const rotatedNy = out[4] * cosine - out[5] * sine;
    const rotatedNz = out[4] * sine + out[5] * cosine;
    out[4] += (rotatedNy - out[4]) * attachment;
    out[5] += (rotatedNz - out[5]) * attachment;
  }

  normaliseExpressionNormal(out);
}

/**
 * Applies the eye aperture and moving iris/pupil pattern to front-facing ocular particles.
 *
 * Geometry carries lid and socket deformation; this material cue makes gaze legible when an eye
 * resolves to only a handful of particles. It remains monochrome and is mirrored in the shader.
 */
export function expressionAlbedo(
  baseAlbedo: number,
  px: number,
  py: number,
  nz: number,
  region: number,
  rig: ExpressionRigMetrics,
  expression: Readonly<ExpressionParams>,
): number {
  if ((region !== REGION.eyeL && region !== REGION.eyeR) || nz <= 0.35) return baseAlbedo;

  const offset = region * 3;
  const cx = rig.regionCenter[offset] ?? 0;
  const cy = rig.regionCenter[offset + 1] ?? 0;
  const ex = Math.max(rig.regionHalfExtent[offset] ?? 0, 1e-6);
  const ey = Math.max(rig.regionHalfExtent[offset + 1] ?? 0, 1e-6);
  const lx = clampSigned((px - cx) / ex);
  const ly = clampSigned((py - cy) / ey);
  const open = clampSigned(region === REGION.eyeL ? expression.eye_openL : expression.eye_openR);
  const halfAperture = Math.max(0.025, Math.min(0.46, 0.27 + open * 0.24));
  const aperture = clampUnit((halfAperture - Math.abs(ly)) / 0.09);
  const irisX = clampSigned(expression.eye_gazeX) * 0.42;
  const irisY = clampSigned(expression.eye_gazeY) * 0.32;
  const irisDistance = Math.hypot(lx - irisX, (ly - irisY) * 1.2);
  const iris = clampUnit((0.36 - irisDistance) / 0.16);
  const pupil = clampUnit((0.16 - irisDistance) / 0.08);
  const openEye = 0.74 - iris * 0.26 - pupil * 0.34;
  const lid = baseAlbedo * 0.78;
  return lid + (openEye - lid) * aperture;
}
