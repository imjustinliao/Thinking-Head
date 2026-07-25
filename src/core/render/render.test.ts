import { describe, expect, test } from "vitest";
import { detectBackend } from "./createRenderer.js";
import { deriveShading, GLYPH_MAX_SIZE } from "./shading.js";
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

  test("feature emphasis decreases as the head grows", () => {
    const tiny = deriveShading(20, 20, 40, DEFAULT_STYLE).featureEmphasis;
    const mid = deriveShading(64, 64, 150, DEFAULT_STYLE).featureEmphasis;
    const large = deriveShading(256, 256, 1400, DEFAULT_STYLE).featureEmphasis;
    expect(tiny).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(large);
    expect(large).toBeCloseTo(1, 5);
  });

  test("sculpted mode ramps in only above the mid sizes", () => {
    expect(deriveShading(48, 48, 100, DEFAULT_STYLE).sculptT).toBe(0);
    expect(deriveShading(96, 96, 300, DEFAULT_STYLE).sculptT).toBe(0);
    expect(deriveShading(176, 176, 600, DEFAULT_STYLE).sculptT).toBeCloseTo(0.5, 5);
    expect(deriveShading(256, 256, 1400, DEFAULT_STYLE).sculptT).toBe(1);
  });

  test("particle radius shrinks as density rises at a fixed size", () => {
    const sparse = deriveShading(160, 160, 100, DEFAULT_STYLE).baseRadius;
    const dense = deriveShading(160, 160, 1400, DEFAULT_STYLE).baseRadius;
    expect(dense).toBeLessThan(sparse);
  });

  test("particle radius never collapses below a visible floor", () => {
    const extreme = deriveShading(16, 16, 5000, {
      ...DEFAULT_STYLE,
      particleScale: 0.3,
    }).baseRadius;
    expect(extreme).toBeGreaterThanOrEqual(0.35);
  });
});
