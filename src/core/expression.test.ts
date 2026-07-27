import { beforeAll, describe, expect, test } from "vitest";
import {
  createExpressionRigMetrics,
  deformExpressionPoint,
  EXPRESSION_KEYS,
  type ExpressionKey,
  type ExpressionParams,
  expressionRigOf,
  IDLE_EXPRESSION,
  LISTENING_EXPRESSION,
  measureExpressionRig,
  NEUTRAL_EXPRESSION,
  READING_EXPRESSION,
  STATE_EXPRESSION,
} from "./expression.js";
import { generateHeadLevel } from "./geometry.js";
import type { HeadPointSet } from "./pointset.js";
import { REGION } from "./regions.js";
import { THINKING_HEAD_STATES } from "./states.js";

let head: HeadPointSet;

beforeAll(() => {
  head = generateHeadLevel({ resolution: 48 });
});

function expressionWith(key: ExpressionKey, value = 1): ExpressionParams {
  return { ...NEUTRAL_EXPRESSION, [key]: value };
}

const TARGET_REGIONS: Record<ExpressionKey, number[]> = {
  brow_raiseL: [REGION.browL],
  brow_raiseR: [REGION.browR],
  brow_innerUp: [REGION.browL, REGION.browR],
  brow_furrow: [REGION.browL, REGION.browR],
  eye_openL: [REGION.eyeL],
  eye_openR: [REGION.eyeR],
  eye_gazeX: [REGION.eyeL, REGION.eyeR],
  eye_gazeY: [REGION.eyeL, REGION.eyeR],
  cheek_raise: [REGION.cheek],
  nose_scrunch: [REGION.nose],
  mouth_cornerUpL: [REGION.mouth],
  mouth_cornerUpR: [REGION.mouth],
  mouth_open: [REGION.mouth],
  mouth_pucker: [REGION.mouth],
  mouth_press: [REGION.mouth],
  jaw_open: [REGION.jaw],
  jaw_shiftX: [REGION.jaw],
  jaw_forward: [REGION.jaw],
};

describe("expression control contract", () => {
  test("contains 18 unique scalar controls with a neutral zero vector", () => {
    expect(EXPRESSION_KEYS).toHaveLength(18);
    expect(new Set(EXPRESSION_KEYS).size).toBe(EXPRESSION_KEYS.length);
    for (const key of EXPRESSION_KEYS) expect(NEUTRAL_EXPRESSION[key]).toBe(0);
  });

  test("neutral is immutable", () => {
    expect(Object.isFrozen(NEUTRAL_EXPRESSION)).toBe(true);
  });

  test("every named state has a complete bounded expression", () => {
    const signed = new Set<ExpressionKey>([
      "brow_raiseL",
      "brow_raiseR",
      "brow_innerUp",
      "eye_openL",
      "eye_openR",
      "eye_gazeX",
      "eye_gazeY",
      "mouth_cornerUpL",
      "mouth_cornerUpR",
      "jaw_shiftX",
      "jaw_forward",
    ]);

    for (const state of THINKING_HEAD_STATES) {
      const expression = STATE_EXPRESSION[state];
      expect(expression, `${state} has no expression`).toBeDefined();
      for (const key of EXPRESSION_KEYS) {
        expect(Number.isFinite(expression[key]), `${state}.${key} is not finite`).toBe(true);
        expect(expression[key], `${state}.${key} exceeds its upper bound`).toBeLessThanOrEqual(1);
        expect(expression[key], `${state}.${key} exceeds its lower bound`).toBeGreaterThanOrEqual(
          signed.has(key) ? -1 : 0,
        );
      }
    }
  });
});

