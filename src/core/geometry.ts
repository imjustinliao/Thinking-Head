import { DEFAULT_FEATURE_PARAMS, type FeatureParams, generateLandmarks } from "./landmarks.js";
import { mulberry32 } from "./math.js";
import type { HeadPointSet } from "./pointset.js";
import { measureExtents, validatePointSet } from "./pointset.js";
import { REGION, type RegionId } from "./regions.js";
import {
  approximateSurfaceArea,
  eliminateProgressive,
  radiusForTarget,
  type SurfaceCloud,
  sampleSurface,
} from "./sample.js";
import { DEFAULT_HEAD_PARAMS, type HeadParams, sdHead } from "./sdf.js";

/**
 * Full geometry generation: SDF -> surface cloud -> explicit features -> progressive blue-noise
 * ordering -> tagged point set.
 *
 * This runs at build time to bake the shipped point set, and at runtime in the demo so the
 * tuning sliders are live. It is deliberately absent from the package's public entry, so the
 * library build never pulls the generator into `dist`.
 */
export interface GenerateOptions {
  head: HeadParams;
  features: FeatureParams;
  /** Bounding-box samples drawn before shell rejection. Governs cloud quality and cost. */
  candidates: number;
  /** Size of the returned ordering — the maximum particle count the runtime can draw. */
  maxParticles: number;
  /** Silhouette emphasis during elimination. */
  rimBoost: number;
  seed: number;
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  head: DEFAULT_HEAD_PARAMS,
  features: DEFAULT_FEATURE_PARAMS,
  candidates: 15000,
  maxParticles: 1800,
  rimBoost: 1.1,
  seed: 20260724,
};

/** Concatenates the explicit feature clusters onto the sampled surface cloud. */
function mergeClouds(
  surface: SurfaceCloud,
  features: ReturnType<typeof generateLandmarks>,
): { cloud: SurfaceCloud; weight: Float32Array } {
  const count = surface.count + features.count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regionId = new Uint8Array(count);
  const weight = new Float32Array(count);

  positions.set(surface.positions, 0);
  normals.set(surface.normals, 0);
  regionId.set(surface.regionId, 0);
  // Structural particles sit at their region core by definition; features carry a real falloff.
  weight.fill(1, 0, surface.count);

  positions.set(features.positions, surface.count * 3);
  normals.set(features.normals, surface.count * 3);
  regionId.set(features.regionId, surface.count);
  weight.set(features.weight, surface.count);

  return { cloud: { positions, normals, regionId, count }, weight };
}

/**
 * Feature placement in the ordering is tiered, mirroring how faces are actually drawn at tiny
 * sizes (an emoji face is two dots and a mouth stroke):
 *
 * - **Tier A** opens the ordering: one core dot per eye and two mouth dots. This is the whole
 *   face a ~36-particle 20px head can afford — promoting more features at that count fuses them
 *   into a single blob, which is worse than no features at all.
 * - **Tier B** lands at position ~40: second eye dots, brows, more mouth, the nose tip. By the
 *   counts where these draw (≥ ~32px) there is room between features again.
 *
 * Weights alone cannot deliver either guarantee — eye dots sit so close together that their
 * mutual crowding weight outvotes any region priority — so this is enforced structurally.
 * Prefixes remain nested, so the progressive-separation property survives.
 */
const TIER_A: [RegionId, number][] = [
  [REGION.eyeL, 1],
  [REGION.eyeR, 1],
  [REGION.mouth, 2],
];

const TIER_B: [RegionId, number][] = [
  [REGION.eyeL, 2],
  [REGION.eyeR, 2],
  [REGION.browL, 2],
  [REGION.browR, 2],
  [REGION.mouth, 2],
  [REGION.nose, 1],
];

/** Ordering position where tier B begins. Chosen so the 36-particle glyph face stays sparse. */
const TIER_B_AT = 40;

