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

  /**
   * Brightness ripple across the surface, as a fraction of a particle's shaded brightness (0.22
   * means the lit/dim swing is up to ±22%).
   *
   * This carries "alive" perception at small and mid sizes, where positional displacement
   * cannot: amplitude there is in lattice-cell units, and the LOD system holds a cell to
   * roughly a constant on-screen size (~1.6px), so even a generous positional amplitude is a
   * sub-pixel wobble — invisible regardless of tuning, short of moving particles out of their
   * tiled cells and breaking the voxel grid. A brightness ripple has no such floor: it reads at
   * any particle size because it changes colour, not position.
   */
  shimmerAmplitude: number;
  /** Spatial frequency of the shimmer band. Low keeps it a single sweeping highlight. */
  shimmerScale: number;
  shimmerSpeed: number;
  /**
   * Third harmonic mixed into the shimmer wave. Zero is a soft sinusoid; values near one third
   * sharpen its transitions toward a mechanical pulse while remaining continuous and bounded.
   */
  shimmerHarmonic: number;
  /**
   * Direction vector for the shimmer band, in object space. The wave travels along this axis,
   * so states can point it deliberately — horizontal for reading (left-to-right scan), vertical
   * for a state that wants a top-down flow, radial for later expressive states. The three legacy
   * defaults `(0.7, 1.0, -0.4)` reproduce the original diagonal that idle/listening were tuned
   * against, so raising this to a parameter did not change how any existing state looks.
   */
  shimmerDirX: number;
  shimmerDirY: number;
  shimmerDirZ: number;

  /** Slow whole-head sway, in radians, applied to the camera rather than the particles. */
  swayYaw: number;
  swayPitch: number;
  swaySpeed: number;

  /**
   * Fast secondary yaw oscillation summed onto the sway, in radians.
   *
   * A single sinusoid reads as a smooth pendulum however fast you drive it — the velocity curve
   * is always gentle at the extremes. Summing a quick, small oscillation onto a slow, wide one
   * produces sharp changes of direction partway through the sweep, which is what "darting" looks
   * like. Zero for states that want a clean sweep.
   *
   * The speed is deliberately not harmonically related to `swaySpeed`, so the two never realign
   * and the compound motion stays non-repeating.
   */
  swayDartYaw: number;
  swayDartSpeed: number;

  /**
   * Persistent pose offset, in radians. Non-zero values keep the head at a rest tilt — a small
   * yaw is a head cocked to one side (attentive), a downward pitch is a gaze dropped (reading).
   * Distinct from `swayYaw`/`swayPitch`, which oscillate around zero.
   *
   * Applied via {@link swayOffsets} so both backends inherit it for free.
   */
  poseYawBias: number;
  posePitchBias: number;
}

export const STILL_MOTION: MotionParams = {
  breathAmplitude: 0,
  breathSpeed: 0,
  waveAmplitude: 0,
  waveScale: 0,
  waveSpeed: 0,
  jitterAmplitude: 0,
  jitterSpeed: 0,
  shimmerAmplitude: 0,
  shimmerScale: 0,
  shimmerSpeed: 0,
  shimmerHarmonic: 0,
  // Direction is unused when amplitude is zero, but keep it a valid unit-ish vector so the
  // shader never divides through a zero-length input.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,
  swayYaw: 0,
  swayPitch: 0,
  swaySpeed: 0,
  swayDartYaw: 0,
  swayDartSpeed: 0,
  poseYawBias: 0,
  posePitchBias: 0,
};

/**
 * `idle` — waiting, not yet started. Neutral and relaxed, but unmistakably alive: a slow
 * breath, a long travelling swell, and a barely-there shimmer that keeps the surface from ever
 * looking frozen.
 */
export const IDLE_MOTION: MotionParams = {
  breathAmplitude: 0.55,
  breathSpeed: 0.55,

  waveAmplitude: 0.45,
  waveScale: 2.1,
  waveSpeed: 0.37,

  jitterAmplitude: 0.16,
  jitterSpeed: 1.9,

  // The primary carrier of "alive" at inline sizes — see the field comment on shimmerAmplitude.
  shimmerAmplitude: 0.4,
  shimmerScale: 2.6,
  shimmerSpeed: 0.42,
  shimmerHarmonic: 0,
  // Diagonal — the direction the shimmer had before it became a parameter, kept here so
  // idle looks exactly as it did.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,

  swayYaw: 0.07,
  swayPitch: 0.028,
  swaySpeed: 0.23,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  poseYawBias: 0,
  posePitchBias: 0,
};

