import type { ThinkingHeadState } from "./states.js";

/** Two independent semantic channels can crossfade directly from Error to Done without a cut. */
export interface StateAccent {
  error: number;
  done: number;
}

export const ACCENT_KEYS = ["error", "done"] as const satisfies readonly (keyof StateAccent)[];

export const ERROR_ACCENT_COLOR = "#ff6f5c";
export const DONE_ACCENT_COLOR = "#8affc1";

/** Normalised sRGB channels, kept numeric so WebGL never parses or allocates during a frame. */
export const ERROR_ACCENT_RGB = { r: 1, g: 111 / 255, b: 92 / 255 } as const;
export const DONE_ACCENT_RGB = { r: 138 / 255, g: 1, b: 193 / 255 } as const;

const NONE: Readonly<StateAccent> = { error: 0, done: 0 };

export const STATE_ACCENT: Record<ThinkingHeadState, Readonly<StateAccent>> = {
  idle: NONE,
  listening: NONE,
  reading: NONE,
  thinking: NONE,
  searching: NONE,
  executing: NONE,
  generating: NONE,
  reviewing: NONE,
  error: { error: 1, done: 0 },
  done: { error: 0, done: 1 },
};
