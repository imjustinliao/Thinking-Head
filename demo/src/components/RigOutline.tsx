import type { MechState } from "thinking-head";

export type RigForm = "vehicle" | "upright";

/** Canonical form per state, from the approved state mapping. */
export const STATE_FORMS: Record<MechState, RigForm> = {
  thinking: "upright",
  executing: "vehicle",
  listening: "upright",
  searching: "vehicle",
  reading: "upright",
};

type PartName =
  | "shadow"
  | "chassis"
  | "roofPanel"
  | "cabin"
  | "wheelRear"
  | "wheelFront"
  | "sensor"
  | "accessory"
  | "armLeft"
  | "armRight"
  | "legLeft"
  | "legRight";

/** translate x, translate y, rotation in degrees, scale x, scale y. */
type Pose = readonly [number, number, number, number, number];

/**
 * Every part is authored once at the origin and placed by a group transform.
 * No part is added or removed between forms, so a form change is interpolation
 * rather than a swap — the property the real rig depends on.
 */
const POSES: Record<RigForm, Record<PartName, Pose>> = {
  vehicle: {
    shadow: [120, 149, 0, 1, 1],
    chassis: [120, 113, 0, 1, 1],
    roofPanel: [116, 86, 0, 1, 1],
    cabin: [116, 86, 0, 0.8, 0.42],
    wheelRear: [66, 132, 0, 1, 1],
    wheelFront: [174, 132, 0, 1, 1],
    sensor: [196, 110, 0, 0.62, 0.62],
    accessory: [150, 70, 0, 0.55, 0.55],
    armLeft: [96, 120, 90, 0.55, 0.55],
    armRight: [148, 120, 90, 0.55, 0.55],
    legLeft: [96, 104, 90, 0.5, 0.5],
    legRight: [148, 104, 90, 0.5, 0.5],
  },
  upright: {
    shadow: [120, 149, 0, 0.45, 0.8],
    chassis: [120, 110, 0, 0.28, 0.5],
    roofPanel: [120, 74, 0, 0.62, 0.5],
    cabin: [120, 86, 0, 1, 0.7],
    wheelRear: [98, 72, 0, 0.55, 0.55],
    wheelFront: [142, 72, 0, 0.55, 0.55],
    sensor: [120, 48, 0, 1, 1],
    accessory: [162, 92, 0, 0.85, 0.85],
    armLeft: [90, 88, 0, 0.7, 0.7],
    armRight: [148, 88, 0, 0.7, 0.7],
    legLeft: [110, 135, 0, 0.8, 0.8],
    legRight: [130, 135, 0, 0.8, 0.8],
  },
};

function at(form: RigForm, part: PartName) {
  const [x, y, rotation, scaleX, scaleY] = POSES[form][part];
  // One consistent function order keeps browsers interpolating component-wise
  // instead of falling back to matrix decomposition.
  return `translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})`;
}

export interface RigOutlineProps {
  state: MechState;
  label: string;
}

/**
 * Temporary outline pass. It establishes the part list, transform origins, and
 * silhouette of both canonical forms so the composition can be reviewed before
 * material and the real state motion are designed.
 */
export function RigOutline({ state, label }: RigOutlineProps) {
  const form = STATE_FORMS[state];
  const part = (name: PartName) => ({ className: "rig__part", transform: at(form, name) });

  return (
    <svg
      aria-label={`${label} — ${form === "vehicle" ? "low vehicle" : "upright machine"} outline`}
      className="rig"
      role="img"
      viewBox="0 0 240 168"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="rig__shadow" transform={at(form, "shadow")}>
        <ellipse cx="0" cy="0" rx="60" ry="4.5" />
      </g>

      <line className="rig__ground" x1="8" x2="232" y1="149" y2="149" />

      <g {...part("legLeft")}>
        <rect height="32" rx="3" width="13" x="-6.5" y="-16" />
      </g>
      <g {...part("legRight")}>
        <rect height="32" rx="3" width="13" x="-6.5" y="-16" />
      </g>
      <g {...part("armLeft")}>
        <rect height="40" rx="4" width="12" x="-6" y="-20" />
      </g>

      <g {...part("chassis")}>
        <rect height="30" rx="6" width="160" x="-80" y="-15" />
      </g>
      <g {...part("wheelRear")}>
        <circle cx="0" cy="0" r="17" />
      </g>
      <g {...part("wheelFront")}>
        <circle cx="0" cy="0" r="17" />
      </g>

      <g {...part("roofPanel")}>
        <rect height="22" rx="5" width="76" x="-38" y="-11" />
      </g>
      <g {...part("cabin")}>
        <rect height="46" rx="5" width="40" x="-20" y="-23" />
      </g>
      <g {...part("sensor")}>
        <circle cx="0" cy="0" r="13" />
      </g>
      <g {...part("accessory")}>
        <rect height="20" rx="3" width="26" x="-13" y="-10" />
      </g>
      <g {...part("armRight")}>
        <rect height="40" rx="4" width="12" x="-6" y="-20" />
      </g>
    </svg>
  );
}