/**
 * `listening` — receiving input. Alert and focused rather than relaxed.
 *
 * The character comes from four tuned differences against `idle`:
 * - **Head tilted to one side** via a persistent `poseYawBias`. This is the single most
 *   readable cue for "listening"; humans do it involuntarily when concentrating on a voice.
 * - **Suppressed breath and jitter** — attentive stillness. A relaxed breath reads as waiting,
 *   not attending. Dropping to roughly a quarter of `idle`'s values keeps the head from ever
 *   holding truly still (the 30-second alive requirement) while cutting the wandering feel.
 * - **Faster, tighter shimmer** at higher amplitude — quick attentive scanning across the
 *   surface, like eyes tracking an audio source. This is the frequency-domain equivalent of
 *   "leaning in".
 * - **Small, quick sway** that never counter-tilts past centre. Combined with the yaw bias the
 *   head bobs slightly around a tilted rest pose rather than drifting free.
 */
export const LISTENING_MOTION: MotionParams = {
  breathAmplitude: 0.16,
  breathSpeed: 0.9,

  waveAmplitude: 0.14,
  waveScale: 2.8,
  waveSpeed: 0.55,

  jitterAmplitude: 0.05,
  jitterSpeed: 3.2,

  shimmerAmplitude: 0.55,
  shimmerScale: 3.4,
  shimmerSpeed: 0.9,
  shimmerHarmonic: 0,
  // Same diagonal as idle. Listening's *pattern* differs from idle by speed and amplitude,
  // not by the axis it travels along.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,

  swayYaw: 0.03,
  swayPitch: 0.02,
  swaySpeed: 0.45,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Head cocked ~10° to one side, chin dropped a hair. The bias axis is deliberately opposite
  // to `idle`'s three-quarter camera yaw so the tilt reads as an *added* posture rather than
  // deepening the existing turn.
  poseYawBias: -0.18,
  posePitchBias: 0.06,
};

/**
 * `reading` — ingesting existing context or data. Head dipped, eyes scanning across a line.
 *
 * Reading has three cues distinct from `listening` (which is *hearing* attention):
 * - **Gaze dropped** via a downward `posePitchBias` — the head physically tips toward the
 *   material rather than tilting sideways. No yaw bias: reading is straight-ahead attention.
 * - **Horizontal shimmer sweep** — the shimmer direction is aligned with the x-axis, so the
 *   travelling band moves left-to-right across the face like an eye tracking a line. This is
 *   the state that motivated raising shimmer direction to a per-motion parameter; a diagonal
 *   sweep reads as ambient, a horizontal sweep reads as reading.
 * - **A quick lateral sway** on top of the drop, at a rhythm faster than idle's ambient
 *   drift — small horizontal micro-motions of the head, like following a line then flicking
 *   back for the next one.
 *
 * Breath and jitter stay low, similar to `listening` — reading is focused stillness.
 */
export const READING_MOTION: MotionParams = {
  breathAmplitude: 0.14,
  breathSpeed: 0.7,

  waveAmplitude: 0.12,
  waveScale: 3.0,
  waveSpeed: 0.45,

  jitterAmplitude: 0.04,
  jitterSpeed: 2.6,

  shimmerAmplitude: 0.5,
  // Higher spatial frequency than idle so the band reads as a narrower moving line across the
  // face rather than a wide swell — reading is line-by-line, not broad-strokes.
  shimmerScale: 4.2,
  shimmerSpeed: 1.15,
  shimmerHarmonic: 0,
  // Pure x: the shimmer travels along the head's horizontal axis, mimicking the eye path.
  // Zero y and z isolate the direction so the wave is unambiguously left-to-right.
  shimmerDirX: 1,
  shimmerDirY: 0,
  shimmerDirZ: 0,

  // Lateral sway — yaw amplitude is larger than pitch so the dominant movement is side-to-side
  // rather than the nod that `listening` uses. Speed is faster than idle's ambient drift.
  swayYaw: 0.055,
  swayPitch: 0.012,
  swaySpeed: 0.55,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Chin tucked toward the text. No yaw bias — the reader is looking straight down at the
  // page, not off to one side.
  poseYawBias: 0,
  posePitchBias: 0.16,
};

