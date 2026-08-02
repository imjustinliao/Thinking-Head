import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { DEFAULT_STATE_LABELS, type MechState } from "../core/states.js";
import { useMechStyles } from "./styles.js";

export interface MechIndicatorProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  state: MechState;
  /** CSS pixels. Values are clamped to a practical 16–160px range. */
  size?: number;
  /** A multiplier from 0.25× through 2×. */
  speed?: number;
  /** Freezes the current pose without unmounting the component. */
  paused?: boolean;
  /** Replaces the state-derived accessible label. */
  label?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function MechIndicator({
  state,
  size = 44,
  speed = 1,
  paused = false,
  label,
  className,
  style,
  ...rest
}: MechIndicatorProps) {
  useMechStyles();
  const safeSize = clamp(size, 16, 160);
  const safeSpeed = clamp(speed, 0.25, 2);
  const variables = {
    "--thm-size": `${safeSize}px`,
    "--thm-loop": `${(4.8 / safeSpeed).toFixed(2)}s`,
    "--thm-play": paused ? "paused" : "running",
    ...style,
  } as CSSProperties;

  return (
    <span
      {...rest}
      aria-label={label ?? DEFAULT_STATE_LABELS[state]}
      className={["thm-indicator", className].filter(Boolean).join(" ")}
      data-state={state}
      role="img"
      style={variables}
    >
      <svg aria-hidden="true" className="thm-svg" viewBox="0 0 100 100">
        <g className="thm-wave">
          <circle className="thm-detail" cx="50" cy="46" r="33" />
          <circle className="thm-detail" cx="50" cy="46" r="25" />
        </g>
        <g className="thm-beam">
          <path d="M50 35 L90 12 L88 27 Z" fill="currentColor" opacity=".14" />
          <path className="thm-detail" d="M51 36 L88 19" />
        </g>
        <g className="thm-halo">
          <ellipse className="thm-detail" cx="50" cy="35" rx="25" ry="9" />
          <circle className="thm-core" cx="74" cy="35" r="3" />
        </g>
        <g className="thm-sensor">
          <path className="thm-detail" d="M50 30 V13 M44 15 L50 9 L56 15" />
          <circle className="thm-core" cx="50" cy="10" r="3" />
        </g>
        <g className="thm-frame">
          <g className="thm-arm left">
            <path className="thm-shell" d="M34 52 L21 65 L27 72 L42 59 Z" />
            <path className="thm-detail" d="M24 68 L18 75" />
          </g>
          <g className="thm-arm right">
            <path className="thm-shell" d="M66 52 L79 65 L73 72 L58 59 Z" />
            <path className="thm-detail" d="M76 68 L82 75" />
          </g>
          <path className="thm-shell" d="M35 38 Q50 26 65 38 L69 61 Q62 76 50 79 Q38 76 31 61 Z" />
          <path className="thm-shell" d="M41 28 L50 20 L59 28 L57 43 L43 43 Z" />
          <path className="thm-visor" d="M44 31 L56 31 L54 36 L46 36 Z" />
          <path className="thm-detail" d="M40 51 H60 M43 63 H57" />
          <circle className="thm-core" cx="50" cy="54" r="6" />
        </g>
        <g className="thm-rover">
          <path className="thm-shell" d="M23 70 Q50 57 77 70 L81 81 H19 Z" />
          <g className="thm-wheel">
            <circle cx="31" cy="80" r="8" />
            <circle cx="69" cy="80" r="8" />
          </g>
          <path className="thm-detail" d="M39 73 H61" />
        </g>
        <g className="thm-plate">
          <rect className="thm-shell" x="31" y="58" width="38" height="24" rx="3" />
          <path className="thm-line one" d="M38 65 H62" />
          <path className="thm-line two" d="M38 70 H58" />
          <path className="thm-line three" d="M38 75 H64" />
        </g>
      </svg>
    </span>
  );
}
