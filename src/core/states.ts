/**
 * The ten universal-verb states the head can be in. Ordered as a rough lifecycle
 * (waiting -> receiving -> processing -> acting -> finishing) rather than alphabetically,
 * because the demo gallery and docs both read better in lifecycle order.
 */
export const THINKING_HEAD_STATES = [
  "idle",
  "listening",
  "reading",
  "thinking",
  "searching",
  "executing",
  "generating",
  "reviewing",
  "error",
  "done",
] as const;

export type ThinkingHeadState = (typeof THINKING_HEAD_STATES)[number];

/**
 * Modality accents layer a colour and motion-texture hint over any base state, so a
 * product can signal what kind of model is running without a separate sculpted
 * expression per modality.
 */
export const MODALITY_ACCENTS = ["text", "audio", "vision"] as const;

export type ModalityAccent = (typeof MODALITY_ACCENTS)[number];

/**
 * Default screen-reader announcements, published as part of the API so consumers can
 * localise or override them. The canvas itself is aria-hidden; these strings are what
 * actually reach assistive technology via the live region.
 */
export const DEFAULT_STATE_LABELS: Record<ThinkingHeadState, string> = {
  idle: "Idle",
  listening: "Listening",
  reading: "Reading",
  thinking: "Thinking",
  searching: "Searching",
  executing: "Running a tool",
  generating: "Generating a response",
  reviewing: "Reviewing",
  error: "Something went wrong",
  done: "Done",
};