/**
 * `thinking` — reasoning or planning, no external action yet. Gaze lifted and unfocused.
 *
 * The contemplative read comes from being the slowest state in the set, and from looking *away*:
 * - **Chin lifted** — a negative `posePitchBias`, the exact inverse of `reading`'s drop. Looking
 *   up and away from the viewer is the universal "working it out" posture, and pairing it against
 *   reading's dip means the two states are distinguishable from pose alone.
 * - **Slight yaw off-centre** — the gaze is directed somewhere unspecified rather than at the
 *   viewer. Smaller than `listening`'s deliberate cock, so it reads as unfocused rather than
 *   attentive.
 * - **The slowest shimmer of any state** at a broad spatial scale — a wide, lazy swell rather
 *   than a scanning band. Where `reading` narrows the band into a line and speeds it up,
 *   `thinking` does the opposite on both axes.
 * - **Deep, slow breath** — the only state whose breath exceeds `idle`'s. Thinking is not
 *   attentive stillness; it is absorbed, and a long breath cycle carries that.
 * - **Wandering sway** at low speed, so the head drifts as if following a train of thought.
 */
export const THINKING_MOTION: MotionParams = {
  // Deeper and slower than idle — absorbed rather than merely waiting.
  breathAmplitude: 0.7,
  breathSpeed: 0.34,

  waveAmplitude: 0.5,
  waveScale: 1.6,
  waveSpeed: 0.24,

  jitterAmplitude: 0.09,
  jitterSpeed: 1.2,

  shimmerAmplitude: 0.42,
  // Broadest and slowest shimmer in the set: a lazy swell across the whole head. Contrast with
  // reading (scale 4.2, speed 1.15), which is a narrow fast line.
  shimmerScale: 1.5,
  shimmerSpeed: 0.22,
  shimmerHarmonic: 0,
  // Tilted mostly vertical, so the swell rises up the head — motion that leads the eye upward,
  // reinforcing the lifted gaze.
  shimmerDirX: 0.25,
  shimmerDirY: 1,
  shimmerDirZ: 0.15,

  // Wide, slow wander. Larger amplitude than any other tuned state and the lowest speed, so the
  // head drifts rather than bobs.
  swayYaw: 0.09,
  swayPitch: 0.045,
  swaySpeed: 0.17,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Chin lifted, gaze off to one side. Negative pitch is the inverse of reading's +0.16.
  poseYawBias: 0.1,
  posePitchBias: -0.13,
};

/**
 * `searching` — actively retrieving from an external source. Eyes dart across a field while the
 * head scans with them.
 *
 * A fast single sinusoid still reads as a smooth pendulum, not a search: its direction changes
 * only at the two ends of the sweep. Searching therefore layers a small, quick yaw oscillation
 * over a slower, wider scan. Their incommensurate speeds create extra reversals throughout the
 * arc, producing the saccadic "check here — now there" rhythm without a keyframed sequence.
 *
 * The shimmer is narrower, faster, and brighter than reading's horizontal line. Reading follows
 * one line deliberately; searching repeatedly interrogates a wider field. Low breath and wave
 * amplitudes keep the surface focused while the head and highlight do the semantic work.
 */
export const SEARCHING_MOTION: MotionParams = {
  breathAmplitude: 0.12,
  breathSpeed: 0.78,

  waveAmplitude: 0.16,
  waveScale: 3.6,
  waveSpeed: 0.72,

  jitterAmplitude: 0.08,
  jitterSpeed: 4.1,

  shimmerAmplitude: 0.62,
  shimmerScale: 5.2,
  shimmerSpeed: 1.65,
  shimmerHarmonic: 0,
  // Mostly horizontal, with a small depth component so the band wraps across the turned head
  // rather than looking pasted onto the screen.
  shimmerDirX: 1,
  shimmerDirY: 0.08,
  shimmerDirZ: 0.24,

  // Slow wide scan plus quick saccadic corrections. 2.35 / 0.38 is intentionally not an
  // integer ratio, so the corrections never recur at the same place in the broad sweep.
  swayYaw: 0.105,
  swayPitch: 0.018,
  swaySpeed: 0.38,
  swayDartYaw: 0.045,
  swayDartSpeed: 2.35,

  // A slight opposing tilt distinguishes the resting silhouette from the four earlier states.
  // Both offsets are deliberately small: the animated scan, not a held pose, is the main cue.
  poseYawBias: -0.045,
  posePitchBias: -0.025,
};

