import { CANONICAL_HEAD } from "./canonicalHead.js";
import { DEFAULT_HEAD_PARAMS, type HeadParams } from "./head.js";
import {
  DEFAULT_FEATURE_PARAMS,
  type FeatureParams,
  regionOfCell,
  weightOfCell,
} from "./landmarks.js";
import type { HeadPointSet } from "./pointset.js";
import { measureExtents, validatePointSet } from "./pointset.js";
import { REGION, REGION_COUNT } from "./regions.js";

/**
 * The baked human surface as size-specific levels of detail.
 *
 * One density cannot serve the whole size range. A point set dense enough to sculpt a 320px head
 * is sub-pixel noise at 24px, while a sparse inline face lacks real anatomy at display size. The
 * canonical data is ordered progressively. Display levels use its prefixes directly; tiny levels
 * reserve more samples from the same identity for landmarks that would otherwise disappear.
 *
 * Levels are decoded, scaled and tagged lazily: a page showing only inline heads never allocates
 * the full display surface.
 */
export interface GenerateOptions {
  head: HeadParams;
  features: FeatureParams;
  /** Nominal particles across the head. Higher is finer. */
  resolution: number;
}

/**
 * Available surface resolutions, spaced by roughly 1.4×.
 *
 * Close spacing limits how much the visible particle grain changes as the head is resized.
 */
export const LEVEL_RESOLUTIONS = [12, 17, 24, 34, 48, 68, 96, 136] as const;
const MAX_RESOLUTION = LEVEL_RESOLUTIONS[LEVEL_RESOLUTIONS.length - 1];

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  head: DEFAULT_HEAD_PARAMS,
  features: DEFAULT_FEATURE_PARAMS,
  resolution: 48,
};

interface OpticalFeatureQuota {
  eye: number;
  brow: number;
  nose: number;
  mouth: number;
}

/**
 * Tiny optical masters need deliberate landmark budgets. A raw progressive prefix at resolution
 * 17 contains only two points per eye, three for the mouth and no brows — valid geometry, but not
 * enough samples to communicate a human face after rasterisation.
 */
function opticalFeatureQuota(resolution: number): OpticalFeatureQuota | null {
  if (resolution <= 17) return { eye: 6, brow: 4, nose: 10, mouth: 8 };
  if (resolution <= 24) return { eye: 8, brow: 6, nose: 16, mouth: 12 };
  if (resolution <= 34) return { eye: 12, brow: 8, nose: 28, mouth: 18 };
  if (resolution <= 48) return { eye: 16, brow: 10, nose: 48, mouth: 28 };
  return null;
}

/**
 * Selects a landmark-balanced subset from the same canonical human surface.
 *
 * Candidate order is already farthest-point progressive, so taking the first candidates inside
 * each facial region spreads the reserved samples rather than clustering them. Remaining slots
 * come from the global progressive order, preserving the skull, jaw, ears, cheeks and neck.
 */
function selectOpticalIndices(
  count: number,
  resolution: number,
  head: HeadParams,
  features: FeatureParams,
): Int32Array | null {
  const quota = opticalFeatureQuota(resolution);
  if (!quota) return null;

  const remaining = new Int16Array(REGION_COUNT);
  remaining[REGION.eyeL] = quota.eye;
  remaining[REGION.eyeR] = quota.eye;
  remaining[REGION.browL] = quota.brow;
  remaining[REGION.browR] = quota.brow;
  remaining[REGION.nose] = quota.nose;
  remaining[REGION.mouth] = quota.mouth;

  const indices = new Int32Array(count);
  const selected = new Uint8Array(CANONICAL_HEAD.count);
  const scaleX = head.width / DEFAULT_HEAD_PARAMS.width;
  const scaleY = head.height / DEFAULT_HEAD_PARAMS.height;
  const scaleFront = head.frontDepth / DEFAULT_HEAD_PARAMS.frontDepth;
  const scaleBack = head.backDepth / DEFAULT_HEAD_PARAMS.backDepth;
  let selectedCount = 0;

  for (
    let sourceIndex = 0;
    sourceIndex < CANONICAL_HEAD.count && selectedCount < count;
    sourceIndex++
  ) {
    const offset = sourceIndex * 3;
    const sourceZ = CANONICAL_HEAD.positions[offset + 2];
    const x = CANONICAL_HEAD.positions[offset] * scaleX;
    const y = CANONICAL_HEAD.positions[offset + 1] * scaleY;
    const z = sourceZ * (sourceZ >= 0 ? scaleFront : scaleBack);
    const region = regionOfCell(x, y, z, head, features);
    if (remaining[region] <= 0) continue;
    indices[selectedCount++] = sourceIndex;
    selected[sourceIndex] = 1;
    remaining[region]--;
  }

  for (let sourceIndex = 0; selectedCount < count; sourceIndex++) {
    if (selected[sourceIndex] === 1) continue;
    indices[selectedCount++] = sourceIndex;
  }

  // Geometry uploads and deterministic tests are easier to reason about in canonical order.
  indices.sort();
  return indices;
}

