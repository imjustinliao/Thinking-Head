import type { ThinkingHeadState } from "thinking-head";

interface HeadSlotProps {
  state: ThinkingHeadState;
  size: number;
  speed: number;
}

/**
 * Placeholder standing in for the real component until the renderer lands. Styled as an
 * empty specimen chamber — concentric hairlines, a crosshair and a dot matrix — so an
 * unfilled slot reads as deliberate instrumentation rather than a broken image.
 *
 * It reserves exactly the space the head will occupy, so swapping in the real component is
 * a one-line change per call site.
 */
export function HeadSlot({ state, size, speed }: HeadSlotProps) {
  return (
    <span
      className="chamber"
      style={{ width: size, height: size }}
      data-state={state}
      data-speed={speed}
      role="img"
      aria-label={`Empty chamber for the ${state} head`}
    >
      <span className="chamber-matrix" />
      <span className="chamber-ring" />
      <span className="chamber-crosshair" />
      <span className="chamber-halo" />
    </span>
  );
}
