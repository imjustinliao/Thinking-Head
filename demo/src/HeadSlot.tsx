import type { ThinkingHeadState } from "thinking-head";

interface HeadSlotProps {
  state: ThinkingHeadState;
  size: number;
  speed: number;
}

/**
 * Placeholder standing in for the real component until the renderer lands. It reserves
 * exactly the space the head will occupy, so the gallery layout is already final and
 * swapping in the real component is a one-line change per call site.
 */
export function HeadSlot({ state, size, speed }: HeadSlotProps) {
  return (
    <span
      className="head-slot"
      style={{ width: size, height: size }}
      data-state={state}
      data-speed={speed}
      role="img"
      aria-label={`Placeholder for the ${state} head`}
    />
  );
}