/**
 * Builds one level by taking a progressive prefix, applying global proportions and tagging the
 * expression regions. Tiny levels substitute landmark-balanced optical subsets; every point still
 * comes from the same canonical human anatomy. Occlusion was baked against the complete surface.
 */
export function generateHeadLevel(options: Partial<GenerateOptions> = {}): HeadPointSet {
  const opts: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const resolution = Math.max(1, Math.round(opts.resolution));
  const count = Math.max(
    16,
    Math.min(
      CANONICAL_HEAD.count,
      Math.round(CANONICAL_HEAD.count * (resolution / MAX_RESOLUTION) ** 2),
    ),
  );
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regionId = new Uint8Array(count);
  const weight = new Float32Array(count);
  const occlusion = new Float32Array(count);
  const scaleX = opts.head.width / DEFAULT_HEAD_PARAMS.width;
  const scaleY = opts.head.height / DEFAULT_HEAD_PARAMS.height;
  const scaleFront = opts.head.frontDepth / DEFAULT_HEAD_PARAMS.frontDepth;
  const scaleBack = opts.head.backDepth / DEFAULT_HEAD_PARAMS.backDepth;
  const sourceIndices = selectOpticalIndices(count, resolution, opts.head, opts.features);

  for (let i = 0; i < count; i++) {
    const sourceIndex = sourceIndices?.[i] ?? i;
    const offset = i * 3;
    const sourceOffset = sourceIndex * 3;
    const sourceZ = CANONICAL_HEAD.positions[sourceOffset + 2];
    const scaleZ = sourceZ >= 0 ? scaleFront : scaleBack;
    const x = CANONICAL_HEAD.positions[sourceOffset] * scaleX;
    const y = CANONICAL_HEAD.positions[sourceOffset + 1] * scaleY;
    const z = sourceZ * scaleZ;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;

    const nx = CANONICAL_HEAD.normals[sourceOffset] / scaleX;
    const ny = CANONICAL_HEAD.normals[sourceOffset + 1] / scaleY;
    const nz = CANONICAL_HEAD.normals[sourceOffset + 2] / scaleZ;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    normals[offset] = nx / normalLength;
    normals[offset + 1] = ny / normalLength;
    normals[offset + 2] = nz / normalLength;

    const region = regionOfCell(x, y, z, opts.head, opts.features);
    regionId[i] = region;
    weight[i] = weightOfCell(x, y, region, opts.features);
    occlusion[i] = CANONICAL_HEAD.occlusion[sourceIndex];
  }

  const extents = measureExtents(positions, count);
  const set: HeadPointSet = {
    positions,
    normals,
    regionId,
    weight,
    occlusion,
    count,
    cellSize: (2 * extents.radius) / resolution,
    resolution,
    ...extents,
  };
  validatePointSet(set);
  return set;
}

/**
 * A lazily-built set of LOD levels sharing one set of head parameters.
 */
export class HeadModel {
  private readonly cache = new Map<number, HeadPointSet>();

  constructor(
    readonly head: HeadParams = DEFAULT_HEAD_PARAMS,
    readonly features: FeatureParams = DEFAULT_FEATURE_PARAMS,
  ) {}

  /** Builds (or returns) the level at the given resolution. */
  level(resolution: number): HeadPointSet {
    const cached = this.cache.get(resolution);
    if (cached) return cached;
    const built = generateHeadLevel({
      head: this.head,
      features: this.features,
      resolution,
    });
    this.cache.set(resolution, built);
    return built;
  }

  /**
   * Picks the level whose cells land closest to `targetCellPx` on screen, then builds it.
   *
   * `headPx` is the rendered size in device pixels. `minResolution` lets a visual tier preserve
   * the landmarks it needs even when pure pixel density would choose a coarser level.
   */
  levelForSize(headPx: number, targetCellPx = 3, minResolution = 0): HeadPointSet {
    // A future tier may ask for more than the standard ladder. Generation clamps safely to the
    // full baked surface while retaining the requested nominal spacing.
    let best: number = Math.max(MAX_RESOLUTION, minResolution);
    let bestError = Number.POSITIVE_INFINITY;
    for (const resolution of LEVEL_RESOLUTIONS) {
      if (resolution < minResolution) continue;
      const cellPx = headPx / resolution;
      // Compared in log space so being 2x too fine is penalised the same as 2x too coarse.
      const error = Math.abs(Math.log(cellPx / targetCellPx));
      if (error < bestError) {
        bestError = error;
        best = resolution;
      }
    }
    return this.level(best);
  }

  /** Resolutions already built, for diagnostics. */
  get builtLevels(): number[] {
    return [...this.cache.keys()].sort((a, b) => a - b);
  }
}
