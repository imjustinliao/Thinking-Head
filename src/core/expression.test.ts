import { beforeAll, describe, expect, test } from "vitest";
import {
  createExpressionRigMetrics,
  deformExpressionPoint,
  ERROR_EXPRESSION,
  EXECUTING_EXPRESSION,
  EXPRESSION_KEYS,
  type ExpressionKey,
  type ExpressionParams,
  expressionRigOf,
  GENERATING_EXPRESSION,
  IDLE_EXPRESSION,
  LISTENING_EXPRESSION,
  measureExpressionRig,
  NEUTRAL_EXPRESSION,
  READING_EXPRESSION,
  REVIEWING_EXPRESSION,
  SEARCHING_EXPRESSION,
  STATE_EXPRESSION,
  THINKING_EXPRESSION,
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
  test("opens the eyes and lifts both brows asymmetrically without diverting gaze", () => {
    expect(LISTENING_EXPRESSION.eye_openL).toBeGreaterThan(IDLE_EXPRESSION.eye_openL);
    expect(LISTENING_EXPRESSION.eye_openR).toBeGreaterThan(IDLE_EXPRESSION.eye_openR);
    expect(LISTENING_EXPRESSION.brow_raiseL).toBeGreaterThan(IDLE_EXPRESSION.brow_raiseL);
    expect(LISTENING_EXPRESSION.brow_raiseR).toBeGreaterThan(IDLE_EXPRESSION.brow_raiseR);
    expect(LISTENING_EXPRESSION.eye_gazeX).toBe(0);
    expect(LISTENING_EXPRESSION.eye_gazeY).toBe(0);
    expect(LISTENING_EXPRESSION.eye_openL).not.toBe(LISTENING_EXPRESSION.eye_openR);
    expect(LISTENING_EXPRESSION.brow_raiseL).not.toBe(LISTENING_EXPRESSION.brow_raiseR);
    expect(LISTENING_EXPRESSION.cheek_raise).toBeGreaterThan(0);
    expect(LISTENING_EXPRESSION.mouth_cornerUpL).toBeGreaterThan(0);
    expect(LISTENING_EXPRESSION.mouth_cornerUpR).toBeGreaterThan(0);
  });

  test("is immutable and registered", () => {
    expect(Object.isFrozen(LISTENING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.listening).toBe(LISTENING_EXPRESSION);
    expect(STATE_EXPRESSION.idle).toBe(IDLE_EXPRESSION);
  });
});

