import { beforeAll, describe, expect, test } from "vitest";
import { generateHeadLevel, HeadModel, LEVEL_RESOLUTIONS } from "./geometry.js";
import { DEFAULT_HEAD_PARAMS } from "./head.js";
import type { HeadPointSet } from "./pointset.js";
import { validatePointSet } from "./pointset.js";
import { FEATURE_REGIONS, REGION, REGION_NAMES } from "./regions.js";
import { minimumResolutionForSize } from "./render/shading.js";

let head: HeadPointSet;

beforeAll(() => {
  head = generateHeadLevel({ resolution: 96 });
});

describe("point set format", () => {
  test("satisfies the array-length invariants", () => {
    expect(() => validatePointSet(head)).not.toThrow();
    expect(head.count).toBeGreaterThan(2000);
  });

  test("normals are unit length", () => {
    for (let i = 0; i < head.count; i++) {
      const len = Math.hypot(head.normals[i * 3], head.normals[i * 3 + 1], head.normals[i * 3 + 2]);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  test("region tags are known and weights and occlusion stay bounded", () => {
    const valid = new Set<number>(REGION_NAMES.map((name) => REGION[name]));
    for (let i = 0; i < head.count; i++) {
      expect(valid).toContain(head.regionId[i]);
      expect(head.weight[i]).toBeGreaterThan(0);
      expect(head.weight[i]).toBeLessThanOrEqual(1);
      expect(head.occlusion[i]).toBeGreaterThanOrEqual(0);
      expect(head.occlusion[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe("human anatomy", () => {
  test("the full display level uses the complete dense surface", () => {
    expect(generateHeadLevel({ resolution: 136 }).count).toBe(8192);
  });

  test("the neutral surface has adult head proportions and a projecting nose", () => {
    const full = generateHeadLevel({ resolution: 136 });
    expect(full.bounds.y / full.bounds.x).toBeGreaterThan(1.35);
    expect(full.bounds.y / full.bounds.x).toBeLessThan(1.55);

    let nasalTip = Number.NEGATIVE_INFINITY;
    let cheekPlane = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < full.count; i++) {
      const x = full.positions[i * 3];
      const y = full.positions[i * 3 + 1];
      const z = full.positions[i * 3 + 2];
      if (Math.abs(x) < 0.07 && y > -0.08 && y < 0.15) nasalTip = Math.max(nasalTip, z);
      if (Math.abs(x) > 0.24 && Math.abs(x) < 0.4 && y > -0.08 && y < 0.16) {
        cheekPlane = Math.max(cheekPlane, z);
      }
    }
    expect(nasalTip - cheekPlane).toBeGreaterThan(0.18);
  });

  test("the surface includes paired ears and a neck rather than an isolated mask", () => {
    const full = generateHeadLevel({ resolution: 136 });
    let leftEar = 0;
    let rightEar = 0;
    let neck = 0;
    for (let i = 0; i < full.count; i++) {
      const x = full.positions[i * 3];
      const y = full.positions[i * 3 + 1];
      if (x > 0.46 && y > -0.08 && y < 0.22) leftEar++;
      if (x < -0.46 && y > -0.08 && y < 0.22) rightEar++;
      if (Math.abs(x) < 0.28 && y < -0.62) neck++;
    }
    expect(leftEar).toBeGreaterThan(8);
    expect(rightEar).toBeGreaterThan(8);
    expect(neck).toBeGreaterThan(20);
  });

  test("global controls scale one coherent surface", () => {
    const base = generateHeadLevel({ resolution: 68 });
    const changed = generateHeadLevel({
      resolution: 68,
      head: {
        ...DEFAULT_HEAD_PARAMS,
        width: DEFAULT_HEAD_PARAMS.width * 1.12,
        frontDepth: DEFAULT_HEAD_PARAMS.frontDepth * 0.9,
      },
    });
    expect(changed.bounds.x / base.bounds.x).toBeCloseTo(1.12, 2);
    expect(changed.bounds.z).toBeLessThan(base.bounds.z);
  });
});

describe("progressive levels of detail", () => {
  test("finer levels have smaller nominal spacing and more particles", () => {
    const coarse = generateHeadLevel({ resolution: 24 });
    const fine = generateHeadLevel({ resolution: 48 });
    expect(fine.cellSize).toBeLessThan(coarse.cellSize);
    expect(fine.count).toBeGreaterThan(coarse.count);
  });

  test("particle count grows with surface area", () => {
    const coarse = generateHeadLevel({ resolution: 24 });
    const fine = generateHeadLevel({ resolution: 48 });
    expect(fine.count / coarse.count).toBeCloseTo(4, 1);
  });

  test("nominal spacing matches the measured diameter divided by resolution", () => {
    expect(head.cellSize).toBeCloseTo((2 * head.radius) / head.resolution, 6);
  });

  test("the same identity is preserved by progressive prefixes", () => {
    const coarse = generateHeadLevel({ resolution: 24 });
    const fine = generateHeadLevel({ resolution: 48 });
    expect(Array.from(fine.positions.slice(0, coarse.positions.length))).toEqual(
      Array.from(coarse.positions),
    );
  });

  test("the model caches levels rather than rebuilding them", () => {
    const model = new HeadModel();
    const first = model.level(24);
    const second = model.level(24);
    expect(second).toBe(first);
    expect(model.builtLevels).toEqual([24]);
  });

  test("level selection tracks rendered size and builds only what is shown", () => {
    const model = new HeadModel();
    const small = model.levelForSize(40);
    const large = model.levelForSize(320);
    expect(large.resolution).toBeGreaterThan(small.resolution);
    expect(model.builtLevels.length).toBeLessThan(LEVEL_RESOLUTIONS.length);
  });

  test("level selection honours a visual tier's landmark floor", () => {
    const model = new HeadModel();
    const glyph = model.levelForSize(16, 1.6, 14);
    const present = new Set<number>(glyph.regionId);
    expect(glyph.resolution).toBeGreaterThanOrEqual(14);
    expect(present).toContain(REGION.eyeL);
    expect(present).toContain(REGION.eyeR);
    expect(present).toContain(REGION.mouth);
  });

  test("DPR sharpens particles without changing their CSS-space density", () => {
    const model = new HeadModel();
    const cssSize = 24;
    const targetCellCss = 1.6;
    const minimum = minimumResolutionForSize(cssSize);
    const dpr1 = model.levelForSize(cssSize, targetCellCss, minimum);
    const dpr2 = model.levelForSize(cssSize * 2, targetCellCss * 2, minimum);
    expect(dpr2.resolution).toBe(dpr1.resolution);
    expect(dpr2.count).toBe(dpr1.count);
  });

  test("small rendered sizes select the deliberate optical master ladder", () => {
    const model = new HeadModel();
    const selected = [16, 24, 32, 48, 64, 80, 96].map((cssSize) =>
      model.levelForSize(cssSize * 2, 1.6 * 2, minimumResolutionForSize(cssSize)),
    );
    expect(selected.map((level) => level.resolution)).toEqual([17, 24, 34, 48, 68, 96, 136]);
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i].count).toBeGreaterThan(selected[i - 1].count);
    }
  });
});

describe("determinism and facial regions", () => {
  test("the same parameters reproduce byte-identical geometry", () => {
    const a = generateHeadLevel({ resolution: 48 });
    const b = generateHeadLevel({ resolution: 48 });
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.normals)).toEqual(Array.from(b.normals));
    expect(Array.from(a.regionId)).toEqual(Array.from(b.regionId));
  });

  test("every expressive region is present on the sampled anatomy", () => {
    const present = new Set<number>(head.regionId);
    for (const name of FEATURE_REGIONS) {
      expect(present, `expected ${name} points`).toContain(REGION[name]);
    }
  });

  test("facial landmarks survive at glyph density", () => {
    const coarse = generateHeadLevel({ resolution: 16 });
    const present = new Set<number>(coarse.regionId);
    expect(present).toContain(REGION.eyeL);
    expect(present).toContain(REGION.eyeR);
    expect(present).toContain(REGION.mouth);
  });

  test("eye points sit on the face with balanced left and right populations", () => {
    let left = 0;
    let right = 0;
    for (let i = 0; i < head.count; i++) {
      if (head.regionId[i] === REGION.eyeL) {
        left++;
        expect(head.positions[i * 3]).toBeGreaterThan(0);
      }
      if (head.regionId[i] === REGION.eyeR) {
        right++;
        expect(head.positions[i * 3]).toBeLessThan(0);
      }
    }
    expect(left).toBeGreaterThan(20);
    expect(right).toBeGreaterThan(20);
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.25);
  });

  test("paired anterior ocular surfaces close the openings behind the eyelids", () => {
    const full = generateHeadLevel({ resolution: 136 });
    let left = 0;
    let right = 0;
    for (let i = 0; i < full.count; i++) {
      const region = full.regionId[i];
      const normalZ = full.normals[i * 3 + 2];
      const z = full.positions[i * 3 + 2];
      if (normalZ < 0.7 || z < 0.42) continue;
      if (region === REGION.eyeL) left++;
      if (region === REGION.eyeR) right++;
    }
    expect(left).toBeGreaterThan(40);
    expect(right).toBeGreaterThan(40);
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.1);
  });
});
