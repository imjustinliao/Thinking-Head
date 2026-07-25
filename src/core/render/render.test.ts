import { describe, expect, test } from "vitest";
import { detectBackend } from "./createRenderer.js";
import {
  CELL_FILL,
  COMPACT_MAX_SIZE,
  deriveShading,
  GLYPH_MAX_SIZE,
  resolutionForSize,
  resolveTier,
} from "./shading.js";
import { DEFAULT_STYLE } from "./types.js";

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
    // The governing rule: a bigger head is a finer lattice, never bigger particles.
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
    // The lattice gets finer in proportion to the head, so a cell keeps the same pixel size.
    // This is the regression guard for the two failed models: radius-from-spacing (which made
    // sparse heads grow fat blobs) and a fixed CSS radius (which left the grid non-contiguous).
    const small = deriveShading(64, 64, 2 / 40, DEFAULT_STYLE, 1).baseRadius;
    const large = deriveShading(256, 256, 2 / 160, DEFAULT_STYLE, 1).baseRadius;
    expect(large / small).toBeCloseTo(1, 1);
  });

  test("particles tile their cell rather than overlapping or leaving gaps", () => {
    // Cell projects to 4 device px, so a particle should be just under 2px in radius.
    const cellsAcross = 40;
    const shading = deriveShading(160, 160, 2 / cellsAcross, DEFAULT_STYLE, 1);
    const cellPx = 160 / cellsAcross;
    expect(shading.baseRadius).toBeCloseTo(cellPx * 0.5 * CELL_FILL, 4);
    expect(shading.baseRadius * 2).toBeLessThan(cellPx);
  });

  test("particle size tracks device pixel ratio for the same lattice", () => {
    const dpr1 = deriveShading(64, 64, 0.05, DEFAULT_STYLE, 1).baseRadius;
    const dpr2 = deriveShading(64, 128, 0.05, DEFAULT_STYLE, 1).baseRadius;
    expect(dpr2).toBeCloseTo(dpr1 * 2, 5);
  });

  test("lattice resolution scales linearly with rendered size", () => {
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
});
