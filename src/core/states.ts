/**
 * The five universal agent activities supported by the first release.
 *
 * A state describes an intent, rather than a single animation. The renderer can
 * enter it at any time because its movement is made from independent cycles.
 */
export const MECH_STATES = ["thinking", "executing", "listening", "searching", "reading"] as const;

export type MechState = (typeof MECH_STATES)[number];

export type MechForm = "placeholder";

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
 * State data remains public while the visual system is redesigned. There are
 * intentionally no pose instructions to preserve from the reset.
 */
export const STATE_FRAME_PLANS: Record<MechState, StateFramePlan> = {
  thinking: {
    state: "thinking",
    form: "placeholder",
    label: "Thinking",
    description: "Temporary appearance placeholder.",
    poses: [],
  },
  executing: {
    state: "executing",
    form: "placeholder",
    label: "Executing",
    description: "Temporary appearance placeholder.",
    poses: [],
  },
  listening: {
    state: "listening",
    form: "placeholder",
    label: "Listening",
    description: "Temporary appearance placeholder.",
    poses: [],
  },
  searching: {
    state: "searching",
    form: "placeholder",
    label: "Searching",
    description: "Temporary appearance placeholder.",
    poses: [],
  },
  reading: {
    state: "reading",
    form: "placeholder",
    label: "Reading",
    description: "Temporary appearance placeholder.",
    poses: [],
  },
};
