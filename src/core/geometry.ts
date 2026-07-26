import {
  DEFAULT_FEATURE_PARAMS,
  type FeatureParams,
  regionOfCell,
  weightOfCell,
} from "./landmarks.js";
import type { HeadPointSet } from "./pointset.js";
import { measureExtents, validatePointSet } from "./pointset.js";
import { DEFAULT_HEAD_PARAMS, type HeadParams, sdHead } from "./sdf.js";
import { voxelizeSurface } from "./voxel.js";

/**
 * Head geometry as a set of level-of-detail lattices.
 *
 * One resolution cannot serve the whole size range. A lattice fine enough to sculpt a 320px head
 * is sub-pixel noise at 24px, and a lattice coarse enough to read at 24px is a handful of blocks
 * at 320px. So the head is generated at several resolutions and the renderer picks the one whose
 * cells land at the target on-screen size — the standard "resolution where it counts" answer,
 * and what keeps particle size constant on screen while the head's pixel size varies.
 *
 * Levels are generated lazily and cached: a page showing only inline heads never pays to build
 * the display-tier lattice.
 */
export interface GenerateOptions {
  head: HeadParams;
  features: FeatureParams;
  /** Lattice cells across the domain. Higher is finer. */
  resolution: number;
}

/**
 * Available lattice resolutions, spaced by roughly 1.4×.
 *
 * Close spacing matters: the renderer sizes particles to tile their cell, so the gap between
 * neighbouring levels is the most a particle's on-screen size can drift. Wide steps would make
 * the grain visibly change as the head is resized.
 */
export const LEVEL_RESOLUTIONS = [12, 17, 24, 34, 48, 68, 96, 136] as const;

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  head: DEFAULT_HEAD_PARAMS,
  features: DEFAULT_FEATURE_PARAMS,
  resolution: 48,
};

/**
 * Builds one lattice level: voxelise, tag regions, bake occlusion.
 */
export function generateHeadLevel(options: Partial<GenerateOptions> = {}): HeadPointSet {
  const opts: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const lattice = voxelizeSurface(opts.head, opts.resolution);
  const { positions, normals, count, cellSize } = lattice;

  const regionId = new Uint8Array(count);
  const weight = new Float32Array(count);
  const occlusion = new Float32Array(count);

  // Occlusion probes scale with the cell so the shading reads the same at every resolution.
  // Fixed world-space radii would make a fine lattice look flat and a coarse one look sooty.
  const near = cellSize * 1.4;
  const far = cellSize * 3.6;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const region = regionOfCell(x, y, z, opts.head, opts.features);
    regionId[i] = region;
    weight[i] = weightOfCell(x, y, region, opts.features);

    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    // Two probes out along the normal. On open surface the distance grows with the step; inside
    // a concavity, nearby geometry folds over and the probe reads short.
    const dNear = sdHead(x + nx * near, y + ny * near, z + nz * near, opts.head) / near;
    const dFar = sdHead(x + nx * far, y + ny * far, z + nz * far, opts.head) / far;
    occlusion[i] = Math.max(0, Math.min(1, dNear)) * 0.55 + Math.max(0, Math.min(1, dFar)) * 0.45;
  }

  const set: HeadPointSet = {
    positions,
    normals,
    regionId,
    weight,
    occlusion,
    count,
    cellSize,
    resolution: opts.resolution,
    ...measureExtents(positions, count),
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
   * `headPx` is the rendered size in device pixels. A lattice spans the head's full domain, so
   * a cell projects to roughly `headPx / resolution` pixels. `minResolution` lets a visual tier
   * preserve the landmarks it needs even when pure pixel density would choose a coarser level.
   */
  levelForSize(headPx: number, targetCellPx = 3, minResolution = 0): HeadPointSet {
    // If a future tier asks for more than the baked ladder provides, generate that exact floor
    // instead of silently returning a level below the caller's legibility requirement.
    let best: number = Math.max(LEVEL_RESOLUTIONS[LEVEL_RESOLUTIONS.length - 1], minResolution);
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
