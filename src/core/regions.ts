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
 * Per-region sampling priority. These divide a particle's elimination weight, so a higher
 * number means the region resists elimination and therefore lands earlier in the progressive
 * ordering.
 *
 * That ordering is the whole legibility mechanism: at 20px only the first ~56 particles are
 * drawn, and this table is what guarantees those are eyes, brows and mouth rather than an
 * evenly-spread fog with no face in it. Cranium and cheeks are cheap to lose because the
 * silhouette already implies them.
 */
export const REGION_PRIORITY: Record<RegionName, number> = {
  eyeL: 6,
  eyeR: 6,
  browL: 4,
  browR: 4,
  mouth: 3.5,
  jaw: 1.4,
  nose: 1.2,
  cheek: 0.8,
  cranium: 0.7,
};

/**
 * Per-region render intensity.
 *
 * Without this the head draws as a single-value silhouette: the skin surface and the feature
 * clusters are the same colour, so the eyes vanish into the cheeks and only the outline reads.
 * Dimming the structural surface and leaving features at full strength is what gives the face
 * internal structure — the same trick as a portrait lighting the eyes and letting the cheek fall
 * off. The rig will later modulate these per state.
 */
export const REGION_INTENSITY: Record<RegionName, number> = {
  eyeL: 1,
  eyeR: 1,
  browL: 0.95,
  browR: 0.95,
  mouth: 0.9,
  nose: 0.62,
  cheek: 0.48,
  jaw: 0.5,
  cranium: 0.44,
};

/** Regions that carry expression. Used by tests to assert small-size legibility. */
export const FEATURE_REGIONS: RegionName[] = ["browL", "browR", "eyeL", "eyeR", "mouth"];

const PRIORITY_BY_ID = new Float64Array(REGION_COUNT);
for (const name of REGION_NAMES) {
  PRIORITY_BY_ID[REGION[name]] = REGION_PRIORITY[name];
}

export function priorityOf(region: number): number {
  return PRIORITY_BY_ID[region] ?? 1;
}

const INTENSITY_BY_ID = new Float32Array(REGION_COUNT);
for (const name of REGION_NAMES) {
  INTENSITY_BY_ID[REGION[name]] = REGION_INTENSITY[name];
}

export function intensityOf(region: number): number {
  return INTENSITY_BY_ID[region] ?? 1;
}
