import type { ThinkingHeadState } from "./states.js";

/**
 * Continuous motion for a state.
 *
 * The hard requirement is that a state look alive for thirty seconds with no perceptible
 * repeat, and survive being entered or left at an arbitrary moment. Both fall out of building
 * motion from sinusoids whose periods are at irrational ratios: the combined period is
 * effectively infinite, and because a sinusoid has no start or end, entering mid-animation is
 * always phase-safe. There is no keyframe timeline to be part-way through.
 *
 * Spatial coherence is the other half, and it is what makes the motion read as a purposeful
 * swarm rather than television static. Phase is derived from each particle's rest position, so
 * neighbouring particles sit at nearly the same phase and move together; the whole surface
 * ripples as a body. Seeding phase from a per-particle random value instead would give every
 * particle an independent wobble, which reads as noise no matter how small the amplitude.
 *
 * Amplitudes are in **lattice cell units**, so motion is the same visual magnitude at every
 * level of detail. In world units a one-unit wobble would be invisible on a fine lattice and
 * violent on a coarse one.
 */
export interface MotionParams {
  /** Whole-surface in/out breath along the normal. */
  breathAmplitude: number;
  breathSpeed: number;

  /** Travelling wave over the surface. Low `waveScale` keeps neighbours coherent. */
  waveAmplitude: number;
  waveScale: number;
  waveSpeed: number;

  /** Fine high-frequency shimmer. Small — this is the seasoning, not the dish. */
  jitterAmplitude: number;
  jitterSpeed: number;

  /** Slow whole-head sway, in radians, applied to the camera rather than the particles. */
  swayYaw: number;
  swayPitch: number;
  swaySpeed: number;
}

export const STILL_MOTION: MotionParams = {
  breathAmplitude: 0,
  breathSpeed: 0,
  waveAmplitude: 0,
  waveScale: 0,
  waveSpeed: 0,
  jitterAmplitude: 0,
  jitterSpeed: 0,
  swayYaw: 0,
  swayPitch: 0,
  swaySpeed: 0,
};

/**
 * `idle` — waiting, not yet started. Neutral and relaxed, but unmistakably alive: a slow
 * breath, a long travelling swell, and a barely-there shimmer that keeps the surface from ever
 * looking frozen.
 */
export const IDLE_MOTION: MotionParams = {
  breathAmplitude: 0.34,
  breathSpeed: 0.55,

  waveAmplitude: 0.28,
  waveScale: 2.1,
  waveSpeed: 0.37,

  jitterAmplitude: 0.1,
  jitterSpeed: 1.9,

  swayYaw: 0.055,
  swayPitch: 0.022,
  swaySpeed: 0.23,
};

/**
 * Motion per state. Only `idle` is tuned; the rest inherit it until their own milestones land,
 * so every state animates rather than freezing.
 */
export const STATE_MOTION: Record<ThinkingHeadState, MotionParams> = {
  idle: IDLE_MOTION,
  listening: IDLE_MOTION,
  reading: IDLE_MOTION,
  thinking: IDLE_MOTION,
  searching: IDLE_MOTION,
  executing: IDLE_MOTION,
  generating: IDLE_MOTION,
  reviewing: IDLE_MOTION,
  error: IDLE_MOTION,
  done: IDLE_MOTION,
};

/**
 * Irrational-ratio multipliers. Any rational set would make the sum periodic and the loop
 * would eventually become visible; these never realign.
 */
export const PHI = 1.6180339887;
/** GLSL has no standard-library constants, so `shaders.ts` carries this as a literal. */
export const SQRT2 = Math.SQRT2;

/**
 * Displacement along the particle's normal, in cell units.
 *
 * The Canvas 2D backend calls this directly. The WebGL vertex shader reimplements it verbatim —
 * the two must stay in step, so any change here needs the same change in `shaders.ts`.
 */
export function normalDisplacement(
  px: number,
  py: number,
  pz: number,
  time: number,
  m: MotionParams,
): number {
  // Breath: uniform across the surface, so the whole head swells rather than rippling.
  const breath = Math.sin(time * m.breathSpeed);

  // Travelling swell. Two waves along different axes at incommensurate rates; their sum never
  // repeats, and both are low spatial frequency so neighbours stay coherent.
  const waveA = Math.sin((px + py * 0.6) * m.waveScale + time * m.waveSpeed);
  const waveB = Math.sin((pz * PHI - py) * m.waveScale * 0.83 + time * m.waveSpeed * SQRT2);

  // Shimmer: high spatial frequency, so adjacent cells differ. Deliberately tiny.
  const jitter = Math.sin((px * 31.7 + py * 47.3 + pz * 23.1) * 2 + time * m.jitterSpeed);

  return (
    m.breathAmplitude * breath +
    m.waveAmplitude * (waveA + waveB * 0.6) +
    m.jitterAmplitude * jitter
  );
}

/** Camera sway offsets for a moment in time. Applied to the camera, not to each particle. */
export function swayOffsets(time: number, m: MotionParams): { yaw: number; pitch: number } {
  return {
    yaw: m.swayYaw * Math.sin(time * m.swaySpeed),
    // Incommensurate with yaw, so the head traces a slow open path instead of a closed loop.
    pitch: m.swayPitch * Math.sin(time * m.swaySpeed * PHI + 1.1),
  };
}

/**
 * Reduced-motion variant: keeps the state's character but removes displacement.
 *
 * `prefers-reduced-motion` must simplify the indicator, never delete it — the status signal has
 * to survive the preference. A still head with its shading intact still communicates state.
 */
export function reduceMotion(_m: MotionParams): MotionParams {
  return STILL_MOTION;
}
