/**
 * The five universal agent activities supported by the first release.
 *
 * A state describes an intent, rather than a single animation. The renderer can
 * enter it at any time because its movement is made from independent cycles.
 */
export const MECH_STATES = ["thinking", "executing", "listening", "searching", "reading"] as const;

export type MechState = (typeof MECH_STATES)[number];

export type MechForm = "mech" | "rover" | "scout";

export interface KeyPose {
  /** Position in the state sequence, from 0 through 100. */
  readonly at: number;
  readonly name: string;
  readonly detail: string;
}

export interface StateFramePlan {
  readonly state: MechState;
  readonly form: MechForm;
  readonly label: string;
  readonly description: string;
  readonly poses: readonly KeyPose[];
}

export const DEFAULT_STATE_LABELS: Record<MechState, string> = {
  thinking: "Agent is thinking",
  executing: "Agent is executing an action",
  listening: "Agent is listening",
  searching: "Agent is searching",
  reading: "Agent is reading",
};

/**
 * The storyboard is public data so a product can explain its status language
 * without reverse-engineering the visual. Poses are designed as loops: the
 * last pose returns cleanly to the first without assuming a fixed start time.
 */
export const STATE_FRAME_PLANS: Record<MechState, StateFramePlan> = {
  thinking: {
    state: "thinking",
    form: "mech",
    label: "Thinking",
    description: "An upright machine gathers energy, tilts its visor, and holds a quiet orbit.",
    poses: [
      { at: 0, name: "Parked", detail: "Compact chassis rests with its core dim." },
      { at: 16, name: "Ignition", detail: "The core wakes with one measured pulse." },
      { at: 31, name: "Rise", detail: "Wheel pods hinge down as the torso lifts." },
      { at: 48, name: "Settle", detail: "Arms unfold just enough to balance the stance." },
      { at: 65, name: "Consider", detail: "The visor angles upward; the halo begins to precess." },
      { at: 82, name: "Connect", detail: "Two orbit passes cross above the core." },
      { at: 100, name: "Held thought", detail: "The pose eases back to its quiet parked balance." },
    ],
  },
  executing: {
    state: "executing",
    form: "rover",
    label: "Executing",
    description: "A precise upright machine compresses into a fast, capable rover.",
    poses: [
      { at: 0, name: "Ready", detail: "The mech stands square, core charged." },
      { at: 14, name: "Arms in", detail: "Forearms fold tight against the torso." },
      { at: 28, name: "Compress", detail: "The torso drops as the visor locks forward." },
      { at: 42, name: "Treads out", detail: "Wheel pods rotate into a wide driving base." },
      { at: 56, name: "Lock", detail: "The chassis forms one clean horizontal silhouette." },
      { at: 72, name: "Drive", detail: "Wheels spin; a short power pulse runs through the frame." },
      { at: 86, name: "Correct", detail: "The rover makes a tiny suspension correction." },
      { at: 100, name: "Cruise", detail: "Speed cadence returns to the locked rover form." },
    ],
  },
  listening: {
    state: "listening",
    form: "mech",
    label: "Listening",
    description:
      "A still, attentive mech deploys a mast and turns its panels into receiving dishes.",
    poses: [
      { at: 0, name: "Still", detail: "The compact mech holds a neutral stance." },
      { at: 15, name: "Attention", detail: "The visor centers and the core softens." },
      { at: 30, name: "Mast up", detail: "A slim antenna rises from the crown." },
      { at: 45, name: "Dishes open", detail: "Side panels fan out toward the signal." },
      { at: 61, name: "Receive", detail: "A first ripple reaches the core." },
      { at: 77, name: "Resolve", detail: "A second, smaller ripple confirms the input." },
      { at: 100, name: "Attentive", detail: "The mast remains poised for the next sound." },
    ],
  },
  searching: {
    state: "searching",
    form: "scout",
    label: "Searching",
    description: "A low scout raises a sensor mast and sweeps a narrow, directional beam.",
    poses: [
      { at: 0, name: "Scout", detail: "The chassis sits low with the sensor stowed." },
      { at: 13, name: "Deploy", detail: "The sensor mast lifts from the centerline." },
      { at: 27, name: "Calibrate", detail: "The gimbal makes a short centering turn." },
      { at: 43, name: "Sweep left", detail: "A narrow beam checks the left boundary." },
      { at: 58, name: "Sweep center", detail: "The beam crosses the core reference line." },
      { at: 73, name: "Sweep right", detail: "The beam reaches the opposite boundary." },
      { at: 87, name: "Acquire", detail: "A quick core flash marks a possible match." },
      { at: 100, name: "Continue", detail: "The mast returns to its first scan angle." },
    ],
  },
  reading: {
    state: "reading",
    form: "mech",
    label: "Reading",
    description:
      "An upright mech opens a data plate, leans in, and follows information line by line.",
    poses: [
      { at: 0, name: "Stand by", detail: "The frame waits with its arms folded." },
      { at: 14, name: "Brace", detail: "Feet and torso lock into a stable reading stance." },
      { at: 29, name: "Plate out", detail: "Both arms present a slim data plate." },
      { at: 45, name: "Lean in", detail: "The visor dips toward the plate." },
      { at: 61, name: "Top line", detail: "The first scan marker glides across the display." },
      { at: 75, name: "Next line", detail: "The marker steps down with a gentle confirm pulse." },
      { at: 89, name: "Review", detail: "The final line brightens, then settles." },
      { at: 100, name: "Continue", detail: "The plate remains open for the next passage." },
    ],
  },
};
