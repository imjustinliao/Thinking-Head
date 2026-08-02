import { describe, expect, it } from "vitest";
import { MECH_STATES, STATE_FRAME_PLANS } from "./states.js";

describe("state storyboards", () => {
  it("covers every supported state", () => {
    expect(Object.keys(STATE_FRAME_PLANS).sort()).toEqual([...MECH_STATES].sort());
  });

  it("has enough deliberate poses to make each transformation readable", () => {
    for (const state of MECH_STATES) {
      const poses = STATE_FRAME_PLANS[state].poses;
      expect(poses.length).toBeGreaterThanOrEqual(7);
      expect(poses[0]?.at).toBe(0);
      expect(poses.at(-1)?.at).toBe(100);
      expect(
        poses.every((pose, index) => {
          const previous = poses[index - 1];
          return index === 0 || (previous !== undefined && pose.at > previous.at);
        }),
      ).toBe(true);
    }
  });
});
