import type { RenderStyle } from "./types.js";

/**
 * The size-dependent rules, in one place.
 *
 * Both renderer backends read this, so the Canvas 2D fallback cannot silently look different
 * from the GPU path.
 *
 * The governing principle (Justin's direction, 2026-07-24): **a particle is always the same
 * size**. A bigger head is not bigger dots — it is *more* dots. An earlier version derived dot
 * radius from particle spacing, which inverted this: fewer particles meant a larger spacing
 * meant fatter dots, so a 32px head rendered as a handful of 2px blobs instead of a face. Dot
 * radius is now a fixed value in CSS pixels and the particle *count* carries the size.
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

/**
 * Particle radius in **CSS pixels**, identical at every rendered size. Multiplied by device
 * pixel ratio for the backing store, so a high-DPR screen gets a sharper dot of the same
 * apparent size rather than a bigger one.
 */
export const DOT_RADIUS_CSS = 1.05;

/**
 * Particles per CSS pixel squared of rendered size.
 *
 * Derived from the geometry rather than guessed: the head covers a disc of roughly 0.42·size in
 * radius, a dot covers pi·r², and about 60% areal coverage reads as a dense-but-distinct
 * stipple. Doubled because roughly half the point set is on the far hemisphere.
 */
export const PARTICLE_DENSITY = 0.18;

/**
 * Three design tiers rather than one continuously scaled design.
 *
 * A design legible at 64px is not the same design at 20px — the research notes said so and the
 * first continuous attempt proved it. Tiers keep the number of configurations that must actually
 * look good down to three, and each one is tuned on its own terms.
 *
 * Dot size and density are deliberately *not* tier properties: those stay constant so a head
 * never changes its grain. Tiers control only how much modelling detail the size can carry.
 */
export type TierName = "glyph" | "compact" | "display";

export interface SizeTier {
  name: TierName;
  /** Scales the caller's lighting. Shading detail becomes mud below ~40px. */
  lightingScale: number;
  /** Cull the far hemisphere outright — at glyph sizes it only stacks alpha and fills the face. */
  cullFarSide: boolean;
  /** How much of the camera's yaw/pitch to apply; a small head reads best near face-on. */
  poseScale: number;
  /** Floor on particle count, so the smallest heads still have enough dots to form a face. */
  minParticles: number;
}

const TIERS: SizeTier[] = [
  // Under ~40px there is no room for modelling: lighting and occlusion read as damage rather
  // than form, so the head is drawn nearly flat and legibility comes from dot placement alone.
  {
    name: "glyph",
    lightingScale: 0.22,
    cullFarSide: true,
    poseScale: 0,
    minParticles: 70,
  },
  {
    name: "compact",
    lightingScale: 0.62,
    cullFarSide: false,
    poseScale: 0.55,
    minParticles: 150,
  },
  {
    name: "display",
    lightingScale: 1,
    cullFarSide: false,
    poseScale: 1,
    minParticles: 400,
  },
];

export const GLYPH_MAX_SIZE = 40;
export const COMPACT_MAX_SIZE = 120;

export function resolveTier(cssSize: number): SizeTier {
  if (cssSize <= GLYPH_MAX_SIZE) return TIERS[0];
  if (cssSize <= COMPACT_MAX_SIZE) return TIERS[1];
  return TIERS[2];
}

/**
 * Particle count for a rendered size: proportional to area, because dot size is fixed and it is
 * the count that has to carry the size difference.
 */
export function particleCountForSize(
  cssSize: number,
  maxParticles: number,
  density = PARTICLE_DENSITY,
): number {
  const tier = resolveTier(cssSize);
  const ideal = Math.round(density * cssSize * cssSize);
  return Math.max(tier.minParticles, Math.min(maxParticles, ideal));
}

export interface DerivedShading {
  tier: SizeTier;
  /** Particle radius in device pixels — constant for a given size and DPR. */
  baseRadius: number;
  /** Draw-size multiplier for feature regions. 1 keeps every dot identical. */
  featureEmphasis: number;
  glyphMode: boolean;
  glyphSkinRadius: number;
  glyphSkinAlpha: number;
  /** 0 = region-coded brightness, 1 = uniform brightness modelled by light alone. */
  sculptT: number;
  /** Lighting strength after the tier's scaling. */
  lighting: number;
}

export function deriveShading(
  cssSize: number,
  devicePixels: number,
  _count: number,
  style: RenderStyle,
): DerivedShading {
  const tier = resolveTier(cssSize);
  const dpr = cssSize > 0 ? devicePixels / cssSize : 1;

  // Fixed radius. Note what this is *not*: derived from count or spacing. Tying it to spacing
  // makes sparse heads grow fat blobs, which is exactly the failure this replaced.
  const baseRadius = Math.max(0.35, DOT_RADIUS_CSS * dpr * style.particleScale);

  // Feature emphasis is now off by default: with a correct particle count the eyes read from
  // placement and density, and enlarging them breaks the identical-dot rule.
  const sizeT = Math.min(1, cssSize / 256);
  const featureEmphasis = 1 + style.featureBoost * (1 - sizeT);

  const glyphMode = tier.cullFarSide;

  // Above ~96px the head reads from shading rather than painted-on feature brightness.
  const sculptT = Math.min(1, Math.max(0, (cssSize - 96) / 160));

  return {
    tier,
    baseRadius,
    featureEmphasis,
    glyphMode,
    glyphSkinRadius: glyphMode ? 0.92 : 1,
    glyphSkinAlpha: glyphMode ? 0.72 : 1,
    sculptT,
    lighting: Math.max(0, Math.min(1, style.lighting)) * tier.lightingScale,
  };
}
