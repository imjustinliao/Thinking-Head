import type { RenderStyle } from "./types.js";

/**
 * The size-dependent rules, in one place.
 *
 * Both renderer backends read this, so the Canvas 2D fallback cannot silently look different
 * from the GPU path.
 *
 * The governing principle (Justin's direction, 2026-07-24): **a particle is always the same
 * size**. A bigger head is not bigger particles — it is *more* particles. The LOD chooser keeps
 * nominal surface spacing near a fixed on-screen size, so growing the head selects a denser
 * prefix rather than inflating what is already there.
 *
 * Two earlier models failed this. Deriving radius from particle *spacing* inverted it outright —
 * fewer particles meant fatter ones, so a 32px head rendered as a handful of blobs. A fixed CSS
 * radius over a poorly distributed procedural cloud fixed the size but left the face as
 * unstructured stipple. The current points are sampled from coherent human anatomy.
 */

/** Broad upper-front portrait key. A shallow side angle preserves both eye and nose planes. */
export const KEY_LIGHT = { x: -0.26, y: 0.42, z: 0.87 } as const;
/** Opposing frontal fill, weaker than the key so form remains directional rather than flat. */
export const FILL_LIGHT = { x: 0.46, y: 0.18, z: 0.87 } as const;
export const FILL_STRENGTH = 0.28;

/**
 * Ambient floor, so unlit particles stay present rather than disappearing.
 *
 * A moderate fill preserves points on planes turned away from the key. The earlier 0.1 value
 * turned valid mid-face samples into apparent holes rather than readable shadow.
 */
export const AMBIENT = 0.2;

/** Occlusion floor — fully enclosed particles keep this fraction of their light. */
export const OCCLUSION_FLOOR = 0.3;

/**
 * On-screen spacing, in CSS pixels, that neighbouring surface particles should occupy. The LOD
 * level is chosen to land near this, which holds particle size stable while the head grows.
 */
export const TARGET_CELL_CSS = 1.6;

/**
 * Fraction of nominal spacing a particle fills. Slightly under 1 keeps the human surface
 * visibly particulate; at 1.0 nearby tiles fuse into a solid mask.
 */
export const CELL_FILL = 0.9;

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
  /** Minimum surface resolution, so the smallest heads still resolve a face. */
  minResolution: number;
  /** Mixes feature material toward uniform white as real surface anatomy becomes legible. */
  albedoFlatten: number;
}

const TIERS: SizeTier[] = [
  // Under ~40px there is no room for modelling: lighting and occlusion read as damage rather
  // than form, so the head is drawn nearly flat and legibility comes from dot placement alone.
  {
    name: "glyph",
    lightingScale: 0.22,
    cullFarSide: true,
    poseScale: 0,
    minResolution: 14,
    albedoFlatten: 0,
  },
  {
    name: "compact",
    lightingScale: 0.62,
    cullFarSide: false,
    poseScale: 0.55,
    minResolution: 26,
    albedoFlatten: 0.45,
  },
  {
    name: "display",
    lightingScale: 1,
    cullFarSide: false,
    poseScale: 1,
    minResolution: 44,
    albedoFlatten: 0.82,
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
 * Surface resolution for a rendered size: enough points that spacing lands near TARGET_CELL_CSS,
 * floored by the tier so a tiny head still resolves eyes and a mouth.
 */
export function resolutionForSize(cssSize: number, targetCellCss = TARGET_CELL_CSS): number {
  const tier = resolveTier(cssSize);
  return Math.max(tier.minResolution, Math.round(cssSize / targetCellCss));
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
  /** Lighting strength after the tier's scaling. */
  lighting: number;
  /** Mix amount from region albedo to one neutral sculptural material. */
  albedoFlatten: number;
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
  const baseRadius = Math.max(0.35, cellPx * 0.5 * CELL_FILL * style.particleScale);

  // Feature emphasis is now off by default: with a correct particle count the eyes read from
  // placement and density, and enlarging them breaks the identical-dot rule.
  const sizeT = Math.min(1, cssSize / 256);
  const featureEmphasis = 1 + style.featureBoost * (1 - sizeT);

  const glyphMode = tier.cullFarSide;

  return {
    tier,
    baseRadius,
    featureEmphasis,
    glyphMode,
    glyphSkinRadius: glyphMode ? 0.92 : 1,
    glyphSkinAlpha: glyphMode ? 0.72 : 1,
    lighting: Math.max(0, Math.min(1, style.lighting)) * tier.lightingScale,
    albedoFlatten: tier.albedoFlatten,
  };
}
