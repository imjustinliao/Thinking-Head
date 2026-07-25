import { DEFAULT_FEATURE_PARAMS, type FeatureParams, generateLandmarks } from "./landmarks.js";
import { mulberry32 } from "./math.js";
import type { HeadPointSet } from "./pointset.js";
import { measureExtents, validatePointSet } from "./pointset.js";
import {
  approximateSurfaceArea,
  eliminateProgressive,
  radiusForTarget,
  type SurfaceCloud,
  sampleSurface,
} from "./sample.js";
import { DEFAULT_HEAD_PARAMS, type HeadParams } from "./sdf.js";

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
  candidates: 12000,
  maxParticles: 1400,
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

export function generateHead(options: Partial<GenerateOptions> = {}): HeadPointSet {
  const opts: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const rng = mulberry32(opts.seed);

  const surface = sampleSurface(opts.head, opts.candidates, rng);
  const features = generateLandmarks(opts.head, opts.features, rng);
  const { cloud, weight } = mergeClouds(surface, features);

  const surfaceArea = approximateSurfaceArea(opts.head);
  const order = eliminateProgressive(cloud, {
    target: Math.min(opts.maxParticles, cloud.count),
    radius: radiusForTarget(surfaceArea, opts.maxParticles),
    surfaceArea,
    rimBoost: opts.rimBoost,
  });

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

  const set: HeadPointSet = {
    positions,
    normals,
    regionId,
    weight: outWeight,
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
  minParticles = 44,
): number {
  // Superlinear, so small sizes sit near the floor. Strict area scaling (exponent 2) would leave a
  // 20px head with under a dozen particles; this keeps dots getting chunkier as the head shrinks,
  // which is the whole reason a 64px design is not the same design at 20px.
  const t = Math.min(1, Math.max(0, (pixelSize - 16) / (256 - 16)));
  const eased = t ** 1.6;
  return Math.round(minParticles + eased * (maxParticles - minParticles));
}
