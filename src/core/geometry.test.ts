import { beforeAll, describe, expect, test } from "vitest";
import { generateHeadLevel, HeadModel, LEVEL_RESOLUTIONS } from "./geometry.js";
import type { HeadPointSet } from "./pointset.js";
import { validatePointSet } from "./pointset.js";
import { FEATURE_REGIONS, REGION, REGION_NAMES } from "./regions.js";
import { headBounds, DEFAULT_HEAD_PARAMS as P, sdHead } from "./sdf.js";

let head: HeadPointSet;

beforeAll(() => {
  head = generateHeadLevel({ resolution: 48 });
});

describe("point set format", () => {
  test("satisfies the array-length invariants", () => {
    expect(() => validatePointSet(head)).not.toThrow();
    expect(head.count).toBeGreaterThan(1000);
  });

  test("normals are unit length", () => {
    for (let i = 0; i < head.count; i++) {
      const len = Math.hypot(head.normals[i * 3], head.normals[i * 3 + 1], head.normals[i * 3 + 2]);
      expect(len).toBeCloseTo(1, 3);
    }
  });

  test("region tags are all known values", () => {
    const valid = new Set<number>(REGION_NAMES.map((n) => REGION[n]));
    for (let i = 0; i < head.count; i++) {
      expect(valid).toContain(head.regionId[i]);
    }
  });

  test("weights and occlusion are within the unit range", () => {
    for (let i = 0; i < head.count; i++) {
      expect(head.weight[i]).toBeGreaterThan(0);
      expect(head.weight[i]).toBeLessThanOrEqual(1);
      expect(head.occlusion[i]).toBeGreaterThanOrEqual(0);
      expect(head.occlusion[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe("lattice structure", () => {
  // The defining property of the new model: particles sit on a regular grid. This is what makes
  // every particle the same size a property of the data rather than a convention, and it is what
  // produces the contiguous voxel surface instead of scattered stipple.
  test("every particle sits on a regular lattice", () => {
    const { cellSize } = head;
    expect(cellSize).toBeGreaterThan(0);

    // Cell centres are offset by half a cell from the domain edge, so position/cellSize should
    // land on a half-integer everywhere, on all three axes.
    for (let i = 0; i < head.count; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const coord = head.positions[i * 3 + axis];
        const cells = coord / cellSize;
        const frac = Math.abs(cells - Math.round(cells));
        expect(Math.abs(frac - 0.5)).toBeLessThan(1e-3);
      }
    }
  });

  test("no two particles occupy the same cell", () => {
    const seen = new Set<string>();
    const { cellSize } = head;
    for (let i = 0; i < head.count; i++) {
      // Keyed in half-cell units. Cell centres sit exactly on half-cell boundaries, so dividing
      // by cellSize alone lands on .5 where rounding is ambiguous and distinct cells can collide.
      const key = [0, 1, 2]
        .map((a) => Math.round((2 * head.positions[i * 3 + a]) / cellSize))
        .join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test("every cell is close enough to the surface to contain it", () => {
    // The narrow-band test keeps cells within a half-diagonal of the isosurface. Anything
    // further out is a cell the refinement should have pruned.
    const limit = head.cellSize * 0.58 + 1e-6;
    for (let i = 0; i < head.count; i++) {
      const d = Math.abs(
        sdHead(head.positions[i * 3], head.positions[i * 3 + 1], head.positions[i * 3 + 2], P),
      );
      expect(d).toBeLessThanOrEqual(limit);
    }
  });

  test("the lattice forms a hollow shell, not a solid volume", () => {
    // A solid fill would scale with the cube of resolution and swamp the GPU. Surface-only
    // voxelisation scales with the square, so the count must sit far below the volume bound.
    const solid = head.resolution ** 3;
    expect(head.count).toBeLessThan(solid * 0.05);
  });
});

describe("levels of detail", () => {
  test("finer levels have smaller cells and more particles", () => {
    const coarse = generateHeadLevel({ resolution: 24 });
    const fine = generateHeadLevel({ resolution: 48 });
    expect(fine.cellSize).toBeLessThan(coarse.cellSize);
    expect(fine.count).toBeGreaterThan(coarse.count);
  });

  test("particle count grows with surface area, not volume", () => {
    // Doubling resolution should roughly quadruple the count (area), not multiply it by eight.
    const coarse = generateHeadLevel({ resolution: 24 });
    const fine = generateHeadLevel({ resolution: 48 });
    const ratio = fine.count / coarse.count;
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(5.5);
  });

  test("cell size matches the domain divided by resolution", () => {
    const b = headBounds(P);
    const expected = (2 * Math.max(b.x, b.y, b.z)) / 48;
    expect(head.cellSize).toBeCloseTo(expected, 6);
  });

  test("the model caches levels rather than rebuilding them", () => {
    const model = new HeadModel();
    const first = model.level(24);
    const second = model.level(24);
    expect(second).toBe(first);
    expect(model.builtLevels).toEqual([24]);
  });

  test("level selection tracks rendered size and only builds what is shown", () => {
    const model = new HeadModel();
    const small = model.levelForSize(40);
    const large = model.levelForSize(320);
    expect(large.resolution).toBeGreaterThan(small.resolution);
    // Lazy: a page showing two sizes must not have built all eight levels.
    expect(model.builtLevels.length).toBeLessThan(LEVEL_RESOLUTIONS.length);
  });

  test("level selection honours a visual tier's landmark floor", () => {
    const model = new HeadModel();
    // At DPR 1, pure density selects resolution 12 for a 16px head. The glyph tier floors that
    // above 12 because the coarsest lattice contains eyes but no mouth.
    const glyph = model.levelForSize(16, 1.6, 14);
    const present = new Set<number>(glyph.regionId);

    expect(glyph.resolution).toBeGreaterThanOrEqual(14);
    expect(present).toContain(REGION.eyeL);
    expect(present).toContain(REGION.eyeR);
    expect(present).toContain(REGION.mouth);
  });
});

describe("determinism", () => {
  test("the same parameters reproduce byte-identical geometry", () => {
    const a = generateHeadLevel({ resolution: 24 });
    const b = generateHeadLevel({ resolution: 24 });
    expect(a.count).toBe(b.count);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.regionId)).toEqual(Array.from(b.regionId));
  });
});

describe("facial features", () => {
  test("every expressive region is present on the lattice", () => {
    const present = new Set<number>();
    for (let i = 0; i < head.count; i++) present.add(head.regionId[i]);
    for (const name of FEATURE_REGIONS) {
      expect(present, `expected ${name} cells`).toContain(REGION[name]);
    }
  });

  test("features survive down to the coarsest usable level", () => {
    // A glyph-sized head still has to show two eyes and a mouth.
    const coarse = generateHeadLevel({ resolution: 16 });
    const present = new Set<number>();
    for (let i = 0; i < coarse.count; i++) present.add(coarse.regionId[i]);
    expect(present).toContain(REGION.eyeL);
    expect(present).toContain(REGION.eyeR);
    expect(present).toContain(REGION.mouth);
  });

  test("eye cells sit on the front of the head and are left/right symmetric in count", () => {
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
    expect(left).toBeGreaterThan(4);
    // The lattice is symmetric about x, so the two eyes should populate near-equally.
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.25);
  });
});
