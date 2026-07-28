import { describe, expect, test } from "vitest";
import { EXPRESSION_KEYS, STATE_EXPRESSION } from "./expression.js";
import {
  createMotionPhase,
  MOTION_KEYS,
  normalDisplacement,
  STATE_MOTION,
  shimmerMultiplier,
  swayOffsets,
} from "./motion.js";
import { THINKING_HEAD_STATES } from "./states.js";
import {
  DONE_HOLD_SECONDS,
  STATE_TRANSITION_RESPONSE,
  StateTransitionController,
} from "./transition.js";

describe("state transition controller", () => {
  test("key registry covers every scalar in a motion preset", () => {
    expect([...MOTION_KEYS].sort()).toEqual(Object.keys(STATE_MOTION.idle).sort());
  });

  test("starts exactly on the requested endpoint and settles exactly on the next one", () => {
    const controller = new StateTransitionController("idle", 10);
    const sample = controller.sample;
    for (const key of MOTION_KEYS) expect(sample.motion[key]).toBe(STATE_MOTION.idle[key]);
    for (const key of EXPRESSION_KEYS) {
      expect(sample.expression[key]).toBe(STATE_EXPRESSION.idle[key]);
    }

    controller.setTargetState("thinking", 10);
    expect(controller.sample).toBe(sample);
    expect(sample.settled).toBe(false);
    controller.advance(12);
    expect(sample.settled).toBe(true);
    for (const key of MOTION_KEYS) expect(sample.motion[key]).toBe(STATE_MOTION.thinking[key]);
    for (const key of EXPRESSION_KEYS) {
      expect(sample.expression[key]).toBe(STATE_EXPRESSION.thinking[key]);
    }
  });

  test("reuses the sample, vector and phase objects across every frame", () => {
    const controller = new StateTransitionController("listening");
    const sample = controller.sample;
    const motion = sample.motion;
    const expression = sample.expression;
    const phase = sample.phase;
    controller.setTargetState("searching", 0);
    for (let frame = 1; frame <= 1000; frame++) {
      expect(controller.advance(frame / 60)).toBe(sample);
      expect(sample.motion).toBe(motion);
      expect(sample.expression).toBe(expression);
      expect(sample.phase).toBe(phase);
    }
  });

  test("retargeting at an arbitrary frame preserves presentation and phase", () => {
    const controller = new StateTransitionController("thinking");
    controller.setTargetState("searching", 0);
    const before = controller.advance(0.11);
    const motion = MOTION_KEYS.map((key) => before.motion[key]);
    const expression = EXPRESSION_KEYS.map((key) => before.expression[key]);
    const phase = { ...before.phase };

    const after = controller.setTargetState("error", 0.11);
    expect(MOTION_KEYS.map((key) => after.motion[key])).toEqual(motion);
    expect(EXPRESSION_KEYS.map((key) => after.expression[key])).toEqual(expression);
    expect(after.phase).toEqual(phase);
    expect(after.targetState).toBe("error");
  });

  test("every directed state pair remains finite through random-time interruption", () => {
    for (let fromIndex = 0; fromIndex < THINKING_HEAD_STATES.length; fromIndex++) {
      const from = THINKING_HEAD_STATES[fromIndex];
      for (let toIndex = 0; toIndex < THINKING_HEAD_STATES.length; toIndex++) {
        if (fromIndex === toIndex) continue;
        const to = THINKING_HEAD_STATES[toIndex];
        const startedAt = 30 + fromIndex * 1.37 + toIndex * 0.43;
        const controller = new StateTransitionController(from, startedAt);
        controller.setTargetState(to, startedAt);
        const interruptedAt = startedAt + 0.037 + ((fromIndex * 7 + toIndex * 11) % 19) / 100;
        controller.advance(interruptedAt);
        const third = THINKING_HEAD_STATES[(toIndex + 3) % THINKING_HEAD_STATES.length];
        const sample = controller.setTargetState(third, interruptedAt);
        controller.advance(interruptedAt + 0.017);
        for (const key of MOTION_KEYS) expect(Number.isFinite(sample.motion[key])).toBe(true);
        for (const key of EXPRESSION_KEYS) {
          expect(Number.isFinite(sample.expression[key])).toBe(true);
        }
        for (const value of Object.values(sample.phase)) expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  test("integrated phases are independent of frame partitioning", () => {
    const single = new StateTransitionController("generating", 600);
    const stepped = new StateTransitionController("generating", 600);
    single.setTargetState("error", 600);
    stepped.setTargetState("error", 600);

    single.advance(600.5);
    for (let frame = 1; frame <= 30; frame++) stepped.advance(600 + frame / 60);

    for (const key of MOTION_KEYS) {
      expect(stepped.sample.motion[key]).toBeCloseTo(single.sample.motion[key], 10);
    }
    for (const key of EXPRESSION_KEYS) {
      expect(stepped.sample.expression[key]).toBeCloseTo(single.sample.expression[key], 10);
    }
    for (const key of Object.keys(single.sample.phase) as (keyof typeof single.sample.phase)[]) {
      expect(Math.abs(stepped.sample.phase[key] - single.sample.phase[key])).toBeLessThan(1e-6);
    }
  });

  test("late-page retargeting bends phase without multiplying historical time", () => {
    const controller = new StateTransitionController("thinking", 600);
    controller.setTargetState("searching", 600);
    const before = controller.sample.phase.shimmer;
    controller.advance(600 + 1 / 60);
    const delta = controller.sample.phase.shimmer - before;
    expect(Math.abs(delta)).toBeLessThan(0.04);
  });

  test("named responses stay crisp while preserving a calmer completion", () => {
    expect(STATE_TRANSITION_RESPONSE.error).toBeLessThan(STATE_TRANSITION_RESPONSE.executing);
    expect(STATE_TRANSITION_RESPONSE.executing).toBeLessThan(STATE_TRANSITION_RESPONSE.thinking);
    expect(STATE_TRANSITION_RESPONSE.done).toBeGreaterThan(STATE_TRANSITION_RESPONSE.thinking);
  });

  test("Done settles, holds, then transitions back to Idle", () => {
    const controller = new StateTransitionController("generating");
    controller.setTargetState("done", 0);
    controller.advance(2);
    expect(controller.sample.targetState).toBe("done");
    expect(controller.sample.settled).toBe(true);

    controller.advance(2 + DONE_HOLD_SECONDS + 0.001);
    expect(controller.sample.requestedState).toBe("done");
    expect(controller.sample.targetState).toBe("idle");
    expect(controller.sample.settled).toBe(false);

    controller.advance(4);
    expect(controller.sample.targetState).toBe("idle");
    expect(controller.sample.settled).toBe(true);
    for (const key of MOTION_KEYS)
      expect(controller.sample.motion[key]).toBe(STATE_MOTION.idle[key]);
  });

  test("reduced-motion snap preserves the target expression without spatial interpolation", () => {
    const controller = new StateTransitionController("searching");
    controller.setTargetState("reviewing", 0);
    controller.advance(0.08);
    const sample = controller.snapToState("error", 0.08);
    expect(sample.settled).toBe(true);
    for (const key of EXPRESSION_KEYS) {
      expect(sample.expression[key]).toBe(STATE_EXPRESSION.error[key]);
    }
  });
});

describe("phase-aware motion kernels", () => {
  test("integrated phase reproduces the legacy endpoint at a constant speed", () => {
    const time = 37.25;
    const motion = STATE_MOTION.reviewing;
    const phase = createMotionPhase(time, motion);
    expect(normalDisplacement(0.2, -0.1, 0.5, time, motion, phase)).toBeCloseTo(
      normalDisplacement(0.2, -0.1, 0.5, time, motion),
      12,
    );
    expect(shimmerMultiplier(0.2, -0.1, 0.5, time, motion, phase)).toBeCloseTo(
      shimmerMultiplier(0.2, -0.1, 0.5, time, motion),
      12,
    );
    expect(swayOffsets(time, motion, phase)).toEqual(swayOffsets(time, motion));
  });
});
