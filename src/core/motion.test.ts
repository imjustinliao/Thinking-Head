import { afterEach, describe, expect, test, vi } from "vitest";
import { clockState, resetClock, subscribeToClock } from "./clock.js";
import {
  IDLE_MOTION,
  LISTENING_MOTION,
  normalDisplacement,
  STATE_MOTION,
  STILL_MOTION,
  shimmerMultiplier,
  swayOffsets,
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
      expect(swayOffsets(t, STILL_MOTION)).toEqual({ yaw: 0, pitch: 0 });
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
  // Regression guard for a real bug: positional amplitudes are in lattice-cell units, and the
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
  test("holds a persistent head tilt — the primary visual cue for listening", () => {
    // The tilt must survive across the whole oscillation, not merely at one instant. Testing
    // over a spread of times catches a bias that gets cancelled by sway on a lucky sample.
    let minYaw = Number.POSITIVE_INFINITY;
    let maxYaw = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < 30; t += 0.35) {
      const { yaw } = swayOffsets(t, LISTENING_MOTION);
      minYaw = Math.min(minYaw, yaw);
      maxYaw = Math.max(maxYaw, yaw);
    }
    // Both extremes on the same side of centre: yaw never crosses zero.
    expect(maxYaw).toBeLessThan(0);
    // And the tilt is meaningfully large — ≥5° of persistent lean.
    expect(Math.abs((minYaw + maxYaw) / 2)).toBeGreaterThan(0.08);
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
