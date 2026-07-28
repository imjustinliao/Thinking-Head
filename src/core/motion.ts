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
 * Amplitudes are in **nominal particle-spacing units**, so motion is the same visual magnitude
 * at every level of detail. In world units a one-unit wobble would be invisible on a fine sample and
 * violent on a coarse one.
 */
export interface MotionParams {
  /** Whole-surface in/out breath along the normal. */
  breathAmplitude: number;
  breathSpeed: number;
  /**
   * Non-negative normal push sharing the breath phase. Unlike centred breath, this moves from
   * rest to outward and back, so energy can radiate without making the head alternately implode.
   */
  outwardAmplitude: number;

  /** Travelling wave over the surface. Low `waveScale` keeps neighbours coherent. */
  waveAmplitude: number;
  waveScale: number;
  waveSpeed: number;

  /** Fine high-frequency shimmer. Small — this is the seasoning, not the dish. */
  jitterAmplitude: number;
  jitterSpeed: number;

  /** Shared integrated phase speed for local blink, gaze, brow, mouth, and jaw behaviour. */
  facialSpeed: number;

  /** Uniform lift applied to every particle before the travelling brightness ripple. */
  brightnessBias: number;
  /**
   * Brightness ripple across the surface, as a fraction of a particle's shaded brightness (0.22
   * means the lit/dim swing is up to ±22%).
   *
   * This carries "alive" perception at small and mid sizes, where positional displacement
   * cannot: amplitude there is in particle-spacing units, and the LOD system holds spacing to
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
  /**
   * Mix from the directional shimmer coordinate to radius in the facial xy plane. One produces
   * concentric bands; zero preserves the directional sweep used by every earlier state.
   */
  shimmerRadial: number;
  /**
   * Mix from the selected shimmer coordinate to its absolute value. One mirrors the band across
   * the coordinate origin, allowing paired fronts to converge without a second wave or timeline.
   */
  shimmerMirror: number;

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
   * Persistent pose offset, in radians. Yaw turns toward a source, pitch lifts or drops the
   * gaze, and roll cocks the head toward one shoulder. Distinct from `swayYaw`/`swayPitch`,
   * which oscillate around zero.
   *
   * Applied via {@link swayOffsets} so both backends inherit it for free.
   */
  poseYawBias: number;
  posePitchBias: number;
  poseRollBias: number;
}

export const MOTION_KEYS = [
  "breathAmplitude",
  "breathSpeed",
  "outwardAmplitude",
  "waveAmplitude",
  "waveScale",
  "waveSpeed",
  "jitterAmplitude",
  "jitterSpeed",
  "facialSpeed",
  "brightnessBias",
  "shimmerAmplitude",
  "shimmerScale",
  "shimmerSpeed",
  "shimmerHarmonic",
  "shimmerDirX",
  "shimmerDirY",
  "shimmerDirZ",
  "shimmerRadial",
  "shimmerMirror",
  "swayYaw",
  "swayPitch",
  "swaySpeed",
  "swayDartYaw",
  "swayDartSpeed",
  "poseYawBias",
  "posePitchBias",
  "poseRollBias",
] as const satisfies readonly (keyof MotionParams)[];

export type MotionKey = (typeof MOTION_KEYS)[number];

/**
 * Integrated oscillator phases.
 *
 * A raw `time * speed` phase jumps when speed is blended late in a page's lifetime because the
 * whole elapsed time is multiplied by the changing value. Integrating frequency instead makes
 * speed changes bend the phase trajectory without moving its current position.
 */
export interface MotionPhase {
  breath: number;
  wave: number;
  jitter: number;
  shimmer: number;
  sway: number;
  dart: number;
  facial: number;
}

export function createMotionPhase(
  time = 0,
  motion: MotionParams = STILL_MOTION,
  playbackRate = 1,
): MotionPhase {
  return {
    breath: time * playbackRate * motion.breathSpeed,
    wave: time * playbackRate * motion.waveSpeed,
    jitter: time * playbackRate * motion.jitterSpeed,
    shimmer: time * playbackRate * motion.shimmerSpeed,
    sway: time * playbackRate * motion.swaySpeed,
    dart: time * playbackRate * motion.swayDartSpeed,
    facial: time * playbackRate * motion.facialSpeed,
  };
}