/**
 * `executing` — running a tool, command, or action. Controlled, mechanical, and precise.
 *
 * The head is almost locked in place: the lowest breath and sway in the tuned set remove the
 * organic wandering that belongs to thought and attention. Activity moves into a strict vertical
 * processing band instead. A third harmonic sharpens that band from a soft glow into a crisp
 * pulse, but the sum remains analytic and continuous — mechanical character without a keyframe
 * tick or a discontinuity.
 *
 * Fine, fast positional texture gives the lattice a controlled machine-like vibration at display
 * sizes. Its amplitude stays well below one cell so the voxel surface never tears apart.
 */
export const EXECUTING_MOTION: MotionParams = {
  // Near-still chassis: the action is deliberate, not breathing or wandering.
  breathAmplitude: 0.06,
  breathSpeed: 1.05,

  waveAmplitude: 0.2,
  waveScale: 4.8,
  waveSpeed: 1.1,

  jitterAmplitude: 0.1,
  jitterSpeed: 5.2,

  shimmerAmplitude: 0.56,
  shimmerScale: 6.2,
  shimmerSpeed: 1.9,
  // The first added odd harmonic in a square-wave series: sharper, still smooth and bounded.
  shimmerHarmonic: 0.33,
  // Pure vertical travel reads as a deterministic processing pass, deliberately orthogonal to
  // reading and searching's horizontal scans.
  shimmerDirX: 0,
  shimmerDirY: 1,
  shimmerDirZ: 0,

  // The smallest periodic camera motion in the tuned set. Enough to stay alive at display size,
  // not enough to undermine the locked, tool-running posture.
  swayYaw: 0.01,
  swayPitch: 0.007,
  swaySpeed: 0.82,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Slight forward-and-across focus. The positive/positive sign pair is unique among tuned states
  // so the posture remains distinguishable in a reduced-motion still.
  poseYawBias: 0.035,
  posePitchBias: 0.045,
};

/**
 * Motion per state. `idle` through `executing` are tuned; the rest inherit `idle` until their own
 * milestones land, so every state animates rather than freezing.
 */
export const STATE_MOTION: Record<ThinkingHeadState, MotionParams> = {
  idle: IDLE_MOTION,
  listening: LISTENING_MOTION,
  reading: READING_MOTION,
  thinking: THINKING_MOTION,
  searching: SEARCHING_MOTION,
  executing: EXECUTING_MOTION,
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

/**
 * Brightness multiplier for a particle at a moment in time, centred on 1.
 *
 * A single low-frequency travelling band, deliberately at different spatial/temporal rates
 * from the positional wave so the two never lock into the same visual rhythm. This is what
 * makes a state look alive independent of particle size — see the field comment on
 * `shimmerAmplitude` for why position alone cannot do this job.
 *
 * The Canvas 2D backend calls this directly. The WebGL vertex shader reimplements it verbatim —
 * the two must stay in step, so any change here needs the same change in `shaders.ts`.
 */
export function shimmerMultiplier(
  px: number,
  py: number,
  pz: number,
  time: number,
  m: MotionParams,
): number {
  const along = px * m.shimmerDirX + py * m.shimmerDirY + pz * m.shimmerDirZ;
  const phase = along * m.shimmerScale + time * m.shimmerSpeed;
  // Normalised by the sum of amplitudes so adding the harmonic never expands the caller's
  // configured brightness range beyond ±shimmerAmplitude.
  const band =
    (Math.sin(phase) + m.shimmerHarmonic * Math.sin(phase * 3)) / (1 + Math.abs(m.shimmerHarmonic));
  return 1 + m.shimmerAmplitude * band;
}

/**
 * Camera offsets for a moment in time: persistent pose bias plus the periodic sway.
 *
 * Applied to the camera, not to each particle — one basis-of-two-trig-calls per frame instead
 * of the same work repeated across thousands of particles, and it actually looks like a head
 * turning. Both backends read this on the CPU, so a per-state tilt propagates for free.
 */
export function swayOffsets(time: number, m: MotionParams): { yaw: number; pitch: number } {
  return {
    yaw:
      m.poseYawBias +
      m.swayYaw * Math.sin(time * m.swaySpeed) +
      m.swayDartYaw * Math.sin(time * m.swayDartSpeed + 0.37),
    // Incommensurate with yaw, so the head traces a slow open path instead of a closed loop.
    pitch: m.posePitchBias + m.swayPitch * Math.sin(time * m.swaySpeed * PHI + 1.1),
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
