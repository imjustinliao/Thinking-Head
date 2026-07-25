import { afterEach, describe, expect, test, vi } from "vitest";
import { clockState, resetClock, subscribeToClock } from "./clock.js";
import {
  IDLE_MOTION,
  normalDisplacement,
  STATE_MOTION,
  STILL_MOTION,
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
