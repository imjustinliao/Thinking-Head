import type { RenderStyle } from "./types.js";

/**
 * The size-dependent shading rules, in one place.
 *
 * These constants and curves are the result of tuning the head's legibility across the whole
 * 20–256px range, and both renderer backends must apply them identically — a WebGL path that
 * drifted from the tuned Canvas 2D path would mean the fallback silently looked different from
 * the real thing. Deriving them here rather than in each backend makes that drift impossible.
 */

/** Fixed key light in view space: upper-front-left, the default portrait key. */
export const KEY_LIGHT = { x: -0.42, y: 0.55, z: 0.72 } as const;

/** Ambient floor, so unlit particles stay present rather than disappearing. */
export const AMBIENT = 0.28;

/** Occlusion floor — fully enclosed particles keep this fraction of their light. */
export const OCCLUSION_FLOOR = 0.4;

/** Uniform brightness that sculpted mode fades region coding toward. */
export const SCULPT_UNIFORM_ALPHA = 0.82;

/** Features only fade this far toward uniform, so eyes never vanish into the sculpt. */
export const FEATURE_FLATTEN_RATIO = 0.55;

/** At or below this rendered size the head is drawn as a glyph rather than a volume. */
export const GLYPH_MAX_SIZE = 32;

export interface DerivedShading {
  /** Particle radius in device pixels before per-region scaling. */
  baseRadius: number;
  /** Draw-size multiplier applied to feature regions. */
  featureEmphasis: number;
  /** Glyph mode culls the far hemisphere outright and recedes the skin. */
  glyphMode: boolean;
  glyphSkinRadius: number;
  glyphSkinAlpha: number;
  /** 0 = region-coded brightness, 1 = uniform brightness modelled by light alone. */
  sculptT: number;
}

export function deriveShading(
  cssSize: number,
  devicePixels: number,
  count: number,
  style: RenderStyle,
): DerivedShading {
  // Radius follows particle *spacing*, not canvas size alone: blue-noise points over a projected
  // disc sit roughly `diameter / sqrt(n)` apart. A size-only radius makes dense heads overlap
  // into one solid silhouette. 0.26 leaves visible gaps — at 0.3 a 20px head fuses solid,
  // because the head disc covers only ~70% of the canvas so true spacing is tighter than this
  // canvas-based estimate.
  const spacing = devicePixels / Math.sqrt(Math.max(8, count));
  const baseRadius = Math.max(0.35, spacing * 0.26 * style.particleScale);

  // Feature emphasis grows as the head shrinks — the favicon principle. Without it the eye
  // clusters merge with the skull at inline sizes and the face dissolves into even noise.
  const sizeT = Math.min(1, cssSize / 256);
  const featureEmphasis = 1 + style.featureBoost * (1 - sizeT);

  const glyphMode = cssSize <= GLYPH_MAX_SIZE;

  // Above ~96px the head reads from shading rather than from painted-on feature brightness,
  // the way a real head does. Cartoon-bright eye dots on a large sculpted head fight the form.
  const sculptT = Math.min(1, Math.max(0, (cssSize - 96) / 160));

  return {
    baseRadius,
    featureEmphasis,
    glyphMode,
    glyphSkinRadius: glyphMode ? 0.8 : 1,
    glyphSkinAlpha: glyphMode ? 0.58 : 1,
    sculptT,
  };
}
