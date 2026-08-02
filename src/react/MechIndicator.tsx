import type { ComponentPropsWithoutRef } from "react";
import { DEFAULT_STATE_LABELS, type MechState } from "../core/states.js";

export interface MechIndicatorProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  state: MechState;
  /** Reserved for the redesigned visual component. */
  size?: number;
  /** Reserved for the redesigned visual component. */
  speed?: number;
  /** Reserved for the redesigned visual component. */
  paused?: boolean;
  /** Replaces the state-derived accessible label. */
  label?: string;
}

/**
 * Deliberately plain during the visual-system reset. The public state and
 * accessibility contract remain usable while the next indicator is designed.
 */
export function MechIndicator({
  state,
  size: _size,
  speed: _speed,
  paused: _paused,
  label,
  ...rest
}: MechIndicatorProps) {
  return (
    <span {...rest} aria-label={label ?? DEFAULT_STATE_LABELS[state]} data-state={state} role="img">
      [{state} appearance placeholder]
    </span>
  );
}
