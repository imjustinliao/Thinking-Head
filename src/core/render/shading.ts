import type { RenderStyle } from "./types.js";

/**
 * The size-dependent rules, in one place.
 *
 * Both renderer backends read this, so the Canvas 2D fallback cannot silently look different
 * from the GPU path.
 *
 * The governing principle is optical level of detail: the baked surface is progressively ordered
 * with facial landmarks at its front, so small tiers use fewer, larger representative particles
 * and large tiers converge on the complete anatomical surface. Over-sampling a small canvas
 * averages thousands of subpixel particles into a pale mask.
 *
 * Earlier spacing-driven attempts failed because their sparse points were not a coherent,
 * landmark-preserving surface and their footprint did not follow optical framing. The current
 * progressive point set preserves facial configuration first, so its spacing can safely drive a
 * deliberate hierarchy of visible particle sizes.
 */

/** Upper-side portrait key. The raking angle separates the nose, orbital and cheek planes. */
export const KEY_LIGHT = { x: -0.5, y: 0.36, z: 0.78 } as const;
/** Near-frontal fill keeps the shadow side present without flattening the key direction. */
export const FILL_LIGHT = { x: 0.38, y: 0.08, z: 0.92 } as const;
export const FILL_STRENGTH = 0.1;

/**
 * Ambient floor, so unlit particles stay present rather than disappearing.
 *
 * Enough ambient preserves the shadow-side surface while leaving the orbital and nasal planes
 * distinctly darker than the key-facing cheek and brow.
 */
export const AMBIENT = 0.16;

/** Occlusion floor — fully enclosed particles keep this fraction of their light. */
export const OCCLUSION_FLOOR = 0.24;

/**
 * On-screen spacing, in CSS pixels, that neighbouring surface particles should occupy.
 */
export const TARGET_CELL_CSS = 1.6;

/**
 * Fraction of nominal spacing a particle fills. Slight overlap closes projection gaps across
 * curved facial planes while each anti-aliased circle remains individually legible.
 */
export const CELL_FILL = 1.15;

/**
 * Three design tiers rather than one continuously scaled design.
 *
 * A design legible at 64px is not the same design at 20px — the research notes said so and the
 * first continuous attempt proved it. Tiers keep the number of configurations that must actually
 * look good down to three, and each one is tuned on its own terms.
 *
 * Density, lighting, pose and feature footprint are tier properties because low-resolution face
 * perception depends on broad feature configuration, while large views can support the complete
 * sculptural signal.
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
  /** Minimum landmark-preserving surface resolution for this visual tier. */
  minResolution: number;
  /** Mixes feature material toward uniform white as real surface anatomy becomes legible. */
  albedoFlatten: number;
  /** Skin-particle coverage multiplier. */
  skinRadius: number;
  /** Feature-particle scale. Eye and mouth landmarks need a glyph-sized footprint. */
  featureScale: number;
}

const TIERS: SizeTier[] = [
  // The progressive prefix preserves both eyes and the mouth from resolution 17 upward.
  {
    name: "glyph",
    lightingScale: 0.42,
    cullFarSide: true,
    poseScale: 0,
    minResolution: 17,
    albedoFlatten: 0,
    skinRadius: 1,
    featureScale: 1.12,
  },
  {
    name: "compact",
    lightingScale: 0.62,
    cullFarSide: false,
    poseScale: 0.55,
    minResolution: 48,
    albedoFlatten: 0.25,
    skinRadius: 1,
    featureScale: 1.05,
  },
  {
    name: "display",
    lightingScale: 1,
    cullFarSide: false,
    poseScale: 1,
    minResolution: 96,
    albedoFlatten: 0.55,
    skinRadius: 1,
    featureScale: 1,
  },
];

export const GLYPH_MAX_SIZE = 64;
export const COMPACT_MAX_SIZE = 160;
export const FULL_SURFACE_SIZE = 48;
export const FULL_SURFACE_RESOLUTION = 136;

export function resolveTier(cssSize: number): SizeTier {
  if (cssSize <= GLYPH_MAX_SIZE) return TIERS[0];
  if (cssSize <= COMPACT_MAX_SIZE) return TIERS[1];
  return TIERS[2];
}

/**
 * Optical particle budget rather than one density blindly scaled down.
 *
 * Below 48px the progressive surface behaves like hand-drawn icon variants: fewer circles with
 * heavier visual weight and all key landmarks retained. At and above 48px the complete surface
 * preserves the sculpt Justin approved.
 */