export const STILL_MOTION: MotionParams = {
  breathAmplitude: 0,
  breathSpeed: 0,
  outwardAmplitude: 0,
  waveAmplitude: 0,
  waveScale: 0,
  waveSpeed: 0,
  jitterAmplitude: 0,
  jitterSpeed: 0,
  facialSpeed: 0,
  brightnessBias: 0,
  shimmerAmplitude: 0,
  shimmerScale: 0,
  shimmerSpeed: 0,
  shimmerHarmonic: 0,
  // Direction is unused when amplitude is zero, but keep it a valid unit-ish vector so the
  // shader never divides through a zero-length input.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,
  shimmerRadial: 0,
  shimmerMirror: 0,
  swayYaw: 0,
  swayPitch: 0,
  swaySpeed: 0,
  swayDartYaw: 0,
  swayDartSpeed: 0,
  poseYawBias: 0,
  posePitchBias: 0,
  poseRollBias: 0,
};

/**
 * `idle` — waiting, not yet started. Neutral and relaxed, but unmistakably alive: a slow
 * breath, a long travelling swell, and a barely-there shimmer that keeps the surface from ever
 * looking frozen.
 */
export const IDLE_MOTION: MotionParams = {
  breathAmplitude: 0.55,
  breathSpeed: 0.55,
  outwardAmplitude: 0,

  waveAmplitude: 0.45,
  waveScale: 2.1,
  waveSpeed: 0.37,

  jitterAmplitude: 0.16,
  jitterSpeed: 1.9,
  facialSpeed: 0.54,

  brightnessBias: 0,
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
  shimmerRadial: 0,
  shimmerMirror: 0,

  swayYaw: 0.07,
  swayPitch: 0.028,
  swaySpeed: 0.23,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  poseYawBias: 0,
  posePitchBias: 0,
  poseRollBias: 0,
};

/**
 * `listening` — receiving input. Alert and focused rather than relaxed.
 *
 * The character comes from four tuned differences against `idle`:
 * - **Head tilted toward one shoulder** via a persistent `poseRollBias`, plus a smaller yaw
 *   toward the source. A roll is the anatomical listening gesture; yaw alone only turns away.
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
  outwardAmplitude: 0,

  waveAmplitude: 0.14,
  waveScale: 2.8,
  waveSpeed: 0.55,

  jitterAmplitude: 0.05,
  jitterSpeed: 3.2,
  facialSpeed: 0.72,

  brightnessBias: 0,
  shimmerAmplitude: 0.55,
  shimmerScale: 3.4,
  shimmerSpeed: 0.9,
  shimmerHarmonic: 0,
  // Same diagonal as idle. Listening's *pattern* differs from idle by speed and amplitude,
  // not by the axis it travels along.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,
  shimmerRadial: 0,
  shimmerMirror: 0,

  swayYaw: 0.03,
  swayPitch: 0.02,
  swaySpeed: 0.45,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // A genuine shoulderward cock with a smaller source-facing turn keeps both eyes readable.
  poseYawBias: -0.06,
  posePitchBias: 0.025,
  poseRollBias: -0.12,
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
  outwardAmplitude: 0,

  waveAmplitude: 0.12,
  waveScale: 3.0,
  waveSpeed: 0.45,

  jitterAmplitude: 0.04,
  jitterSpeed: 2.6,
  facialSpeed: 1.45,

  brightnessBias: 0,
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
  shimmerRadial: 0,
  shimmerMirror: 0,

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
  posePitchBias: 0.19,
  poseRollBias: 0,
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
  outwardAmplitude: 0,

  waveAmplitude: 0.5,
  waveScale: 1.6,
  waveSpeed: 0.24,

  jitterAmplitude: 0.09,
  jitterSpeed: 1.2,
  facialSpeed: 0.38,

  brightnessBias: 0,
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
  shimmerRadial: 0,
  shimmerMirror: 0,

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
  poseRollBias: 0,
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
  outwardAmplitude: 0,

  waveAmplitude: 0.16,
  waveScale: 3.6,
  waveSpeed: 0.72,

  jitterAmplitude: 0.08,
  jitterSpeed: 4.1,
  facialSpeed: 2.1,

  brightnessBias: 0,
  shimmerAmplitude: 0.62,
  shimmerScale: 5.2,
  shimmerSpeed: 1.65,
  shimmerHarmonic: 0,
  // Mostly horizontal, with a small depth component so the band wraps across the turned head
  // rather than looking pasted onto the screen.
  shimmerDirX: 1,
  shimmerDirY: 0.08,
  shimmerDirZ: 0.24,
  shimmerRadial: 0,
  shimmerMirror: 0,

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
  poseRollBias: 0,
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
 * Fine, fast positional texture gives the surface a controlled machine-like vibration at display
 * sizes. Its amplitude stays well below one cell so the voxel surface never tears apart.
 */