describe("reading expression", () => {
  test("lowers and narrows the gaze without adding a negative furrow or tense mouth", () => {
    expect(READING_EXPRESSION.eye_gazeY).toBeLessThan(IDLE_EXPRESSION.eye_gazeY);
    expect(READING_EXPRESSION.eye_openL).toBeLessThan(IDLE_EXPRESSION.eye_openL);
    expect(READING_EXPRESSION.eye_openR).toBeLessThan(IDLE_EXPRESSION.eye_openR);
    expect(READING_EXPRESSION.brow_raiseL).toBeLessThan(IDLE_EXPRESSION.brow_raiseL);
    expect(READING_EXPRESSION.brow_raiseR).toBeLessThan(IDLE_EXPRESSION.brow_raiseR);
    expect(READING_EXPRESSION.brow_furrow).toBe(0);
    expect(READING_EXPRESSION.mouth_press).toBeLessThan(0.05);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(READING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.reading).toBe(READING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("thinking expression", () => {
  test("lifts and diverts a soft gaze with restrained contemplative asymmetry", () => {
    expect(THINKING_EXPRESSION.eye_gazeY).toBeGreaterThan(IDLE_EXPRESSION.eye_gazeY);
    expect(THINKING_EXPRESSION.eye_gazeX).not.toBe(IDLE_EXPRESSION.eye_gazeX);
    expect(THINKING_EXPRESSION.eye_openL).toBeLessThan(IDLE_EXPRESSION.eye_openL);
    expect(THINKING_EXPRESSION.eye_openR).toBeLessThanOrEqual(IDLE_EXPRESSION.eye_openR);
    expect(THINKING_EXPRESSION.brow_raiseL).toBeGreaterThan(THINKING_EXPRESSION.brow_raiseR);
    expect(THINKING_EXPRESSION.brow_furrow).toBe(0);
    expect(THINKING_EXPRESSION.mouth_pucker).toBeGreaterThan(0);
    expect(THINKING_EXPRESSION.mouth_open).toBe(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(THINKING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.thinking).toBe(THINKING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("searching expression", () => {
  test("opens and diverts the gaze for an active external scan", () => {
    expect(SEARCHING_EXPRESSION.eye_gazeX).toBeGreaterThan(THINKING_EXPRESSION.eye_gazeX);
    expect(SEARCHING_EXPRESSION.eye_gazeY).toBe(0);
    expect(SEARCHING_EXPRESSION.eye_openL).toBeGreaterThan(IDLE_EXPRESSION.eye_openL);
    expect(SEARCHING_EXPRESSION.eye_openR).toBeGreaterThan(IDLE_EXPRESSION.eye_openR);
    expect(SEARCHING_EXPRESSION.brow_raiseL).not.toBe(SEARCHING_EXPRESSION.brow_raiseR);
    expect(SEARCHING_EXPRESSION.brow_furrow).toBeGreaterThan(0);
    expect(SEARCHING_EXPRESSION.mouth_press).toBeGreaterThan(0);
    expect(SEARCHING_EXPRESSION.mouth_open).toBe(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(SEARCHING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.searching).toBe(SEARCHING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("executing expression", () => {
  test("stabilises a symmetrical forward focus with a braced lower face", () => {
    expect(EXECUTING_EXPRESSION.brow_raiseL).toBeLessThan(IDLE_EXPRESSION.brow_raiseL);
    expect(EXECUTING_EXPRESSION.brow_raiseR).toBe(EXECUTING_EXPRESSION.brow_raiseL);
    expect(EXECUTING_EXPRESSION.brow_furrow).toBeGreaterThan(0);
    expect(EXECUTING_EXPRESSION.eye_openL).toBeLessThan(IDLE_EXPRESSION.eye_openL);
    expect(EXECUTING_EXPRESSION.eye_openR).toBe(EXECUTING_EXPRESSION.eye_openL);
    expect(EXECUTING_EXPRESSION.eye_gazeX).toBe(0);
    expect(EXECUTING_EXPRESSION.eye_gazeY).toBe(0);
    expect(EXECUTING_EXPRESSION.mouth_press).toBeGreaterThan(SEARCHING_EXPRESSION.mouth_press);
    expect(EXECUTING_EXPRESSION.jaw_forward).toBeGreaterThan(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(EXECUTING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.executing).toBe(EXECUTING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("generating expression", () => {
  test("opens the mouth and jaw with an outward, lively upper face", () => {
    expect(GENERATING_EXPRESSION.mouth_open).toBeGreaterThan(0);
    expect(GENERATING_EXPRESSION.jaw_open).toBeGreaterThan(0);
    expect(GENERATING_EXPRESSION.cheek_raise).toBeGreaterThan(0);
    expect(GENERATING_EXPRESSION.eye_openL).toBeGreaterThan(IDLE_EXPRESSION.eye_openL);
    expect(GENERATING_EXPRESSION.eye_openR).toBeGreaterThan(IDLE_EXPRESSION.eye_openR);
    expect(GENERATING_EXPRESSION.mouth_cornerUpL).toBeGreaterThan(0);
    expect(GENERATING_EXPRESSION.mouth_cornerUpR).toBeGreaterThan(0);
    expect(GENERATING_EXPRESSION.mouth_press).toBe(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(GENERATING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.generating).toBe(GENERATING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("reviewing expression", () => {
  test("narrows and lowers an asymmetrical gaze beneath a strong evaluative furrow", () => {
    expect(REVIEWING_EXPRESSION.brow_furrow).toBeGreaterThan(EXECUTING_EXPRESSION.brow_furrow);
    expect(REVIEWING_EXPRESSION.brow_raiseL).not.toBe(REVIEWING_EXPRESSION.brow_raiseR);
    expect(REVIEWING_EXPRESSION.eye_openL).toBeLessThan(EXECUTING_EXPRESSION.eye_openL);
    expect(REVIEWING_EXPRESSION.eye_openR).toBeLessThan(EXECUTING_EXPRESSION.eye_openR);
    expect(REVIEWING_EXPRESSION.eye_gazeY).toBeLessThan(0);
    expect(REVIEWING_EXPRESSION.eye_gazeX).toBe(0);
    expect(REVIEWING_EXPRESSION.mouth_press).toBeGreaterThan(0);
    expect(REVIEWING_EXPRESSION.mouth_open).toBe(0);
  });

  test("is immutable and registered without changing later untuned states", () => {
    expect(Object.isFrozen(REVIEWING_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.reviewing).toBe(REVIEWING_EXPRESSION);
    for (const state of THINKING_HEAD_STATES) {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "reading" ||
        state === "thinking" ||
        state === "searching" ||
        state === "executing" ||
        state === "generating" ||
        state === "reviewing" ||
        state === "error"
      ) {
        continue;
      }
      expect(STATE_EXPRESSION[state], `${state} should still be neutral`).toBe(NEUTRAL_EXPRESSION);
    }
  });
});

describe("error expression", () => {
  test("combines worried brows, open eyes and a parted frown without colour", () => {
    expect(ERROR_EXPRESSION.brow_innerUp).toBeGreaterThan(0);
    expect(ERROR_EXPRESSION.brow_furrow).toBeGreaterThan(0);
    expect(ERROR_EXPRESSION.eye_openL).toBeGreaterThan(IDLE_EXPRESSION.eye_openL);
    expect(ERROR_EXPRESSION.eye_openR).toBeGreaterThan(IDLE_EXPRESSION.eye_openR);
    expect(ERROR_EXPRESSION.nose_scrunch).toBeGreaterThan(0);
    expect(ERROR_EXPRESSION.mouth_cornerUpL).toBeLessThan(0);
    expect(ERROR_EXPRESSION.mouth_cornerUpR).toBeLessThan(0);
    expect(ERROR_EXPRESSION.mouth_open).toBeGreaterThan(0);
    expect(ERROR_EXPRESSION.jaw_open).toBeGreaterThan(0);
  });

  test("is immutable and registered without changing Done", () => {
    expect(Object.isFrozen(ERROR_EXPRESSION)).toBe(true);
    expect(STATE_EXPRESSION.error).toBe(ERROR_EXPRESSION);
    expect(STATE_EXPRESSION.done).toBe(NEUTRAL_EXPRESSION);
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
  test("downward gaze makes the upper lid follow farther than the lower lid", () => {
    const rig = createExpressionRigMetrics();
    const eye = REGION.eyeL * 3;
    rig.regionHalfExtent[eye] = 1;
    rig.regionHalfExtent[eye + 1] = 1;
    rig.regionHalfExtent[eye + 2] = 1;
    const expression = { ...NEUTRAL_EXPRESSION, eye_gazeY: -1 };
    const upper = new Float32Array(6);
    const lower = new Float32Array(6);

    deformExpressionPoint(upper, 0, 0.5, 0, 0, 1, 0, REGION.eyeL, 1, 1, rig, expression);
    deformExpressionPoint(lower, 0, -0.5, 0, 0, 1, 0, REGION.eyeL, 1, 1, rig, expression);

    const upperTravel = upper[1] - 0.5;
    const lowerTravel = lower[1] + 0.5;
    expect(upperTravel).toBeLessThan(lowerTravel);
    expect(lowerTravel).toBeLessThan(0);
  });

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