export function minimumResolutionForSize(cssSize: number): number {
  if (cssSize >= FULL_SURFACE_SIZE) return FULL_SURFACE_RESOLUTION;
  const t = Math.max(0, Math.min(1, (cssSize - 16) / (FULL_SURFACE_SIZE - 16)));
  const optical = 17 + (FULL_SURFACE_RESOLUTION - 17) * t * t;
  return Math.max(resolveTier(cssSize).minResolution, Math.round(optical));
}

/**
 * Surface resolution for a rendered size, floored only enough to preserve its key landmarks.
 */
export function resolutionForSize(cssSize: number, targetCellCss = TARGET_CELL_CSS): number {
  return Math.max(minimumResolutionForSize(cssSize), Math.round(cssSize / targetCellCss));
}

export interface DerivedShading {
  tier: SizeTier;
  /** Particle radius in device pixels — constant for a given size and DPR. */
  baseRadius: number;
  /** Camera-fit multiplier that lets the face use the pixels available to each tier. */
  framingScale: number;
  /** Draw-size multiplier for feature regions. 1 keeps every dot identical. */
  featureEmphasis: number;
  glyphMode: boolean;
  /** Draw-size multiplier for non-feature skin particles. */
  skinRadius: number;
  /** Lighting strength after the tier's scaling. */
  lighting: number;
  /** Mix amount from region albedo to one neutral sculptural material. */
  albedoFlatten: number;
  /** Darkens broad facial landmarks only as much as their pixel budget requires. */
  featureAlbedoScale: number;
}

export function deriveShading(
  cssSize: number,
  devicePixels: number,
  cellSize: number,
  style: RenderStyle,
  worldRadius = 1,
): DerivedShading {
  const tier = resolveTier(cssSize);

  // Particle radius follows nominal surface spacing. Because the LOD chooser keeps that spacing
  // near a fixed on-screen size, this is constant in practice.
  const cellsAcross = worldRadius > 0 ? (2 * worldRadius) / Math.max(cellSize, 1e-6) : 1;
  const cellPx = devicePixels / Math.max(cellsAcross, 1);
  const sampledRadius = Math.max(0.35, cellPx * 0.5 * CELL_FILL * style.particleScale);

  // Feature footprint changes only at explicit size tiers; the optional public knob layers on
  // top and eases away as the full sculpt becomes large enough to carry itself.
  const sizeT = Math.min(1, cssSize / 256);
  const featureEmphasis = tier.featureScale + style.featureBoost * (1 - sizeT);

  const glyphMode = tier.cullFarSide;
  const glyphRoom = 1 - Math.min(1, cssSize / GLYPH_MAX_SIZE);
  const glyphZoom = 1.2 + 3.1 * glyphRoom ** 4;
  const framingScale = tier.name === "glyph" ? glyphZoom : tier.name === "compact" ? 1.18 : 1.25;
  const featureAlbedoScale = tier.name === "glyph" ? 0.68 - 0.38 * glyphRoom ** 2 : 1;
  // Optical glyph framing magnifies particle positions. Their footprint must follow that zoom or
  // a correct progressive prefix opens into a disconnected constellation.
  const baseRadius = sampledRadius * (cssSize < FULL_SURFACE_SIZE ? framingScale : 1);

  return {
    tier,
    baseRadius,
    framingScale,
    featureEmphasis,
    glyphMode,
    skinRadius: tier.skinRadius,
    lighting: Math.max(0, Math.min(1, style.lighting)) * tier.lightingScale,
    albedoFlatten: tier.albedoFlatten,
    featureAlbedoScale,
  };
}

/** Contrast curve that keeps highlights fixed while separating midtones and recesses. */
export function sculptShade(linearShade: number): number {
  const clamped = Math.max(0, Math.min(1, linearShade));
  return clamped * (0.5 + 0.5 * clamped);
}

/**
 * Depth attenuation across the head's actual front-to-back span.
 *
 * The nearest surface must remain fully bright. The previous perspective-distance ratio started
 * the front plane halfway through the fade, dimming the face before its light and occlusion were
 * evaluated. Normalising against the bound radius maps front → 0, centre → 0.5 and back → 1.
 */
export function depthFadeOf(viewZ: number, radius: number, depthDim: number): number {
  if (radius <= 0) return 1;
  const depthT = Math.max(0, Math.min(1, (radius - viewZ) / (2 * radius)));
  return 1 - Math.max(0, Math.min(1, depthDim)) * depthT;
}
