import { describe, expect, test } from "vitest";
import { cameraBasis } from "./camera.js";
import { detectBackend } from "./createRenderer.js";
import {
  CELL_FILL,
  COMPACT_MAX_SIZE,
  depthFadeOf,
  deriveShading,
  FULL_SURFACE_RESOLUTION,
  GLYPH_MAX_SIZE,
  minimumResolutionForSize,
  resolutionForSize,
  resolveTier,
  sculptShade,
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

  test("tier floors preserve landmarks without over-sampling small canvases", () => {
    expect(resolveTier(16).minResolution).toBe(17);
    expect(resolveTier(96).minResolution).toBe(48);
    expect(resolveTier(320).minResolution).toBe(96);
  });

  test("optical LOD grows through dedicated small variants then preserves the full sculpt", () => {
    expect(minimumResolutionForSize(16)).toBe(17);
    expect(minimumResolutionForSize(24)).toBe(24);
    expect(minimumResolutionForSize(32)).toBe(34);
    expect(minimumResolutionForSize(48)).toBe(48);
    expect(minimumResolutionForSize(64)).toBe(68);
    expect(minimumResolutionForSize(80)).toBe(96);
    expect(minimumResolutionForSize(96)).toBe(FULL_SURFACE_RESOLUTION);
    expect(minimumResolutionForSize(320)).toBe(FULL_SURFACE_RESOLUTION);
  });

  test("feature footprint steps down as real facial anatomy gains enough pixels", () => {
    const glyph = deriveShading(32, 64, 0.1, DEFAULT_STYLE, 1);
    const compact = deriveShading(96, 192, 0.05, DEFAULT_STYLE, 1);
    const display = deriveShading(320, 640, 0.02, DEFAULT_STYLE, 1);
    expect(glyph.featureEmphasis).toBeGreaterThan(compact.featureEmphasis);
    expect(compact.featureEmphasis).toBeGreaterThan(display.featureEmphasis);
    expect(display.featureEmphasis).toBe(1);
  });

  test("framing allocates more of a tiny canvas to the face", () => {
    const at16 = deriveShading(16, 32, 0.02, DEFAULT_STYLE, 1).framingScale;
    const at48 = deriveShading(48, 96, 0.02, DEFAULT_STYLE, 1).framingScale;
    const display = deriveShading(320, 640, 0.02, DEFAULT_STYLE, 1).framingScale;
    expect(at16).toBeGreaterThan(at48);
    expect(at48).toBeGreaterThan(1);
    expect(display).toBeGreaterThan(1);
  });

  test("optical framing also magnifies sub-96px particle footprints", () => {
    const glyph = deriveShading(16, 16, 2 / 17, DEFAULT_STYLE, 1);
    const sampledRadius = (16 / 17) * 0.5 * CELL_FILL;
    expect(glyph.baseRadius).toBeCloseTo(sampledRadius * glyph.framingScale, 4);

    const full = deriveShading(96, 96, 2 / 136, DEFAULT_STYLE, 1);
    const fullSampledRadius = Math.max(0.35, (96 / 136) * 0.5 * CELL_FILL);
    expect(full.baseRadius).toBeCloseTo(fullSampledRadius, 4);
  });

  test("glyph landmarks retain stronger contrast only where the pixel budget needs it", () => {
    const at16 = deriveShading(16, 32, 0.02, DEFAULT_STYLE, 1).featureAlbedoScale;
    const at48 = deriveShading(48, 96, 0.02, DEFAULT_STYLE, 1).featureAlbedoScale;
    const display = deriveShading(320, 640, 0.02, DEFAULT_STYLE, 1).featureAlbedoScale;
    expect(at16).toBeLessThan(at48);
    expect(at48).toBeLessThan(display);
    expect(display).toBe(1);
  });

  test("feature emphasis still responds to the knob when a caller opts in", () => {
    const boosted = { ...DEFAULT_STYLE, featureBoost: 0.5 };
    const tiny = deriveShading(20, 20, 0.05, boosted, 1).featureEmphasis;
    const tinyDefault = deriveShading(20, 20, 0.05, DEFAULT_STYLE, 1).featureEmphasis;
    const large = deriveShading(256, 256, 0.05, boosted, 1).featureEmphasis;
    expect(tiny).toBeGreaterThan(tinyDefault);
    expect(large).toBeCloseTo(1, 5);
  });

  test("particle size holds constant once the complete sculpt has enough pixels", () => {
    // Surface spacing gets finer in proportion to the head, keeping pixel size stable. Optical
    // masters below 96px intentionally carry a slightly heavier footprint.
    const small = deriveShading(96, 96, 2 / 60, DEFAULT_STYLE, 1).baseRadius;
    const large = deriveShading(256, 256, 2 / 160, DEFAULT_STYLE, 1).baseRadius;
    expect(large / small).toBeCloseTo(1, 1);
  });

  test("particles overlap their cell slightly to close curved-surface projection gaps", () => {
    // Cell projects to 4 device px. A small overlap prevents holes between projected facial
    // planes while the circular silhouettes still expose the particle structure.
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

  test("surface resolution scales below 96px and stays complete above it", () => {
    const at16 = resolutionForSize(16, 2);
    const at24 = resolutionForSize(24, 2);
    const at32 = resolutionForSize(32, 2);
    const at48 = resolutionForSize(48, 2);
    const at64 = resolutionForSize(64, 2);
    const at80 = resolutionForSize(80, 2);
    const at96 = resolutionForSize(96, 2);
    expect(at16).toBeLessThan(at24);
    expect(at24).toBeLessThan(at32);
    expect(at32).toBeLessThan(at48);
    expect(at48).toBeLessThan(at64);
    expect(at64).toBeLessThan(at80);
    expect(at80).toBeLessThan(at96);
    expect(resolutionForSize(256, 2)).toBe(FULL_SURFACE_RESOLUTION);
  });

  test("glyph optical masters enlarge landmarks without runaway crop", () => {
    const at16 = deriveShading(16, 32, 2 / 17, DEFAULT_STYLE, 1);
    const at48 = deriveShading(48, 96, 2 / 48, DEFAULT_STYLE, 1);
    const at64 = deriveShading(64, 128, 2 / 68, DEFAULT_STYLE, 1);
    expect(at16.framingScale).toBeLessThanOrEqual(1.25);
    expect(at16.framingScale).toBeGreaterThan(at48.framingScale);
    expect(at16.featureEmphasis).toBeGreaterThan(at48.featureEmphasis);
    expect(at48.featureEmphasis).toBeGreaterThan(at64.featureEmphasis);
    expect(at16.featureAlbedoScale).toBeLessThan(at48.featureAlbedoScale);
    expect(at48.featureAlbedoScale).toBeLessThan(at64.featureAlbedoScale);
  });

  test("resolution respects the tier floor so tiny heads still resolve a face", () => {
    expect(resolutionForSize(12)).toBeGreaterThanOrEqual(resolveTier(12).minResolution);
    expect(resolutionForSize(300)).toBeGreaterThanOrEqual(resolveTier(300).minResolution);
  });

  test("the default medium is made from circular particles", () => {
    expect(DEFAULT_STYLE.shape).toBe("disc");
  });

  test("tiers partition the size range", () => {
    expect(resolveTier(20).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE).name).toBe("glyph");
    expect(resolveTier(GLYPH_MAX_SIZE + 1).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE).name).toBe("compact");
    expect(resolveTier(COMPACT_MAX_SIZE + 1).name).toBe("display");
    expect(resolveTier(48).name).toBe("glyph");
    expect(resolveTier(96).name).toBe("compact");
    expect(resolveTier(320).name).toBe("display");
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

  test("sculpt contrast preserves highlights and deepens facial midtones", () => {
    expect(sculptShade(1)).toBe(1);
    expect(sculptShade(0.5)).toBeLessThan(0.5);
    expect(sculptShade(0)).toBe(0);
    expect(sculptShade(-1)).toBe(0);
    expect(sculptShade(2)).toBe(1);
  });
});
