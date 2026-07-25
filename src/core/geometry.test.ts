import { beforeAll, describe, expect, test } from "vitest";
import { generateHead, particleCountForSize } from "./geometry.js";
import { mulberry32 } from "./math.js";
import type { HeadPointSet } from "./pointset.js";
import { validatePointSet } from "./pointset.js";
import { FEATURE_REGIONS, REGION, REGION_NAMES } from "./regions.js";
import { DEFAULT_HEAD_PARAMS as P, sdHead } from "./sdf.js";

// Generation is the expensive part of this suite, so it runs once and every test reads it.
let head: HeadPointSet;

beforeAll(() => {
  head = generateHead();
});

/** Smallest distance between any two of the first `n` particles. */
function minSeparation(set: HeadPointSet, n: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = set.positions[i * 3] - set.positions[j * 3];
      const dy = set.positions[i * 3 + 1] - set.positions[j * 3 + 1];
      const dz = set.positions[i * 3 + 2] - set.positions[j * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < min) min = d;
    }
  }
  return min;
}

describe("point set format", () => {
  test("satisfies the array-length invariants", () => {
    expect(() => validatePointSet(head)).not.toThrow();
    expect(head.count).toBeGreaterThan(400);
  });

  test("every particle lies on the head surface", () => {
    let worst = 0;
    for (let i = 0; i < head.count; i++) {
      const d = Math.abs(
        sdHead(head.positions[i * 3], head.positions[i * 3 + 1], head.positions[i * 3 + 2], P),
      );
      if (d > worst) worst = d;
    }
    expect(worst).toBeLessThan(6e-3);
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

  test("weights are within the unit range", () => {
    for (let i = 0; i < head.count; i++) {
      expect(head.weight[i]).toBeGreaterThan(0);
      expect(head.weight[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe("determinism", () => {
  test("the same seed reproduces byte-identical geometry", () => {
    const a = generateHead({ seed: 1234 });
    const b = generateHead({ seed: 1234 });
    expect(a.count).toBe(b.count);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.regionId)).toEqual(Array.from(b.regionId));
    expect(Array.from(a.weight)).toEqual(Array.from(b.weight));
  });

  test("different seeds produce different geometry", () => {
    const a = generateHead({ seed: 1 });
    const b = generateHead({ seed: 2 });
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  test("the PRNG itself is reproducible and in range", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("progressive blue-noise ordering", () => {
  test("prefixes are increasingly well separated as they shrink", () => {
    // The defining property: a smaller prefix is a sparser Poisson-disk set, so its minimum
    // separation must not be worse than that of a larger prefix.
    const wide = minSeparation(head, 400);
    const narrow = minSeparation(head, 120);
    const tiny = minSeparation(head, 60);
    expect(narrow).toBeGreaterThanOrEqual(wide);
    expect(tiny).toBeGreaterThanOrEqual(narrow);
  });

  test("no two particles are coincident", () => {
    expect(minSeparation(head, 300)).toBeGreaterThan(1e-4);
  });
});

describe("small-size legibility", () => {
  // This is the requirement that a 20px head still reads as a face. It is a property of the
  // region-weighted elimination, so it is asserted rather than left to inspection.
  test("every expressive feature appears within the first 56 particles", () => {
    const prefix = new Set<number>();
    for (let i = 0; i < 56; i++) prefix.add(head.regionId[i]);
    for (const name of FEATURE_REGIONS) {
      expect(prefix, `expected ${name} within the first 56 particles`).toContain(REGION[name]);
    }
  });

  test("features are over-represented at small counts relative to the full head", () => {
    const featureIds = new Set<number>(FEATURE_REGIONS.map((n) => REGION[n]));
    const share = (n: number) => {
      let hits = 0;
      for (let i = 0; i < n; i++) if (featureIds.has(head.regionId[i])) hits++;
      return hits / n;
    };
    expect(share(56)).toBeGreaterThan(share(head.count));
  });
});

describe("density from rendered size", () => {
  test("scales monotonically with pixel size", () => {
    const at20 = particleCountForSize(20, 1400);
    const at48 = particleCountForSize(48, 1400);
    const at256 = particleCountForSize(256, 1400);
    expect(at20).toBeLessThan(at48);
    expect(at48).toBeLessThan(at256);
  });

  test("stays inside the available particle budget", () => {
    for (const px of [8, 16, 20, 64, 256, 1000]) {
      const n = particleCountForSize(px, 1400);
      expect(n).toBeGreaterThanOrEqual(44);
      expect(n).toBeLessThanOrEqual(1400);
    }
  });
});
