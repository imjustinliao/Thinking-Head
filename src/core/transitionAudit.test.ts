import { describe, expect, test } from "vitest";
import { STATE_TRANSITION_RESPONSE } from "./transition.js";
import {
  auditAllStateTransitions,
  auditStateTransition,
  MAX_NORMALIZED_FRAME_STEP,
} from "./transitionAudit.js";

describe("deterministic transition audit", () => {
  test("all 90 directed state pairs pass frame-by-frame continuity checks", () => {
    const results = auditAllStateTransitions({ fps: 60, duration: 0.8 });
    expect(results).toHaveLength(90);
    expect(results.filter((result) => !result.passed)).toEqual([]);
    expect(Math.max(...results.map((result) => result.startDiscontinuity))).toBe(0);
    expect(Math.max(...results.map((result) => result.overshootCount))).toBe(0);
    expect(Math.max(...results.map((result) => result.endpointError))).toBeLessThanOrEqual(1e-4);
    expect(Math.max(...results.map((result) => result.maxNormalizedStep))).toBeLessThanOrEqual(
      MAX_NORMALIZED_FRAME_STEP,
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
});