export const EXECUTING_MOTION: MotionParams = {
  // Near-still chassis: the action is deliberate, not breathing or wandering.
  breathAmplitude: 0.06,
  breathSpeed: 1.05,
  outwardAmplitude: 0,

  waveAmplitude: 0.2,
  waveScale: 4.8,
  waveSpeed: 1.1,

  jitterAmplitude: 0.1,
  jitterSpeed: 5.2,
  facialSpeed: 1.25,

  brightnessBias: 0,
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
  shimmerRadial: 0,
  shimmerMirror: 0,

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
  poseRollBias: 0,
};

/**
 * `generating` — producing output. Energy travels from the centre of the face into the world.
 *
 * A normal pulse moves every cell from rest to outward and back, never through the imploding half
 * of a centred breath. Low-frequency surface waves ride on it so the output feels emitted by a
 * living volume rather than scaled uniformly.
 *
 * At inline sizes, where that positional motion is sub-pixel, concentric brightness rings carry
 * the same idea. A negative shimmer speed makes equal-phase rings move toward larger radii over
 * time: visibly outward, not merely "busy". Both carriers are analytic, bounded, and phase-safe.
 */
export const GENERATING_MOTION: MotionParams = {
  breathAmplitude: 0.12,
  breathSpeed: 0.82,
  // Rest → outward → rest. Combined with the centred breath, peak uniform travel is 0.60 cells.
  outwardAmplitude: 0.48,

  waveAmplitude: 0.38,
  waveScale: 2.5,
  waveSpeed: 0.9,

  jitterAmplitude: 0.1,
  jitterSpeed: 3.8,
  facialSpeed: 1.7,

  brightnessBias: 0,
  shimmerAmplitude: 0.68,
  shimmerScale: 5.8,
  // Negative because phase = radius * scale + time * speed; this sends a phase front outward.
  shimmerSpeed: -1.55,
  shimmerHarmonic: 0,
  // Direction remains valid for interpolation even though the fully radial state does not use it.
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,
  shimmerRadial: 1,
  shimmerMirror: 0,

  swayYaw: 0.055,
  swayPitch: 0.03,
  swaySpeed: 0.48,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Lifted but centred: energy projects outward rather than tracking a source to either side.
  poseYawBias: 0,
  posePitchBias: -0.06,
  poseRollBias: 0,
};

/**
 * `reviewing` — self-checking a result. A deliberate nod accompanies paired inspection bands
 * that close from both sides of the face toward its centreline.
 *
 * Mirroring the horizontal shimmer coordinate produces the paired bands analytically: equal
 * phase lives at `+x` and `-x`, and positive time moves both fronts inward. This remains
 * phase-safe at arbitrary entry times and reads as narrowed focus even when the nod is sub-pixel.
 *
 * The periodic pose is pitch-dominant rather than a search-like yaw scan. Surface displacement is
 * subdued so the result feels like examination, not continued generation.
 */
