import { describe, expect, test } from "vitest";
import { cameraBasis } from "./camera.js";
import { detectBackend } from "./createRenderer.js";
import {
  CELL_FILL,
  COMPACT_MAX_SIZE,
  depthFadeOf,
  deriveShading,
  GLYPH_MAX_SIZE,
  resolutionForSize,
  resolveTier,
} from "./shading.js";
import { DEFAULT_CAMERA, DEFAULT_STYLE } from "./types.js";

/** A canvas stand-in — these tests never need a real rendering context. */
const fakeCanvas = (): HTMLCanvasElement =>
  ({ getContext: () => null }) as unknown as HTMLCanvasElement;

describe("backend selection", () => {
  test("falls back to Canvas 2D where WebGL2 is unavailable", () => {
    // Node has no WebGL2RenderingContext, which is exactly the no-WebGL environment the
    // fallback exists for.
    expect(typeof WebGL2RenderingContext).toBe("undefined");
    expect(detectBackend(fakeCanvas())).toBe("canvas2d");
  });

  test("falls back when the canvas cannot provide a context at all", () => {
    const broken = {} as unknown as HTMLCanvasElement;
    expect(detectBackend(broken)).toBe("canvas2d");
  });
});

describe("camera basis", () => {
  test("carries state-driven view-axis roll independently of yaw and pitch", () => {
    const rolled = cameraBasis(DEFAULT_CAMERA, 0, 0, -0.12);
    expect(rolled.cosRoll).toBeCloseTo(Math.cos(-0.12), 8);
    expect(rolled.sinRoll).toBeCloseTo(Math.sin(-0.12), 8);

    const neutral = cameraBasis(DEFAULT_CAMERA);
    expect(neutral.cosRoll).toBe(1);
    expect(neutral.sinRoll).toBe(0);
  });
});

