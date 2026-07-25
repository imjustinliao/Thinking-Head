import type { ThinkingHeadState } from "thinking-head";

/**
 * Demo-only copy. These descriptions document the intended expression for each state so
 * the gallery can be reviewed against the spec; they are not part of the package API.
 */
export const STATE_NOTES: Record<ThinkingHeadState, { when: string; expression: string }> = {
  idle: {
    when: "Waiting, not yet started",
    expression: "Neutral, relaxed, slow ambient motion",
  },
  listening: {
    when: "Receiving input",
    expression: "Head tilt, alert and focused",
  },
  reading: {
    when: "Ingesting existing context or data",
    expression: "Eyes scanning, slight head dip",
  },
  thinking: {
    when: "Reasoning or planning, no external action yet",
    expression: "Eyes unfocused and upward, contemplative",
  },
  searching: {
    when: "Actively retrieving from an external source",
    expression: "Eyes darting, scanning head motion",
  },
  executing: {
    when: "Running a tool, command or action",
    expression: "Sharper, more mechanical, precise motion",
  },
  generating: {
    when: "Producing output",
    expression: "Active outward motion and energy",
  },
  reviewing: {
    when: "Self-check or verification pass",
    expression: "Head nod, narrowed focus",
  },
  error: {
    when: "Failed or blocked",
    expression: "Brief distinct expression plus colour accent",
  },
  done: {
    when: "Complete",
    expression: "Brief settle and brighten, then returns to idle",
  },
};
