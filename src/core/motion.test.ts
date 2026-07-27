import { afterEach, describe, expect, test, vi } from "vitest";
import { clockState, resetClock, subscribeToClock } from "./clock.js";
import {
  DONE_MOTION,
  ERROR_MOTION,
  EXECUTING_MOTION,
  GENERATING_MOTION,
  IDLE_MOTION,
  LISTENING_MOTION,
  normalDisplacement,
  READING_MOTION,
  REVIEWING_MOTION,
  SEARCHING_MOTION,
  STATE_MOTION,
  STILL_MOTION,
  shimmerMultiplier,
  swayOffsets,
  THINKING_MOTION,
} from "./motion.js";
import { THINKING_HEAD_STATES } from "./states.js";

describe("continuous motion", () => {
  test("never comes to rest — a long-running state must stay alive", () => {
    // Sampled across half a minute, the surface must keep moving. A frozen pose is the exact
    // failure the spec calls out for a 30-second wait.
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, IDLE_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, IDLE_MOTION);
      if (Math.abs(value - previous) > 1e-4) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);
  });

  test("has no perceptible loop point over a long run", () => {
    // Built from sinusoids at irrational ratios, so the combined period is effectively infinite.
    // If any candidate period repeated, a 30-second wait would visibly stutter.
    const at = (t: number) => normalDisplacement(0.3, -0.2, 0.5, t, IDLE_MOTION);
    const base = at(0);
    for (const period of [1, 2, 2.5, 5, 10, 12, 15, 20, 30]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });

  test("is phase-safe: entering at any moment is continuous", () => {
    // No keyframe timeline means no wrong moment to start. Neighbouring instants must differ
    // only slightly, so a state entered at random never jumps.
    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = normalDisplacement(0.1, 0.2, 0.3, t, IDLE_MOTION);
      const b = normalDisplacement(0.1, 0.2, 0.3, t + 1 / 60, IDLE_MOTION);
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }
  });

  test("neighbouring particles move together, so the motion reads as a body", () => {
    // Spatial coherence is what separates a purposeful swarm from television static. Two
    // particles a hair apart must be at nearly the same phase.
    const t = 4.2;
    const a = normalDisplacement(0.2, 0.1, 0.4, t, IDLE_MOTION);
    const near = normalDisplacement(0.205, 0.1, 0.4, t, IDLE_MOTION);
    const far = normalDisplacement(-0.4, -0.3, -0.2, t, IDLE_MOTION);
    expect(Math.abs(near - a)).toBeLessThan(Math.abs(far - a));
  });

  test("displacement stays bounded, so the head never tears apart", () => {
    let peak = 0;
    for (let t = 0; t < 60; t += 0.05) {
      peak = Math.max(peak, Math.abs(normalDisplacement(0.3, 0.2, 0.5, t, IDLE_MOTION)));
    }
    // In cell units — roughly a cell of travel, not more.
    expect(peak).toBeLessThan(1.5);
  });

  test("still motion is genuinely still", () => {
    for (const t of [0, 1, 17.5]) {
      expect(normalDisplacement(0.2, 0.1, 0.4, t, STILL_MOTION)).toBe(0);
      expect(swayOffsets(t, STILL_MOTION)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    }
  });

  test("sway yaw and pitch never realign into a closed loop", () => {
    const a = swayOffsets(0, IDLE_MOTION);
    const b = swayOffsets(20, IDLE_MOTION);
    expect(Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch)).toBeGreaterThan(1e-3);
  });

  test("every state has motion, so none renders frozen", () => {
    for (const state of THINKING_HEAD_STATES) {
      const m = STATE_MOTION[state];
      expect(m, `${state} has no motion`).toBeDefined();
      expect(m.breathAmplitude + m.waveAmplitude + m.jitterAmplitude).toBeGreaterThan(0);
    }
  });
});

