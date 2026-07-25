import { describe, expect, test } from "vitest";
import { detectBackend } from "./createRenderer.js";
import {
  COMPACT_MAX_SIZE,
  deriveShading,
  GLYPH_MAX_SIZE,
  particleCountForSize,
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
    expect(deriveShading(20, 20, 40, DEFAULT_STYLE).glyphMode).toBe(true);
    expect(deriveShading(GLYPH_MAX_SIZE, 32, 60, DEFAULT_STYLE).glyphMode).toBe(true);
    expect(deriveShading(GLYPH_MAX_SIZE + 1, 33, 60, DEFAULT_STYLE).glyphMode).toBe(false);
  });

  test("glyph mode recedes the skin and full mode leaves it alone", () => {
    const small = deriveShading(20, 20, 40, DEFAULT_STYLE);
    expect(small.glyphSkinRadius).toBeLessThan(1);
    expect(small.glyphSkinAlpha).toBeLessThan(1);

    const large = deriveShading(120, 240, 400, DEFAULT_STYLE);
    expect(large.glyphSkinRadius).toBe(1);
    expect(large.glyphSkinAlpha).toBe(1);
  });

  test("every particle is the same size by default, at every size", () => {
    // The governing rule: a bigger head is more dots, never bigger dots. Feature emphasis is
    // neutral by default so the grain is identical across the whole range.
    for (const px of [20, 32, 64, 128, 256]) {
      expect(deriveShading(px, px, 200, DEFAULT_STYLE).featureEmphasis).toBe(1);
    }
  });

  test("feature emphasis still responds to the knob when a caller opts in", () => {
    const boosted = { ...DEFAULT_STYLE, featureBoost: 0.5 };
    const tiny = deriveShading(20, 20, 40, boosted).featureEmphasis;
    const large = deriveShading(256, 256, 1400, boosted).featureEmphasis;
    expect(tiny).toBeGreaterThan(large);
    expect(large).toBeCloseTo(1, 5);
  });

  test("sculpted mode ramps in only above the mid sizes", () => {
    expect(deriveShading(48, 48, 100, DEFAULT_STYLE).sculptT).toBe(0);
    expect(deriveShading(96, 96, 300, DEFAULT_STYLE).sculptT).toBe(0);
    expect(deriveShading(176, 176, 600, DEFAULT_STYLE).sculptT).toBeCloseTo(0.5, 5);
    expect(deriveShading(256, 256, 1400, DEFAULT_STYLE).sculptT).toBe(1);
  });

  test("particle radius is independent of particle count", () => {
    // Regression guard. Deriving radius from spacing made sparse heads grow fat blobs: a 32px
    // head came out as a handful of 2px dots instead of a face. Radius must not react to count.
    const sparse = deriveShading(160, 160, 100, DEFAULT_STYLE).baseRadius;
    const dense = deriveShading(160, 160, 3000, DEFAULT_STYLE).baseRadius;
    expect(dense).toBe(sparse);
  });

  test("particle radius is identical across rendered sizes at the same DPR", () => {
    const small = deriveShading(24, 24, 100, DEFAULT_STYLE).baseRadius;
    const large = deriveShading(256, 256, 3000, DEFAULT_STYLE).baseRadius;
    expect(large).toBe(small);
  });

  test("particle radius tracks device pixel ratio, keeping apparent size constant", () => {
    const dpr1 = deriveShading(64, 64, 300, DEFAULT_STYLE).baseRadius;
    const dpr2 = deriveShading(64, 128, 300, DEFAULT_STYLE).baseRadius;
    expect(dpr2).toBeCloseTo(dpr1 * 2, 5);
  });

  test("count scales with area, so density stays constant as the head grows", () => {
    // Doubling the size quadruples the particle count: that is what carries the size difference
    // now that dot size is fixed. Checked below the cap so the ideal value is not clamped.
    const at32 = particleCountForSize(32, 100000);
    const at64 = particleCountForSize(64, 100000);
    const at128 = particleCountForSize(128, 100000);
    expect(at64 / at32).toBeCloseTo(4, 1);
    expect(at128 / at64).toBeCloseTo(4, 1);
  });

  test("count respects both the tier floor and the caller's budget", () => {
    expect(particleCountForSize(12, 100000)).toBeGreaterThanOrEqual(resolveTier(12).minParticles);
    expect(particleCountForSize(4000, 900)).toBe(900);
  });

  test("tiers partition the size range", () => {
    expect(resolveTier(20).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE + 1).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE + 1).name).toBe("display");
  });

  test("glyph tier suppresses lighting, display tier applies it fully", () => {
    // Shading detail reads as damage rather than form on a tiny head, so the small tier is
    // near-flat and legibility comes from dot placement alone.
    const small = deriveShading(24, 24, 100, DEFAULT_STYLE).lighting;
    const large = deriveShading(256, 256, 3000, DEFAULT_STYLE).lighting;
    expect(small).toBeLessThan(large * 0.5);
    expect(large).toBeCloseTo(DEFAULT_STYLE.lighting, 5);
  });

  test("particle radius never collapses below a visible floor", () => {
    const extreme = deriveShading(16, 16, 5000, {
      ...DEFAULT_STYLE,
      particleScale: 0.3,
    }).baseRadius;
    expect(extreme).toBeGreaterThanOrEqual(0.35);
  });
});