export const REVIEWING_MOTION: MotionParams = {
  breathAmplitude: 0.1,
  breathSpeed: 0.68,
  outwardAmplitude: 0,

  waveAmplitude: 0.14,
  waveScale: 3.2,
  waveSpeed: 0.52,

  jitterAmplitude: 0.045,
  jitterSpeed: 2.9,
  facialSpeed: 0.92,

  brightnessBias: 0,
  shimmerAmplitude: 0.58,
  shimmerScale: 5.4,
  shimmerSpeed: 1.15,
  shimmerHarmonic: 0,
  // Absolute x creates matched bands at both sides; positive speed carries them inward.
  shimmerDirX: 1,
  shimmerDirY: 0,
  shimmerDirZ: 0,
  shimmerRadial: 0,
  shimmerMirror: 1,

  // Pitch dominates by design: a restrained repeated nod, not a lateral scan.
  swayYaw: 0.012,
  swayPitch: 0.075,
  swaySpeed: 0.72,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // A slight held turn keeps the reduced-motion silhouette distinct while the chin stays level.
  poseYawBias: -0.03,
  posePitchBias: 0,
  poseRollBias: 0,
};

/**
 * `error` — failed or blocked. A quick lateral recoil says "no" while sharpened warning rings
 * contract into the face.
 *
 * The motion has to carry the state without its alarm colour. Its secondary yaw is both faster
 * and wider than searching's saccades, so it reads as a fault shake rather than visual tracking.
 * The radial shimmer reverses generating's direction: positive phase speed pulls equal-phase
 * rings toward the centre, while a stronger third harmonic gives each band an urgent edge without
 * introducing discontinuities.
 */
export const ERROR_MOTION: MotionParams = {
  breathAmplitude: 0.08,
  breathSpeed: 1.15,
  outwardAmplitude: 0,

  waveAmplitude: 0.18,
  waveScale: 4.6,
  waveSpeed: 1.25,

  jitterAmplitude: 0.14,
  jitterSpeed: 6.4,
  facialSpeed: 2.35,

  brightnessBias: 0,
  shimmerAmplitude: 0.76,
  shimmerScale: 6.8,
  // Positive speed contracts radial phase fronts; generating uses negative speed to emit them.
  shimmerSpeed: 2.04,
  shimmerHarmonic: 0.5,
  shimmerDirX: 0.7,
  shimmerDirY: 1,
  shimmerDirZ: -0.4,
  shimmerRadial: 1,
  shimmerMirror: 0,

  // A restrained chassis underneath a dominant fast side-to-side rejection.
  swayYaw: 0.018,
  swayPitch: 0.01,
  swaySpeed: 0.64,
  swayDartYaw: 0.085,
  swayDartSpeed: 4.4,

  // Recoiled to the opposite side from reviewing; level pitch keeps the shake axis unambiguous.
  poseYawBias: 0.055,
  posePitchBias: 0,
  poseRollBias: 0,
};

/**
 * `done` — complete. The head releases into a neutral, brighter resting endpoint.
 *
 * This vector defines the endpoint, not its lifetime. The later transition controller owns the
 * brief hold and smooth return to `idle`; encoding a timer here would make entry phase-dependent
 * and force a hard cut before the interpolation machinery exists.
 *
 * A positive brightness bias keeps every particle above its ordinary shaded level, while a broad
 * low-amplitude shimmer prevents a long-held completion state from freezing. Motion amplitudes
 * are the smallest in the active set, so the visual grammar is release rather than more work.
 */
export const DONE_MOTION: MotionParams = {
  breathAmplitude: 0.04,
  breathSpeed: 0.48,
  outwardAmplitude: 0,

  waveAmplitude: 0.07,
  waveScale: 1.7,
  waveSpeed: 0.31,

  jitterAmplitude: 0.018,
  jitterSpeed: 1.3,
  facialSpeed: 0.46,

  // Greater than the ripple amplitude, so completion never dips below ordinary brightness.
  brightnessBias: 0.22,
  shimmerAmplitude: 0.14,
  shimmerScale: 1.4,
  shimmerSpeed: 0.29,
  shimmerHarmonic: 0,
  // A broad rising wash, not a processing scan.
  shimmerDirX: 0.15,
  shimmerDirY: 1,
  shimmerDirZ: 0,
  shimmerRadial: 0,
  shimmerMirror: 0,

  swayYaw: 0.008,
  swayPitch: 0.006,
  swaySpeed: 0.19,
  swayDartYaw: 0,
  swayDartSpeed: 0,

  // Deliberately neutral: this endpoint is designed to blend directly back into idle.
  poseYawBias: 0,
  posePitchBias: 0,
  poseRollBias: 0,
};