describe("listening expression", () => {
  test("opens the eyes and lifts both brows without changing the neutral gaze", () => {
    expect(LISTENING_EXPRESSION.eye_openL).toBeGreaterThan(IDLE_EXPRESSION.eye_openL);
    expect(LISTENING_EXPRESSION.eye_openR).toBeGreaterThan(IDLE_EXPRESSION.eye_openR);
    expect(LISTENING_EXPRESSION.brow_raiseL).toBeGreaterThan(IDLE_EXPRESSION.brow_raiseL);
    expect(LISTENING_EXPRESSION.brow_raiseR).toBeGreaterThan(IDLE_EXPRESSION.brow_raiseR);
    expect(LISTENING_EXPRESSION.eye_gazeX).toBe(0);
    expect(LISTENING_EXPRESSION.eye_gazeY).toBe(0);
  });

  test("is immutable and registered", () => {
    expect(Object.isFrozen(LISTENING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.listening).toBe(LISTENING_EXPRESSION);
    expect(STATE_EXPRESSION.idle).toBe(IDLE_EXPRESSION);
  });
});

describe("reading expression", () => {
  test("lowers and narrows the gaze without adding a negative furrow", () => {
    expect(READING_EXPRESSION.eye_gazeY).toBeLessThan(IDLE_EXPRESSION.eye_gazeY);
    expect(READING_EXPRESSION.eye_openL).toBeLessThan(IDLE_EXPRESSION.eye_openL);
    expect(READING_EXPRESSION.eye_openR).toBeLessThan(IDLE_EXPRESSION.eye_openR);
    expect(READING_EXPRESSION.brow_raiseL).toBeLessThan(IDLE_EXPRESSION.brow_raiseL);
    expect(READING_EXPRESSION.brow_raiseR).toBeLessThan(IDLE_EXPRESSION.brow_raiseR);
    expect(READING_EXPRESSION.brow_furrow).toBe(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(READING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.reading).toBe(READING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (state === "idle" || state === "listening" || state === "reading") continue;
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("derived rig metrics", () => {
  test("measures centred region bounds into caller-owned storage", () => {
    const synthetic: HeadPointSet = {
      positions: new Float32Array([1, 2, 4, 3, 6, 8]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1]),
      regionId: new Uint8Array([REGION.mouth, REGION.mouth]),
      weight: new Float32Array([1, 1]),
      occlusion: new Float32Array([1, 1]),
      count: 2,
      cellSize: 0.5,
      resolution: 2,
      bounds: { x: 1, y: 2, z: 2 },
      center: { x: 2, y: 3, z: 5 },
      radius: 3,
    };
    const reusable = createExpressionRigMetrics();
    const centerIdentity = reusable.regionCenter;
    const extentIdentity = reusable.regionHalfExtent;
    const measured = measureExpressionRig(synthetic, reusable);
    const mouth = REGION.mouth * 3;

    expect(measured).toBe(reusable);
    expect(measured.regionCenter).toBe(centerIdentity);
    expect(measured.regionHalfExtent).toBe(extentIdentity);
    expect(Array.from(measured.regionCenter.subarray(mouth, mouth + 3))).toEqual([0, 1, 1]);
    expect(Array.from(measured.regionHalfExtent.subarray(mouth, mouth + 3))).toEqual([1, 2, 2]);

    // Missing regions still receive finite non-zero extents, keeping shader division safe.
    const eye = REGION.eyeL * 3;
    expect(Array.from(measured.regionCenter.subarray(eye, eye + 3))).toEqual([0, 0, 0]);
    expect(Array.from(measured.regionHalfExtent.subarray(eye, eye + 3))).toEqual([
      0.25, 0.25, 0.25,
    ]);
  });

  test("caches one metric object per immutable point set", () => {
    expect(expressionRigOf(head)).toBe(expressionRigOf(head));
  });
});

describe("analytic point deformation", () => {
  test("neutral preserves every rest position and normal", () => {
    const rig = expressionRigOf(head);
    const out = new Float32Array(6);
    for (let i = 0; i < head.count; i++) {
      const offset = i * 3;
      const px = head.positions[offset] - head.center.x;
      const py = head.positions[offset + 1] - head.center.y;
      const pz = head.positions[offset + 2] - head.center.z;
      const nx = head.normals[offset];
      const ny = head.normals[offset + 1];
      const nz = head.normals[offset + 2];
      deformExpressionPoint(
        out,
        px,
        py,
        pz,
        nx,
        ny,
        nz,
        head.regionId[i],
        head.weight[i],
        head.radius,
        rig,
        NEUTRAL_EXPRESSION,
      );
      expect(out[0]).toBeCloseTo(px, 6);
      expect(out[1]).toBeCloseTo(py, 6);
      expect(out[2]).toBeCloseTo(pz, 6);
      expect(out[3]).toBeCloseTo(nx, 6);
      expect(out[4]).toBeCloseTo(ny, 6);
      expect(out[5]).toBeCloseTo(nz, 6);
    }
  });

  test("every control moves its intended region and no other region", () => {
    const rig = expressionRigOf(head);
    const out = new Float32Array(6);

    for (const key of EXPRESSION_KEYS) {
      const expression = expressionWith(key);
      const targets = TARGET_REGIONS[key];
      let targetDelta = 0;
      let outsideDelta = 0;

      for (let i = 0; i < head.count; i++) {
        const offset = i * 3;
        const px = head.positions[offset] - head.center.x;
        const py = head.positions[offset + 1] - head.center.y;
        const pz = head.positions[offset + 2] - head.center.z;
        const nx = head.normals[offset];
        const ny = head.normals[offset + 1];
        const nz = head.normals[offset + 2];
        deformExpressionPoint(
          out,
          px,
          py,
          pz,
          nx,
          ny,
          nz,
          head.regionId[i],
          head.weight[i],
          head.radius,
          rig,
          expression,
        );
        const delta = Math.hypot(
          out[0] - px,
          out[1] - py,
          out[2] - pz,
          out[3] - nx,
          out[4] - ny,
          out[5] - nz,
        );
        if (targets.includes(head.regionId[i])) targetDelta = Math.max(targetDelta, delta);
        else outsideDelta = Math.max(outsideDelta, delta);
      }

      expect(targetDelta, `${key} should deform its target`).toBeGreaterThan(1e-5);
      expect(outsideDelta, `${key} should stay region-local`).toBeLessThan(1e-7);
    }
  });

  test("jaw rotation preserves unit normals", () => {
    const rig = expressionRigOf(head);
    const expression = expressionWith("jaw_open");
    const out = new Float32Array(6);

    for (let i = 0; i < head.count; i++) {
      if (head.regionId[i] !== REGION.jaw) continue;
      const offset = i * 3;
      deformExpressionPoint(
        out,
        head.positions[offset] - head.center.x,
        head.positions[offset + 1] - head.center.y,
        head.positions[offset + 2] - head.center.z,
        head.normals[offset],
        head.normals[offset + 1],
        head.normals[offset + 2],
        head.regionId[i],
        head.weight[i],
        head.radius,
        rig,
        expression,
      );
      expect(Math.hypot(out[3], out[4], out[5])).toBeCloseTo(1, 5);
    }
  });

  test("eye opening preserves the spherical ocular surface behind the lids", () => {
    const rig = expressionRigOf(head);
    const globeIndex = Array.from(head.regionId).findIndex((region, index) => {
      const offset = index * 3;
      return (region === REGION.eyeL || region === REGION.eyeR) && head.normals[offset + 2] > 0.7;
    });
    expect(globeIndex).toBeGreaterThanOrEqual(0);

    const offset = globeIndex * 3;
    const rest = [
      head.positions[offset] - head.center.x,
      head.positions[offset + 1] - head.center.y,
      head.positions[offset + 2] - head.center.z,
    ] as const;
    const out = new Float32Array(6);
    deformExpressionPoint(
      out,
      ...rest,
      head.normals[offset],
      head.normals[offset + 1],
      head.normals[offset + 2],
      head.regionId[globeIndex],
      head.weight[globeIndex],
      head.radius,
      rig,
      { ...NEUTRAL_EXPRESSION, eye_openL: 1, eye_openR: 1 },
    );
    expect(Array.from(out.subarray(0, 3))).toEqual(Array.from(rest));
  });

  test("clamps control values to their documented ranges", () => {
    const rig = expressionRigOf(head);
    const jawIndex = head.regionId.indexOf(REGION.jaw);
    expect(jawIndex).toBeGreaterThanOrEqual(0);
    const offset = jawIndex * 3;
    const args = [
      head.positions[offset] - head.center.x,
      head.positions[offset + 1] - head.center.y,
      head.positions[offset + 2] - head.center.z,
      head.normals[offset],
      head.normals[offset + 1],
      head.normals[offset + 2],
    ] as const;
    const atLimit = new Float32Array(6);
    const beyondLimit = new Float32Array(6);

    deformExpressionPoint(atLimit, ...args, REGION.jaw, head.weight[jawIndex], head.radius, rig, {
      ...NEUTRAL_EXPRESSION,
      jaw_open: 1,
      jaw_shiftX: -1,
      jaw_forward: 1,
    });
    deformExpressionPoint(
      beyondLimit,
      ...args,
      REGION.jaw,
      head.weight[jawIndex],
      head.radius,
      rig,
      { ...NEUTRAL_EXPRESSION, jaw_open: 50, jaw_shiftX: -50, jaw_forward: 50 },
    );

    expect(Array.from(beyondLimit)).toEqual(Array.from(atLimit));
  });
});
