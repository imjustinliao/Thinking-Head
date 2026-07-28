import { describe, expect, test } from "vitest";
import { THINKING_HEAD_STATES } from "./states.js";
import { STATE_TRANSITION_RESPONSE } from "./transition.js";
import {
  auditAllStateTransitions,
  auditFacialRetargetSequence,
  auditHeldFacialState,
  auditStateTransition,
  MAX_FACIAL_FRAME_STEP,
  MAX_NORMALIZED_FRAME_STEP,
} from "./transitionAudit.js";

describe("deterministic transition audit", () => {
  test("all 90 directed state pairs pass frame-by-frame continuity checks", () => {
    const results = auditAllStateTransitions({ fps: 60, duration: 0.8 });
    expect(results).toHaveLength(90);
    expect(results.filter((result) => !result.passed)).toEqual([]);
    expect(Math.max(...results.map((result) => result.startDiscontinuity))).toBe(0);
    expect(Math.max(...results.map((result) => result.facialStartDiscontinuity))).toBe(0);
    expect(Math.max(...results.map((result) => result.overshootCount))).toBe(0);
    expect(Math.max(...results.map((result) => result.endpointError))).toBeLessThanOrEqual(1e-4);
    expect(Math.max(...results.map((result) => result.maxNormalizedStep))).toBeLessThanOrEqual(
      MAX_NORMALIZED_FRAME_STEP,
    );
    expect(Math.max(...results.map((result) => result.maxFacialFrameStep))).toBeLessThanOrEqual(
      MAX_FACIAL_FRAME_STEP,
    );
    expect(
      Math.max(...results.map((result) => result.settledAt ?? Number.POSITIVE_INFINITY)),
    ).toBeLessThanOrEqual(0.8);
  });

  test("reports a stable endpoint for a same-state recording", () => {
    const result = auditStateTransition("thinking", "thinking");
    expect(result.passed).toBe(true);
    expect(result.settledAt).toBe(0);
    expect(result.startDiscontinuity).toBe(0);
    expect(result.endpointError).toBe(0);
    expect(result.maxNormalizedStep).toBe(0);
  });

  test("rejects a transition compressed into one frame", () => {
    const original = STATE_TRANSITION_RESPONSE.error;
    STATE_TRANSITION_RESPONSE.error = 0.001;
    try {
      const result = auditStateTransition("idle", "error");
      expect(result.maxNormalizedStep).toBeGreaterThan(0.99);
      expect(result.passed).toBe(false);
    } finally {
      STATE_TRANSITION_RESPONSE.error = original;
    }
  });

  test("remains continuous at a non-zero shared-clock phase", () => {
    const result = auditStateTransition("searching", "executing", { startTime: 937.125 });
    expect(result.passed).toBe(true);
    expect(result.startDiscontinuity).toBe(0);
  });

  test("all ten settled states keep moving at least one local facial family", () => {
    const results = THINKING_HEAD_STATES.map((state) =>
      auditHeldFacialState(state, { fps: 60, duration: 3 }),
    );
    expect(results.filter((result) => !result.passed)).toEqual([]);
    expect(Math.min(...results.map((result) => result.maxControlRange))).toBeGreaterThanOrEqual(
      0.02,
    );
    expect(results.find((result) => result.state === "generating")?.lowerFaceRange).toBeGreaterThan(
      0.2,
    );
    expect(results.find((result) => result.state === "searching")?.upperFaceRange).toBeGreaterThan(
      0.5,
    );
  });

  test("rapid facial retarget sequences preserve the current frame and stay bounded", () => {
    const sequences = [
      {
        initial: "idle" as const,
        events: [
          { at: 0, state: "searching" as const },
          { at: 0.12, state: "executing" as const },
          { at: 0.23, state: "error" as const },
        ],
      },
      {
        initial: "reading" as const,
        events: [
          { at: 0, state: "thinking" as const },
          { at: 0.14, state: "searching" as const },
          { at: 0.28, state: "reviewing" as const },
        ],
      },
      {
        initial: "error" as const,
        events: [
          { at: 0, state: "done" as const },
          { at: 0.1, state: "error" as const },
          { at: 0.26, state: "done" as const },
        ],
      },
      {
        initial: "listening" as const,
        events: [
          { at: 0, state: "reading" as const },
          { at: 0.1, state: "listening" as const },
        ],
      },
    ];

    for (const sequence of sequences) {
      const result = auditFacialRetargetSequence(sequence.initial, sequence.events, {
        fps: 60,
        duration: 0.8,
      });
      expect(result.eventDiscontinuity).toBe(0);
      expect(result.maxFacialFrameStep).toBeLessThanOrEqual(MAX_FACIAL_FRAME_STEP);
      expect(result.passed).toBe(true);
    }
  });
});
