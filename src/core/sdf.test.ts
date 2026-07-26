import { describe, expect, test } from "vitest";
import { REGION } from "./regions.js";
import {
  classifyRegion,
  headBounds,
  DEFAULT_HEAD_PARAMS as P,
  sdHead,
  sdHeadNormal,
} from "./sdf.js";

/** Bisects along a ray from an interior point to an exterior point to land on the surface. */
function findSurface(dx: number, dy: number, dz: number): [number, number, number] {
  const b = headBounds(P);
  const far = 2 * Math.max(b.x, b.y, b.z);
  let lo = 0;
  let hi = far;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sdHead(dx * mid, dy * mid, dz * mid, P) < 0) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return [dx * t, dy * t, dz * t];
}

describe("head signed distance field", () => {
  test("origin is inside the head", () => {
    expect(sdHead(0, 0, 0, P)).toBeLessThan(0);
  });

  test("distant points are outside", () => {
    expect(sdHead(5, 0, 0, P)).toBeGreaterThan(0);
    expect(sdHead(0, 5, 0, P)).toBeGreaterThan(0);
    expect(sdHead(0, 0, -5, P)).toBeGreaterThan(0);
  });

  test("bounds fully enclose the surface", () => {
    const b = headBounds(P);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          expect(sdHead(sx * b.x, sy * b.y, sz * b.z, P)).toBeGreaterThan(0);
        }
      }
    }
  });

  test("bisection converges onto the isosurface in every direction", () => {
    const dirs: [number, number, number][] = [
      [0, 1, 0],
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0.577, 0.577, 0.577],
    ];
    for (const [dx, dy, dz] of dirs) {
      const [x, y, z] = findSurface(dx, dy, dz);
      expect(Math.abs(sdHead(x, y, z, P))).toBeLessThan(1e-6);
    }
  });

  test("the head is taller than it is wide, and reads as a skull not a ball", () => {
    const [, top] = findSurface(0, 1, 0);
    const [side] = findSurface(1, 0, 0);
    expect(top).toBeGreaterThan(side);
  });

  test("the jaw is narrower than the cranium", () => {
    // Half-width of the surface at cranium height versus at chin height.
    const widthAt = (y: number) => {
      let lo = 0;
      let hi = 2;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (sdHead(mid, y, 0, P) < 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    expect(widthAt(-0.5)).toBeLessThan(widthAt(0.2));
  });
});

describe("surface normals", () => {
  test("are unit length", () => {
    const out = new Float32Array(3);
    for (const dir of [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0.4, -0.8, 0.3],
    ] as [number, number, number][]) {
      const [x, y, z] = findSurface(dir[0], dir[1], dir[2]);
      sdHeadNormal(x, y, z, P, out, 0);
      const len = Math.hypot(out[0], out[1], out[2]);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  test("point outward", () => {
    const out = new Float32Array(3);
    const [x, y, z] = findSurface(0, 1, 0);
    sdHeadNormal(x, y, z, P, out, 0);
    expect(out[1]).toBeGreaterThan(0.6);

    const [fx, fy, fz] = findSurface(0, 0, 1);
    sdHeadNormal(fx, fy, fz, P, out, 0);
    expect(out[2]).toBeGreaterThan(0.3);
  });
});

describe("region classification", () => {
  test("the crown is cranium", () => {
    const [x, y, z] = findSurface(0, 1, 0);
    expect(classifyRegion(x, y, z, P)).toBe(REGION.cranium);
  });

  test("the chin is jaw", () => {
    const [x, y, z] = findSurface(0, -1, 0);
    expect(classifyRegion(x, y, z, P)).toBe(REGION.jaw);
  });

  test("only structural regions are produced — features are placed explicitly", () => {
    const structural = new Set<number>([REGION.cranium, REGION.jaw, REGION.cheek, REGION.nose]);
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const b = Math.sin(i * 1.7);
      const [x, y, z] = findSurface(Math.cos(a) * 0.8, b, Math.sin(a) * 0.8);
      expect(structural).toContain(classifyRegion(x, y, z, P));
    }
  });
});