function promoteFeatureTiers(
  order: Int32Array,
  regionId: Uint8Array,
  weight: Float32Array,
): Int32Array {
  const taken = new Set<number>();

  // Within a region, the highest-weight particles are the cluster cores (weight is the falloff
  // toward the feature centre) — exactly the dots a one-dot eye should be.
  const takeTop = (region: RegionId, k: number): number[] => {
    const candidates: number[] = [];
    for (const idx of order) {
      if (regionId[idx] === region && !taken.has(idx)) candidates.push(idx);
    }
    candidates.sort((a, b) => weight[b] - weight[a]);
    const picked = candidates.slice(0, k);
    for (const idx of picked) taken.add(idx);
    return picked;
  };

  const tierA = TIER_A.flatMap(([region, k]) => takeTop(region, k));
  const tierB = TIER_B.flatMap(([region, k]) => takeTop(region, k));

  const rest: number[] = [];
  for (const idx of order) {
    if (!taken.has(idx)) rest.push(idx);
  }

  const merged = new Int32Array(order.length);
  let cursor = 0;
  for (const idx of tierA) merged[cursor++] = idx;
  const structureBeforeB = Math.max(0, Math.min(TIER_B_AT - tierA.length, rest.length));
  for (let i = 0; i < structureBeforeB; i++) merged[cursor++] = rest[i];
  for (const idx of tierB) merged[cursor++] = idx;
  for (let i = structureBeforeB; i < rest.length; i++) merged[cursor++] = rest[i];
  return merged;
}

export function generateHead(options: Partial<GenerateOptions> = {}): HeadPointSet {
  const opts: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const rng = mulberry32(opts.seed);

  const surface = sampleSurface(opts.head, opts.candidates, rng);
  const features = generateLandmarks(opts.head, opts.features, rng);
  const { cloud, weight } = mergeClouds(surface, features);

  const surfaceArea = approximateSurfaceArea(opts.head);
  const order = promoteFeatureTiers(
    eliminateProgressive(cloud, {
      target: Math.min(opts.maxParticles, cloud.count),
      radius: radiusForTarget(surfaceArea, opts.maxParticles),
      surfaceArea,
      rimBoost: opts.rimBoost,
    }),
    cloud.regionId,
    weight,
  );

  const count = Math.min(opts.maxParticles, cloud.count);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regionId = new Uint8Array(count);
  const outWeight = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const src = order[i];
    positions[i * 3] = cloud.positions[src * 3];
    positions[i * 3 + 1] = cloud.positions[src * 3 + 1];
    positions[i * 3 + 2] = cloud.positions[src * 3 + 2];
    normals[i * 3] = cloud.normals[src * 3];
    normals[i * 3 + 1] = cloud.normals[src * 3 + 1];
    normals[i * 3 + 2] = cloud.normals[src * 3 + 2];
    regionId[i] = cloud.regionId[src];
    outWeight[i] = weight[src];
  }

  // Baked occlusion: probe the field a short and a longer step out along each normal. On open
  // surface the distance grows with the step; inside a concavity nearby geometry folds over and
  // the probe reads short. Two taps are enough at particle scale, and it runs at generation
  // time so the renderer pays nothing.
  // Tap radii sized to the features being shaded (sockets ~0.17): larger far taps let every
  // concavity darken half the face into murk.
  const occlusion = new Float32Array(count);
  const near = 0.055;
  const far = 0.13;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const dNear = sdHead(x + nx * near, y + ny * near, z + nz * near, opts.head) / near;
    const dFar = sdHead(x + nx * far, y + ny * far, z + nz * far, opts.head) / far;
    const open = Math.max(0, Math.min(1, dNear)) * 0.6 + Math.max(0, Math.min(1, dFar)) * 0.4;
    occlusion[i] = open;
  }

  const set: HeadPointSet = {
    positions,
    normals,
    regionId,
    weight: outWeight,
    occlusion,
    count,
    ...measureExtents(positions, count),
  };
  validatePointSet(set);
  return set;
}

/**
 * Particle count for a rendered size. A design legible at 64px is not the same design at 20px,
 * so density is a function of pixel size rather than a constant — and because the ordering is
 * progressive, honouring it costs nothing but a smaller draw count.
 */
export function particleCountForSize(
  pixelSize: number,
  maxParticles: number,
  minParticles = 36,
): number {
  // Superlinear, so small sizes sit near the floor. Strict area scaling (exponent 2) would leave a
  // 20px head with under a dozen particles; this keeps dots getting chunkier as the head shrinks,
  // which is the whole reason a 64px design is not the same design at 20px.
  const t = Math.min(1, Math.max(0, (pixelSize - 16) / (256 - 16)));
  const eased = t ** 1.6;
  return Math.round(minParticles + eased * (maxParticles - minParticles));
}