/**
 * Motion per state. All ten universal states now have tuned continuous signatures.
 */
export const STATE_MOTION: Record<ThinkingHeadState, MotionParams> = {
  idle: IDLE_MOTION,
  listening: LISTENING_MOTION,
  reading: READING_MOTION,
  thinking: THINKING_MOTION,
  searching: SEARCHING_MOTION,
  executing: EXECUTING_MOTION,
  generating: GENERATING_MOTION,
  reviewing: REVIEWING_MOTION,
  error: ERROR_MOTION,
  done: DONE_MOTION,
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
  phase?: MotionPhase,
): number {
  const breathPhase = phase?.breath ?? time * m.breathSpeed;
  const wavePhase = phase?.wave ?? time * m.waveSpeed;
  const jitterPhase = phase?.jitter ?? time * m.jitterSpeed;

  // Breath: uniform across the surface, so the whole head swells rather than rippling.
  const breath = Math.sin(breathPhase);
  const outward = 0.5 + breath * 0.5;

  // Travelling swell. Two waves along different axes at incommensurate rates; their sum never
  // repeats, and both are low spatial frequency so neighbours stay coherent.
  const waveA = Math.sin((px + py * 0.6) * m.waveScale + wavePhase);
  const waveB = Math.sin((pz * PHI - py) * m.waveScale * 0.83 + wavePhase * SQRT2);

  // Shimmer: high spatial frequency, so adjacent cells differ. Deliberately tiny.
  const jitter = Math.sin((px * 31.7 + py * 47.3 + pz * 23.1) * 2 + jitterPhase);

  return (
    m.breathAmplitude * breath +
    m.outwardAmplitude * outward +
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
  motionPhase?: MotionPhase,
): number {
  const directional = px * m.shimmerDirX + py * m.shimmerDirY + pz * m.shimmerDirZ;
  const radial = Math.hypot(px, py);
  const radialMix = Math.max(0, Math.min(1, m.shimmerRadial));
  const radialAlong = directional + (radial - directional) * radialMix;
  const mirrorMix = Math.max(0, Math.min(1, m.shimmerMirror));
  const along = radialAlong + (Math.abs(radialAlong) - radialAlong) * mirrorMix;
  const phase = along * m.shimmerScale + (motionPhase?.shimmer ?? time * m.shimmerSpeed);
  // Normalised by the sum of amplitudes so adding the harmonic never expands the caller's
  // configured brightness range beyond ±shimmerAmplitude.
  const band =
    (Math.sin(phase) + m.shimmerHarmonic * Math.sin(phase * 3)) / (1 + Math.abs(m.shimmerHarmonic));
  return 1 + m.brightnessBias + m.shimmerAmplitude * band;
}

/**
 * Camera offsets for a moment in time: persistent pose bias plus the periodic sway.
 *
 * Applied to the camera, not to each particle — one basis-of-two-trig-calls per frame instead
 * of the same work repeated across thousands of particles, and it actually looks like a head
 * turning. Both backends read this on the CPU, so a per-state tilt propagates for free.
 */
export interface SwayOffsets {
  yaw: number;
  pitch: number;
  roll: number;
}

export function swayOffsetsInto(
  out: SwayOffsets,
  time: number,
  m: MotionParams,
  phase?: MotionPhase,
): SwayOffsets {
  const swayPhase = phase?.sway ?? time * m.swaySpeed;
  const dartPhase = phase?.dart ?? time * m.swayDartSpeed;
  out.yaw =
    m.poseYawBias + m.swayYaw * Math.sin(swayPhase) + m.swayDartYaw * Math.sin(dartPhase + 0.37);
  // Incommensurate with yaw, so the head traces a slow open path instead of a closed loop.
  out.pitch = m.posePitchBias + m.swayPitch * Math.sin(swayPhase * PHI + 1.1);
  out.roll = m.poseRollBias;
  return out;
}

export function swayOffsets(time: number, m: MotionParams, phase?: MotionPhase): SwayOffsets {
  return swayOffsetsInto({ yaw: 0, pitch: 0, roll: 0 }, time, m, phase);
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