describe("shading derivation", () => {
  // Both backends read these values, so asserting them here covers the WebGL path's shading
  // inputs too — which is the point of deriving them outside the renderers.
  test("glyph mode engages only at and below the small-size threshold", () => {
    expect(deriveShading(20, 20, 0.1, DEFAULT_STYLE, 1).glyphMode).toBe(true);
    expect(deriveShading(GLYPH_MAX_SIZE, 32, 0.1, DEFAULT_STYLE, 1).glyphMode).toBe(true);
    expect(deriveShading(GLYPH_MAX_SIZE + 1, 33, 0.1, DEFAULT_STYLE, 1).glyphMode).toBe(false);
  });

  test("glyph mode recedes the skin and full mode leaves it alone", () => {
    const small = deriveShading(20, 20, 0.1, DEFAULT_STYLE, 1);
    expect(small.glyphSkinRadius).toBeLessThan(1);
    expect(small.glyphSkinAlpha).toBeLessThan(1);

    const large = deriveShading(120, 240, 0.05, DEFAULT_STYLE, 1);
    expect(large.glyphSkinRadius).toBe(1);
    expect(large.glyphSkinAlpha).toBe(1);
  });

  test("every particle is the same size by default, at every size", () => {
    // The governing rule: a bigger head is a denser surface, never bigger particles.
    for (const px of [20, 32, 64, 128, 256]) {
      expect(deriveShading(px, px, 0.05, DEFAULT_STYLE, 1).featureEmphasis).toBe(1);
    }
  });

  test("feature emphasis still responds to the knob when a caller opts in", () => {
    const boosted = { ...DEFAULT_STYLE, featureBoost: 0.5 };
    const tiny = deriveShading(20, 20, 0.05, boosted, 1).featureEmphasis;
    const large = deriveShading(256, 256, 0.05, boosted, 1).featureEmphasis;
    expect(tiny).toBeGreaterThan(large);
    expect(large).toBeCloseTo(1, 5);
  });

  test("particle size holds constant on screen as the head grows", () => {
    // Surface spacing gets finer in proportion to the head, keeping pixel size stable.
    // This is the regression guard for the two failed models: radius-from-spacing (which made
    // sparse heads grow fat blobs) and a fixed CSS radius (which left the grid non-contiguous).
    const small = deriveShading(64, 64, 2 / 40, DEFAULT_STYLE, 1).baseRadius;
    const large = deriveShading(256, 256, 2 / 160, DEFAULT_STYLE, 1).baseRadius;
    expect(large / small).toBeCloseTo(1, 1);
  });

  test("particles overlap their cell slightly to close curved-surface projection gaps", () => {
    // Cell projects to 4 device px. A small overlap prevents holes between projected facial
    // planes while the square silhouette still exposes the particle structure.
    const cellsAcross = 40;
    const shading = deriveShading(160, 160, 2 / cellsAcross, DEFAULT_STYLE, 1);
    const cellPx = 160 / cellsAcross;
    expect(shading.baseRadius).toBeCloseTo(cellPx * 0.5 * CELL_FILL, 4);
    expect(shading.baseRadius * 2).toBeGreaterThan(cellPx);
    expect(shading.baseRadius * 2).toBeLessThan(cellPx * 1.2);
  });

  test("particle size tracks device pixel ratio for the same surface level", () => {
    const dpr1 = deriveShading(64, 64, 0.05, DEFAULT_STYLE, 1).baseRadius;
    const dpr2 = deriveShading(64, 128, 0.05, DEFAULT_STYLE, 1).baseRadius;
    expect(dpr2).toBeCloseTo(dpr1 * 2, 5);
  });

  test("surface resolution scales linearly with rendered size", () => {
    // Linear in size means quadratic in particle count, which is surface area — the right law.
    const at64 = resolutionForSize(64, 2);
    const at128 = resolutionForSize(128, 2);
    const at256 = resolutionForSize(256, 2);
    expect(at128 / at64).toBeCloseTo(2, 1);
    expect(at256 / at128).toBeCloseTo(2, 1);
  });

  test("resolution respects the tier floor so tiny heads still resolve a face", () => {
    expect(resolutionForSize(12)).toBeGreaterThanOrEqual(resolveTier(12).minResolution);
    expect(resolutionForSize(300)).toBeGreaterThan(resolveTier(300).minResolution);
  });

  test("tiers partition the size range", () => {
    expect(resolveTier(20).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE + 1).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE + 1).name).toBe("display");
  });

  test("display anatomy relies on light rather than painted feature holes", () => {
    const glyph = deriveShading(24, 24, 0.1, DEFAULT_STYLE, 1);
    const compact = deriveShading(72, 144, 0.05, DEFAULT_STYLE, 1);
    const display = deriveShading(256, 512, 0.02, DEFAULT_STYLE, 1);
    expect(glyph.albedoFlatten).toBe(0);
    expect(compact.albedoFlatten).toBeGreaterThan(glyph.albedoFlatten);
    expect(display.albedoFlatten).toBeGreaterThan(compact.albedoFlatten);
    expect(display.albedoFlatten).toBeLessThan(1);
  });

  test("glyph tier suppresses lighting, display tier applies it fully", () => {
    const small = deriveShading(24, 24, 0.1, DEFAULT_STYLE, 1).lighting;
    const large = deriveShading(256, 256, 0.02, DEFAULT_STYLE, 1).lighting;
    expect(small).toBeLessThan(large * 0.5);
    expect(large).toBeCloseTo(DEFAULT_STYLE.lighting, 5);
  });

  test("particle radius never collapses below a visible floor", () => {
    const extreme = deriveShading(
      16,
      16,
      0.002,
      { ...DEFAULT_STYLE, particleScale: 0.3 },
      1,
    ).baseRadius;
    expect(extreme).toBeGreaterThanOrEqual(0.35);
  });

  test("depth attenuation preserves the face and spans the complete head depth", () => {
    const dim = 0.52;
    expect(depthFadeOf(1, 1, dim)).toBe(1);
    expect(depthFadeOf(0, 1, dim)).toBeCloseTo(1 - dim * 0.5, 6);
    expect(depthFadeOf(-1, 1, dim)).toBeCloseTo(1 - dim, 6);
  });

  test("depth attenuation clamps malformed caller values safely", () => {
    expect(depthFadeOf(2, 1, 2)).toBe(1);
    expect(depthFadeOf(-2, 1, 2)).toBe(0);
    expect(depthFadeOf(0, 0, 0.5)).toBe(1);
  });
});
