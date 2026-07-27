/**
 * Facial region tags carried per particle. These are the handles the expression rig will
 * address — a state says "raise the brows, narrow the eyes", and that resolves to region
 * lookups, never to individual particle indices.
 *
 * Left and right are separate ids on purpose: asymmetric expressions (a wink, one raised
 * brow for scepticism) are a large part of reading as a character rather than an effect, and
 * a merged `eye` region would foreclose them.
 *
 * Ids are stable and stored in a Uint8Array. Append new regions, never renumber — a baked
 * point set on disk depends on these values.
 */
export const REGION = {
  cranium: 0,
  jaw: 1,
  cheek: 2,
  nose: 3,
  browL: 4,
  browR: 5,
  eyeL: 6,
  eyeR: 7,
  mouth: 8,
} as const;

export type RegionName = keyof typeof REGION;
export type RegionId = (typeof REGION)[RegionName];

export const REGION_NAMES = Object.keys(REGION) as RegionName[];

export const REGION_COUNT = REGION_NAMES.length;

/**
 * Per-region albedo — how reflective the material is, not how bright to paint it.
 *
 * Features are *darker* than skin, which is how a real face works: eyes sit in shadowed sockets,
 * brows are hair, lips are a recessed line. An earlier version had this inverted, painting
 * features at full brightness against dimmed skin, which was the only way to make eyes visible
 * back when they were a handful of scattered dots with no geometry behind them. With carved
 * sockets and baked occlusion doing that job, painting eyes bright fights the sculpt — it shows
 * up as glaring white patches where the sockets should be reading dark.
 *
 * The rig will modulate these per state.
 */
export const REGION_INTENSITY: Record<RegionName, number> = {
  eyeL: 0.5,
  eyeR: 0.5,
  browL: 0.62,
  browR: 0.62,
  mouth: 0.66,
  nose: 1,
  cheek: 1,
  jaw: 1,
  cranium: 1,
};

/**
 * Per-region draw-radius multiplier. Features render as slightly larger dots than the skin
 * surface, and the renderer scales this further as the head shrinks — the same move a favicon
 * makes: at small sizes the features must be proportionally bigger or the face dissolves into
 * even noise. Structure dots shrink a touch to make room.
 */
export const REGION_DRAW_SCALE: Record<RegionName, number> = {
  // All 1: every particle is the same size, everywhere. Scaling feature dots up was a crutch for
  // an under-populated head — with a correct particle count the features read from placement and
  // density instead, and varying dot size just makes the grain look inconsistent. Kept as a table
  // because the expression rig may want to drive it per state later.
  eyeL: 1,
  eyeR: 1,
  browL: 1,
  browR: 1,
  mouth: 1,
  nose: 1,
  cheek: 1,
  jaw: 1,
  cranium: 1,
};

/** Regions that carry expression. Used by tests to assert small-size legibility. */
export const FEATURE_REGIONS: RegionName[] = ["browL", "browR", "eyeL", "eyeR", "mouth"];

const INTENSITY_BY_ID = new Float32Array(REGION_COUNT);
for (const name of REGION_NAMES) {
  INTENSITY_BY_ID[REGION[name]] = REGION_INTENSITY[name];
}

export function intensityOf(region: number): number {
  return INTENSITY_BY_ID[region] ?? 1;
}

const DRAW_SCALE_BY_ID = new Float32Array(REGION_COUNT);
for (const name of REGION_NAMES) {
  DRAW_SCALE_BY_ID[REGION[name]] = REGION_DRAW_SCALE[name];
}

export function drawScaleOf(region: number): number {
  return DRAW_SCALE_BY_ID[region] ?? 1;
}

const FEATURE_MASK = new Uint8Array(REGION_COUNT);
for (const name of FEATURE_REGIONS) {
  FEATURE_MASK[REGION[name]] = 1;
}

/**
 * True for the expressive regions (eyes, brows, mouth). The renderer culls these outright when
 * they face away from the camera: a far-side eye showing through the skull reads as a smudge
 * stuck to the silhouette, and dimming alone does not kill it.
 */
export function isFeatureRegion(region: number): boolean {
  return FEATURE_MASK[region] === 1;
}
