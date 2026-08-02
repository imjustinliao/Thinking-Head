import { describe, expect, it } from "vitest";
import { MECH_STATES, STATE_FRAME_PLANS } from "./states.js";

describe("state storyboards", () => {
  it("covers every supported state", () => {
    expect(Object.keys(STATE_FRAME_PLANS).sort()).toEqual([...MECH_STATES].sort());
  });

  it("holds explicit placeholders until the visual redesign is approved", () => {
    for (const state of MECH_STATES) {
      const plan = STATE_FRAME_PLANS[state];
      expect(plan.form).toBe("placeholder");
      expect(plan.description).toBe("Temporary appearance placeholder.");
      expect(plan.poses).toEqual([]);
    }
  });
});