describe("brightness shimmer", () => {
  // Regression guard for a real bug: positional amplitudes are in particle-spacing units, and the
  // LOD system holds a cell to a near-constant on-screen size (~1.6px). That makes even a
  // generous positional amplitude a sub-pixel wobble at small and mid sizes — invisible in
  // practice, which is exactly what a first render of `idle` showed. Brightness has no such
  // floor, which is why every state's motion must carry a non-zero shimmer term.
  test("every state has a non-zero shimmer amplitude", () => {
    for (const state of THINKING_HEAD_STATES) {
      expect(STATE_MOTION[state].shimmerAmplitude, `${state} has no shimmer`).toBeGreaterThan(0);
    }
  });

  test("swings brightness both above and below neutral over time", () => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 20; t += 0.2) {
      const v = shimmerMultiplier(0.2, 0.1, 0.4, t, IDLE_MOTION);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeLessThan(1);
    expect(max).toBeGreaterThan(1);
  });

  test("is centred on 1 so it never resets the region albedo baseline", () => {
    let sum = 0;
    let n = 0;
    for (let t = 0; t < 40; t += 0.5) {
      sum += shimmerMultiplier(0.1, -0.2, 0.3, t, IDLE_MOTION);
      n++;
    }
    expect(sum / n).toBeCloseTo(1, 1);
  });

  test("still motion has no shimmer", () => {
    for (const t of [0, 5, 12.3]) {
      expect(shimmerMultiplier(0.2, 0.1, 0.4, t, STILL_MOTION)).toBe(1);
    }
  });

  test("has no perceptible loop point, independent of the positional wave's period", () => {
    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, IDLE_MOTION);
    const base = at(0);
    for (const period of [1, 2, 2.5, 5, 10, 15, 20, 30]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("listening state", () => {
  test("holds a true shoulderward head tilt — the primary visual cue for listening", () => {
    // The tilt must survive across the whole oscillation, not merely at one instant. Testing
    // over a spread of times catches a bias that gets cancelled by sway on a lucky sample.
    let minRoll = Number.POSITIVE_INFINITY;
    let maxRoll = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 30; t += 0.35) {
      const { roll } = swayOffsets(t, LISTENING_MOTION);
      minRoll = Math.min(minRoll, roll);
      maxRoll = Math.max(maxRoll, roll);
    }
    // Roll, not yaw, is the anatomical ear-to-shoulder listening gesture.
    expect(maxRoll).toBeLessThan(0);
    expect(Math.abs((minRoll + maxRoll) / 2)).toBeGreaterThan(0.1);
  });

  test("reads as attentive rather than relaxed — reduced breath and jitter versus idle", () => {
    // The verbal cue in the spec is "alert/focused". Structurally that means the wandering,
    // ambient motion of idle is dialled back so the head reads as *paying attention* rather
    // than drifting.
    expect(LISTENING_MOTION.breathAmplitude).toBeLessThan(IDLE_MOTION.breathAmplitude);
    expect(LISTENING_MOTION.jitterAmplitude).toBeLessThan(IDLE_MOTION.jitterAmplitude);
    expect(LISTENING_MOTION.waveAmplitude).toBeLessThan(IDLE_MOTION.waveAmplitude);
  });

  test("carries a faster, brighter shimmer — attentive scanning across the surface", () => {
    // Amplitude and speed both up: the shimmer sweeps quicker and reads louder, which is the
    // frequency-domain equivalent of leaning in.
    expect(LISTENING_MOTION.shimmerAmplitude).toBeGreaterThan(IDLE_MOTION.shimmerAmplitude);
    expect(LISTENING_MOTION.shimmerSpeed).toBeGreaterThan(IDLE_MOTION.shimmerSpeed);
  });

  test("STATE_MOTION.listening points at LISTENING_MOTION, not the idle placeholder", () => {
    // Regression guard: it's easy to forget the STATE_MOTION lookup when adding a new state.
    expect(STATE_MOTION.listening).toBe(LISTENING_MOTION);
    expect(STATE_MOTION.listening).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    // The state's own motion signature must not accidentally regress the invariants every state
    // has to satisfy, so re-check the two most load-bearing ones directly on LISTENING_MOTION.
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, LISTENING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, LISTENING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, LISTENING_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("reading state", () => {
  test("gaze drops — persistent positive pitch bias, never crosses back above centre", () => {
    // The characteristic reading cue is the chin tucking toward the material. Sampling across a
    // long window makes sure the *bias* is doing the work rather than a lucky phase of sway.
    let minPitch = Number.POSITIVE_INFINITY;
    let maxPitch = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 30; t += 0.35) {
      const { pitch } = swayOffsets(t, READING_MOTION);
      minPitch = Math.min(minPitch, pitch);
      maxPitch = Math.max(maxPitch, pitch);
    }
    expect(minPitch).toBeGreaterThan(0);
    expect((minPitch + maxPitch) / 2).toBeGreaterThan(0.08);
  });

  test("head sits straight ahead, no lateral tilt — reading is not listening", () => {
    // Distinct from listening (which has a strong yaw bias). The tilt-vs-drop distinction is
    // what tells the two apart from a single glance at the pose.
    let minYaw = Number.POSITIVE_INFINITY;
    let maxYaw = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 30; t += 0.35) {
      const { yaw } = swayOffsets(t, READING_MOTION);
      minYaw = Math.min(minYaw, yaw);
      maxYaw = Math.max(maxYaw, yaw);
    }
    // Sway crosses zero rather than sitting off to one side.
    expect(minYaw).toBeLessThan(0);
    expect(maxYaw).toBeGreaterThan(0);
  });

  test("shimmer sweeps horizontally — the visual cue that matches an eye tracking a line", () => {
    // The direction vector is what makes this state unmistakable. Isolated to x means moving
    // left-to-right on the head, which is the eye path across a line of text.
    expect(READING_MOTION.shimmerDirX).toBe(1);
    expect(READING_MOTION.shimmerDirY).toBe(0);
    expect(READING_MOTION.shimmerDirZ).toBe(0);

    // Cells differing only in x must produce different shimmer values at the same moment —
    // that is what proves the wave really travels along x rather than being uniform.
    const t = 3.4;
    const left = shimmerMultiplier(-0.3, 0.1, 0.4, t, READING_MOTION);
    const right = shimmerMultiplier(0.3, 0.1, 0.4, t, READING_MOTION);
    expect(Math.abs(left - right)).toBeGreaterThan(0.01);

    // Cells differing only in y should be identical at a moment — the wave carries no vertical
    // component. Non-zero difference here would mean a diagonal sweep leaking in.
    const top = shimmerMultiplier(0.2, 0.3, 0.4, t, READING_MOTION);
    const bottom = shimmerMultiplier(0.2, -0.3, 0.4, t, READING_MOTION);
    expect(Math.abs(top - bottom)).toBeLessThan(1e-6);
  });

  test("lateral sway dominates over pitch sway — quick side-to-side line following", () => {
    // Distinct from idle's ambient drift and from listening's small nod. Reading's periodic
    // component is horizontal because that is what your head does chasing a line of text.
    expect(READING_MOTION.swayYaw).toBeGreaterThan(READING_MOTION.swayPitch);
  });

  test("STATE_MOTION.reading points at READING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.reading).toBe(READING_MOTION);
    expect(STATE_MOTION.reading).not.toBe(IDLE_MOTION);
    expect(STATE_MOTION.reading).not.toBe(LISTENING_MOTION);
  });

  test("still meets the general motion contract — never rests, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, READING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, READING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, READING_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("thinking state", () => {
  test("gaze lifts — persistent negative pitch, never dips below centre", () => {
    // Chin up and away from the viewer: the universal "working it out" posture.
    let minPitch = Number.POSITIVE_INFINITY;
    let maxPitch = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 30; t += 0.35) {
      const { pitch } = swayOffsets(t, THINKING_MOTION);
      minPitch = Math.min(minPitch, pitch);
      maxPitch = Math.max(maxPitch, pitch);
    }
    expect(maxPitch).toBeLessThan(0);
    expect((minPitch + maxPitch) / 2).toBeLessThan(-0.08);
  });

  test("pose is the inverse of reading — the two are distinguishable from posture alone", () => {
    // This relationship is the point: reading drops the chin, thinking lifts it. If both ever
    // drifted to the same sign the states would be indistinguishable when paused.
    expect(READING_MOTION.posePitchBias).toBeGreaterThan(0);
    expect(THINKING_MOTION.posePitchBias).toBeLessThan(0);
  });

  test("is the slowest, broadest shimmer in the set — a lazy swell, not a scan", () => {
    // Contrast with reading, which narrows the band and speeds it up to mimic an eye tracking
    // a line. Thinking does the opposite on both axes.
    expect(THINKING_MOTION.shimmerScale).toBeLessThan(READING_MOTION.shimmerScale);
    expect(THINKING_MOTION.shimmerSpeed).toBeLessThan(READING_MOTION.shimmerSpeed);
    expect(THINKING_MOTION.shimmerSpeed).toBeLessThan(IDLE_MOTION.shimmerSpeed);
    expect(THINKING_MOTION.shimmerSpeed).toBeLessThan(LISTENING_MOTION.shimmerSpeed);
  });

  test("breathes deeper and slower than idle — absorbed, not merely waiting", () => {
    // The only state whose breath exceeds idle's. Listening and reading both suppress it for
    // attentive stillness; thinking is the opposite kind of inattention.
    expect(THINKING_MOTION.breathAmplitude).toBeGreaterThan(IDLE_MOTION.breathAmplitude);
    expect(THINKING_MOTION.breathSpeed).toBeLessThan(IDLE_MOTION.breathSpeed);
  });

  test("sway wanders widest and slowest — a drifting train of thought", () => {
    for (const other of [IDLE_MOTION, LISTENING_MOTION, READING_MOTION]) {
      expect(THINKING_MOTION.swayYaw).toBeGreaterThan(other.swayYaw);
      expect(THINKING_MOTION.swaySpeed).toBeLessThan(other.swaySpeed);
    }
  });

  test("STATE_MOTION.thinking points at THINKING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.thinking).toBe(THINKING_MOTION);
    expect(STATE_MOTION.thinking).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, THINKING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, THINKING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, THINKING_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("searching state", () => {
  test("layers quick yaw corrections over a slower wide scan", () => {
    expect(SEARCHING_MOTION.swayDartYaw).toBeGreaterThan(0);
    expect(SEARCHING_MOTION.swayDartSpeed).toBeGreaterThan(SEARCHING_MOTION.swaySpeed * 4);
    expect(SEARCHING_MOTION.swayYaw).toBeGreaterThan(READING_MOTION.swayYaw);

    // Count direction changes in the sampled yaw path. The compound search must reverse more
    // often than the clean reading sweep over the same window — that is the saccadic cue.
    const reversals = (motion: typeof SEARCHING_MOTION): number => {
      let previous = swayOffsets(0, motion).yaw;
      let previousDirection = 0;
      let changes = 0;
      for (let t = 0.05; t <= 20; t += 0.05) {
        const yaw = swayOffsets(t, motion).yaw;
        const direction = Math.sign(yaw - previous);
        if (previousDirection !== 0 && direction !== 0 && direction !== previousDirection)
          changes++;
        if (direction !== 0) previousDirection = direction;
        previous = yaw;
      }
      return changes;
    };

    expect(reversals(SEARCHING_MOTION)).toBeGreaterThan(reversals(READING_MOTION) * 3);
  });

  test("keeps darting exclusive to searching so earlier state motion is unchanged", () => {
    for (const motion of [
      STILL_MOTION,
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
    ]) {
      expect(motion.swayDartYaw).toBe(0);
      expect(motion.swayDartSpeed).toBe(0);
    }
  });

  test("uses a tighter, faster, brighter scan than reading", () => {
    expect(SEARCHING_MOTION.shimmerAmplitude).toBeGreaterThan(READING_MOTION.shimmerAmplitude);
    expect(SEARCHING_MOTION.shimmerScale).toBeGreaterThan(READING_MOTION.shimmerScale);
    expect(SEARCHING_MOTION.shimmerSpeed).toBeGreaterThan(READING_MOTION.shimmerSpeed);
    expect(SEARCHING_MOTION.shimmerDirX).toBeGreaterThan(Math.abs(SEARCHING_MOTION.shimmerDirY));
  });

  test("STATE_MOTION.searching points at SEARCHING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.searching).toBe(SEARCHING_MOTION);
    expect(STATE_MOTION.searching).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, SEARCHING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, SEARCHING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    const at = (t: number) => swayOffsets(t, SEARCHING_MOTION).yaw;
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("executing state", () => {
  test("locks the head down — the least breath and camera wander in the tuned set", () => {
    const earlier = [
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
    ];
    for (const motion of earlier) {
      expect(EXECUTING_MOTION.breathAmplitude).toBeLessThan(motion.breathAmplitude);
      expect(EXECUTING_MOTION.swayYaw).toBeLessThan(motion.swayYaw);
      expect(EXECUTING_MOTION.swayPitch).toBeLessThan(motion.swayPitch);
    }
  });

  test("runs a strict vertical processing band, orthogonal to the reading scan", () => {
    expect(EXECUTING_MOTION.shimmerDirX).toBe(0);
    expect(EXECUTING_MOTION.shimmerDirY).toBe(1);
    expect(EXECUTING_MOTION.shimmerDirZ).toBe(0);

    const t = 2.7;
    const top = shimmerMultiplier(0.1, 0.3, 0.2, t, EXECUTING_MOTION);
    const bottom = shimmerMultiplier(0.1, -0.3, 0.2, t, EXECUTING_MOTION);
    expect(Math.abs(top - bottom)).toBeGreaterThan(0.01);

    const left = shimmerMultiplier(-0.3, 0.1, 0.2, t, EXECUTING_MOTION);
    const right = shimmerMultiplier(0.3, 0.1, 0.2, t, EXECUTING_MOTION);
    expect(Math.abs(left - right)).toBeLessThan(1e-6);
  });

  test("third harmonic sharpens the pulse without exceeding the configured brightness range", () => {
    expect(EXECUTING_MOTION.shimmerHarmonic).toBeGreaterThan(0);
    const smooth = { ...EXECUTING_MOTION, shimmerHarmonic: 0 };

    // Around the zero crossing, the harmonic version changes faster than a plain sinusoid. The
    // function stays continuous; only its character becomes crisper and more mechanical.
    const sharpDelta =
      shimmerMultiplier(0, 0, 0, 0.01, EXECUTING_MOTION) -
      shimmerMultiplier(0, 0, 0, -0.01, EXECUTING_MOTION);
    const smoothDelta =
      shimmerMultiplier(0, 0, 0, 0.01, smooth) - shimmerMultiplier(0, 0, 0, -0.01, smooth);
    expect(sharpDelta).toBeGreaterThan(smoothDelta * 1.4);

    for (let t = 0; t < 60; t += 0.05) {
      const value = shimmerMultiplier(0.2, -0.1, 0.3, t, EXECUTING_MOTION);
      expect(value).toBeGreaterThanOrEqual(1 - EXECUTING_MOTION.shimmerAmplitude);
      expect(value).toBeLessThanOrEqual(1 + EXECUTING_MOTION.shimmerAmplitude);
    }
  });

  test("keeps the harmonic opt-in so earlier tuned states retain their exact shimmer", () => {
    for (const motion of [
      STILL_MOTION,
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
    ]) {
      expect(motion.shimmerHarmonic).toBe(0);
    }
  });

  test("STATE_MOTION.executing points at EXECUTING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.executing).toBe(EXECUTING_MOTION);
    expect(STATE_MOTION.executing).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, EXECUTING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, EXECUTING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = shimmerMultiplier(0.1, 0.2, 0.3, t, EXECUTING_MOTION);
      const b = shimmerMultiplier(0.1, 0.2, 0.3, t + 1 / 60, EXECUTING_MOTION);
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, EXECUTING_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("generating state", () => {
  test("biases positional motion outward while keeping every cell bounded to the surface", () => {
    expect(GENERATING_MOTION.outwardAmplitude).toBeGreaterThan(0);

    let sum = 0;
    let samples = 0;
    let peak = 0;
    for (let t = 0; t < 60; t += 0.05) {
      for (const [x, y, z] of [
        [0.2, 0.1, 0.4],
        [-0.4, 0.3, 0.1],
        [0.1, -0.5, -0.2],
      ]) {
        const value = normalDisplacement(x, y, z, t, GENERATING_MOTION);
        sum += value;
        samples++;
        peak = Math.max(peak, Math.abs(value));
      }
    }

    // Positive mean is the difference between emitted energy and an ordinary centred wobble.
    expect(sum / samples).toBeGreaterThan(0.15);
    // Still stays within roughly one particle spacing, so the sampled surface never tears apart.
    expect(peak).toBeLessThan(1.5);
  });

  test("uses concentric shimmer rings rather than a directional scan", () => {
    expect(GENERATING_MOTION.shimmerRadial).toBe(1);

    // Equal radii at different angles must have equal brightness. The configured direction is
    // deliberately asymmetric, so this only holds when the radial coordinate is really active.
    const t = 1.8;
    const horizontal = shimmerMultiplier(0.4, 0, 0.2, t, GENERATING_MOTION);
    const vertical = shimmerMultiplier(0, 0.4, -0.3, t, GENERATING_MOTION);
    expect(horizontal).toBeCloseTo(vertical, 6);
  });

  test("sends equal-phase rings toward larger radii over time", () => {
    expect(GENERATING_MOTION.shimmerSpeed).toBeLessThan(0);

    const startRadius = 0.2;
    const elapsed = 0.4;
    const laterRadius =
      startRadius - (GENERATING_MOTION.shimmerSpeed / GENERATING_MOTION.shimmerScale) * elapsed;
    const start = shimmerMultiplier(startRadius, 0, 0, 0, GENERATING_MOTION);
    const later = shimmerMultiplier(laterRadius, 0, 0, elapsed, GENERATING_MOTION);

    expect(laterRadius).toBeGreaterThan(startRadius);
    expect(later).toBeCloseTo(start, 6);
  });

  test("keeps outward and radial controls opt-in so earlier states are unchanged", () => {
    for (const motion of [
      STILL_MOTION,
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
    ]) {
      expect(motion.outwardAmplitude).toBe(0);
      expect(motion.shimmerRadial).toBe(0);
    }
  });

  test("STATE_MOTION.generating points at GENERATING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.generating).toBe(GENERATING_MOTION);
    expect(STATE_MOTION.generating).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, GENERATING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, GENERATING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = normalDisplacement(0.1, 0.2, 0.3, t, GENERATING_MOTION);
      const b = normalDisplacement(0.1, 0.2, 0.3, t + 1 / 60, GENERATING_MOTION);
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, GENERATING_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("reviewing state", () => {
  test("makes the repeated whole-head gesture a nod rather than a lateral scan", () => {
    expect(REVIEWING_MOTION.swayPitch).toBeGreaterThan(REVIEWING_MOTION.swayYaw * 4);

    for (const motion of [
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
      GENERATING_MOTION,
    ]) {
      expect(REVIEWING_MOTION.swayPitch).toBeGreaterThan(motion.swayPitch);
    }
  });

  test("mirrors the verification bands across the facial centreline", () => {
    expect(REVIEWING_MOTION.shimmerMirror).toBe(1);
    expect(REVIEWING_MOTION.shimmerDirX).toBe(1);
    expect(REVIEWING_MOTION.shimmerDirY).toBe(0);
    expect(REVIEWING_MOTION.shimmerDirZ).toBe(0);

    const t = 1.6;
    const left = shimmerMultiplier(-0.4, 0.1, -0.2, t, REVIEWING_MOTION);
    const right = shimmerMultiplier(0.4, -0.3, 0.5, t, REVIEWING_MOTION);
    expect(left).toBeCloseTo(right, 6);
  });

  test("carries equal-phase bands inward toward the centre over time", () => {
    expect(REVIEWING_MOTION.shimmerSpeed).toBeGreaterThan(0);

    const startDistance = 0.45;
    const elapsed = 0.5;
    const laterDistance =
      startDistance - (REVIEWING_MOTION.shimmerSpeed / REVIEWING_MOTION.shimmerScale) * elapsed;
    const start = shimmerMultiplier(startDistance, 0, 0, 0, REVIEWING_MOTION);
    const later = shimmerMultiplier(laterDistance, 0, 0, elapsed, REVIEWING_MOTION);

    expect(laterDistance).toBeGreaterThan(0);
    expect(laterDistance).toBeLessThan(startDistance);
    expect(later).toBeCloseTo(start, 6);
  });

  test("keeps mirroring opt-in so every earlier state retains its exact shimmer", () => {
    for (const motion of [
      STILL_MOTION,
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
      GENERATING_MOTION,
    ]) {
      expect(motion.shimmerMirror).toBe(0);
    }
  });

  test("STATE_MOTION.reviewing points at REVIEWING_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.reviewing).toBe(REVIEWING_MOTION);
    expect(STATE_MOTION.reviewing).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, REVIEWING_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, REVIEWING_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = shimmerMultiplier(0.1, 0.2, 0.3, t, REVIEWING_MOTION);
      const b = shimmerMultiplier(0.1, 0.2, 0.3, t + 1 / 60, REVIEWING_MOTION);
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }

    const at = (t: number) => swayOffsets(t, REVIEWING_MOTION).pitch;
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("error state", () => {
  const yawReversals = (motion: typeof ERROR_MOTION): number => {
    let previous = swayOffsets(0, motion).yaw;
    let previousDirection = 0;
    let changes = 0;
    for (let t = 0.05; t <= 20; t += 0.05) {
      const yaw = swayOffsets(t, motion).yaw;
      const direction = Math.sign(yaw - previous);
      if (previousDirection !== 0 && direction !== 0 && direction !== previousDirection) changes++;
      if (direction !== 0) previousDirection = direction;
      previous = yaw;
    }
    return changes;
  };

  test("uses the fastest, widest lateral fault shake rather than a searching scan", () => {
    expect(ERROR_MOTION.swayDartYaw).toBeGreaterThan(SEARCHING_MOTION.swayDartYaw);
    expect(ERROR_MOTION.swayDartSpeed).toBeGreaterThan(SEARCHING_MOTION.swayDartSpeed);
    expect(yawReversals(ERROR_MOTION)).toBeGreaterThan(yawReversals(SEARCHING_MOTION) * 1.5);
  });

  test("uses concentric warning rings so motion—not colour alone—carries the fault", () => {
    expect(ERROR_MOTION.shimmerRadial).toBe(1);

    const t = 1.3;
    const horizontal = shimmerMultiplier(0.4, 0, 0.2, t, ERROR_MOTION);
    const vertical = shimmerMultiplier(0, -0.4, -0.3, t, ERROR_MOTION);
    expect(horizontal).toBeCloseTo(vertical, 6);
  });

  test("contracts equal-phase warning rings inward, opposite to generating", () => {
    expect(ERROR_MOTION.shimmerSpeed).toBeGreaterThan(0);
    expect(GENERATING_MOTION.shimmerSpeed).toBeLessThan(0);

    const startRadius = 0.45;
    const elapsed = 0.5;
    const laterRadius =
      startRadius - (ERROR_MOTION.shimmerSpeed / ERROR_MOTION.shimmerScale) * elapsed;
    const start = shimmerMultiplier(startRadius, 0, 0, 0, ERROR_MOTION);
    const later = shimmerMultiplier(laterRadius, 0, 0, elapsed, ERROR_MOTION);

    expect(laterRadius).toBeGreaterThan(0);
    expect(laterRadius).toBeLessThan(startRadius);
    expect(later).toBeCloseTo(start, 6);
  });

  test("has the strongest, sharpest brightness pulse in the tuned set", () => {
    const earlier = [
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
      GENERATING_MOTION,
      REVIEWING_MOTION,
    ];
    for (const motion of earlier) {
      expect(ERROR_MOTION.shimmerAmplitude).toBeGreaterThan(motion.shimmerAmplitude);
    }
    expect(ERROR_MOTION.shimmerHarmonic).toBeGreaterThan(EXECUTING_MOTION.shimmerHarmonic);
  });

  test("STATE_MOTION.error points at ERROR_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.error).toBe(ERROR_MOTION);
    expect(STATE_MOTION.error).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, ERROR_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, ERROR_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = swayOffsets(t, ERROR_MOTION).yaw;
      const b = swayOffsets(t + 1 / 60, ERROR_MOTION).yaw;
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, ERROR_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("done state", () => {
  test("settles into the smallest movement envelope in the active state set", () => {
    const earlier = [
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
      GENERATING_MOTION,
      REVIEWING_MOTION,
      ERROR_MOTION,
    ];
    for (const motion of earlier) {
      expect(DONE_MOTION.breathAmplitude).toBeLessThan(motion.breathAmplitude);
      expect(DONE_MOTION.swayYaw).toBeLessThan(motion.swayYaw);
      expect(DONE_MOTION.swayPitch).toBeLessThan(motion.swayPitch);
    }
  });

  test("stays brighter than the ordinary shaded level throughout its soft glow", () => {
    expect(DONE_MOTION.brightnessBias).toBeGreaterThan(DONE_MOTION.shimmerAmplitude);

    for (let t = 0; t < 60; t += 0.05) {
      const value = shimmerMultiplier(0.2, -0.1, 0.3, t, DONE_MOTION);
      expect(value).toBeGreaterThan(1);
      expect(value).toBeLessThanOrEqual(
        1 + DONE_MOTION.brightnessBias + DONE_MOTION.shimmerAmplitude,
      );
    }
  });

  test("keeps the brightness lift opt-in so every earlier state is unchanged", () => {
    for (const motion of [
      STILL_MOTION,
      IDLE_MOTION,
      LISTENING_MOTION,
      READING_MOTION,
      THINKING_MOTION,
      SEARCHING_MOTION,
      EXECUTING_MOTION,
      GENERATING_MOTION,
      REVIEWING_MOTION,
      ERROR_MOTION,
    ]) {
      expect(motion.brightnessBias).toBe(0);
    }
  });

  test("uses idle's neutral pose because it is the endpoint for the return transition", () => {
    expect(DONE_MOTION.poseYawBias).toBe(IDLE_MOTION.poseYawBias);
    expect(DONE_MOTION.posePitchBias).toBe(IDLE_MOTION.posePitchBias);
    expect(DONE_MOTION).not.toEqual(IDLE_MOTION);
  });

  test("STATE_MOTION.done points at DONE_MOTION, not the idle placeholder", () => {
    expect(STATE_MOTION.done).toBe(DONE_MOTION);
    expect(STATE_MOTION.done).not.toBe(IDLE_MOTION);
  });

  test("still meets the general motion contract — never rests, phase-safe, no visible loop", () => {
    let previous = normalDisplacement(0.2, 0.1, 0.4, 0, DONE_MOTION);
    let moved = 0;
    for (let t = 0.25; t <= 30; t += 0.25) {
      const value = normalDisplacement(0.2, 0.1, 0.4, t, DONE_MOTION);
      if (Math.abs(value - previous) > 1e-5) moved++;
      previous = value;
    }
    expect(moved).toBeGreaterThan(100);

    for (const t of [0, 0.7, 3.3, 11.9, 47.2]) {
      const a = shimmerMultiplier(0.1, 0.2, 0.3, t, DONE_MOTION);
      const b = shimmerMultiplier(0.1, 0.2, 0.3, t + 1 / 60, DONE_MOTION);
      expect(Math.abs(b - a)).toBeLessThan(0.2);
    }

    const at = (t: number) => shimmerMultiplier(0.3, -0.2, 0.5, t, DONE_MOTION);
    const base = at(0);
    for (const period of [1, 2, 5, 10, 20]) {
      expect(Math.abs(at(period) - base)).toBeGreaterThan(1e-3);
    }
  });
});

describe("tuned states are mutually distinguishable", () => {
  // Guards the whole point of the state system: a user glancing at two indicators must be able
  // to tell them apart. Each new state milestone should extend this list.
  const TUNED = {
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
  } as const;

  test("no two tuned states share an identical parameter vector", () => {
    const entries = Object.entries(TUNED);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, a] = entries[i];
        const [nameB, b] = entries[j];
        expect(JSON.stringify(a), `${nameA} and ${nameB} are identical`).not.toBe(
          JSON.stringify(b),
        );
      }
    }
  });

  test("each active state occupies a distinct resting pose", () => {
    // Pose is the cue that survives a still screenshot, so it has to differ even when the
    // animated parameters happen to be close. Done is excluded deliberately: its neutral pose
    // is the endpoint for the transition back to idle.
    const poses = Object.entries(TUNED)
      .filter(([name]) => name !== "done")
      .map(([name, m]) => ({
        name,
        key: `${Math.sign(m.poseYawBias)}:${Math.sign(m.posePitchBias)}`,
      }));
    const keys = new Set(poses.map((p) => p.key));
    expect(keys.size, `poses collide: ${JSON.stringify(poses)}`).toBe(poses.length);
  });
});

describe("shimmer direction backwards compatibility", () => {
  test("idle and listening preserve the legacy diagonal, so their look is unchanged", () => {
    // Regression guard for raising shimmer direction to a parameter. Both states were tuned
    // against the baked (0.7, 1, -0.4) diagonal; if this changes, they don't look right.
    for (const m of [IDLE_MOTION, LISTENING_MOTION]) {
      expect(m.shimmerDirX).toBeCloseTo(0.7, 5);
      expect(m.shimmerDirY).toBeCloseTo(1, 5);
      expect(m.shimmerDirZ).toBeCloseTo(-0.4, 5);
    }
  });
});

describe("shared animation clock", () => {
  afterEach(() => {
    resetClock();
    vi.restoreAllMocks();
  });

  test("every listener receives the same time, so instances stay in phase", async () => {
    const seen: number[] = [];
    const stopA = subscribeToClock((t) => seen.push(t));
    const stopB = subscribeToClock((t) => seen.push(t));
    await new Promise((r) => setTimeout(r, 60));
    stopA();
    stopB();
    expect(seen.length).toBeGreaterThanOrEqual(2);
    // Listeners fire within one tick, so consecutive pairs must carry an identical timestamp.
    expect(seen[0]).toBe(seen[1]);
  });

  test("the loop stops once the last listener leaves", async () => {
    const stop = subscribeToClock(() => {});
    await new Promise((r) => setTimeout(r, 40));
    expect(clockState().listeners).toBe(1);
    stop();
    expect(clockState().listeners).toBe(0);
    expect(clockState().running).toBe(false);
  });

  test("subscribing twice runs one loop, not two", async () => {
    const a = subscribeToClock(() => {});
    const b = subscribeToClock(() => {});
    await new Promise((r) => setTimeout(r, 40));
    expect(clockState().listeners).toBe(2);
    a();
    // Still running for the remaining listener.
    expect(clockState().listeners).toBe(1);
    b();
    expect(clockState().running).toBe(false);
  });
});
