import { describe, expect, test } from "vitest";
import { auditAllStateTransitions, auditStateTransition } from "./transitionAudit.js";

describe("deterministic transition audit", () => {
  test("all 90 directed state pairs pass frame-by-frame continuity checks", () => {
    const results = auditAllStateTransitions({ fps: 60, duration: 0.8 });
    expect(results).toHaveLength(90);
    expect(results.filter((result) => !result.passed)).toEqual([]);
    expect(Math.max(...results.map((result) => result.startDiscontinuity))).toBe(0);
    expect(Math.max(...results.map((result) => result.overshootCount))).toBe(0);
    expect(Math.max(...results.map((result) => result.endpointError))).toBeLessThanOrEqual(1e-4);
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
});
