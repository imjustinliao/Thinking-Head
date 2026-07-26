/**
 * Development and tooling surface — **not** part of the package's public API and deliberately
 * absent from `package.json` exports.
 *
 * The geometry generator lives here rather than in `index.ts` because the published package will
 * ship a baked point set, not the generator: baking keeps the generation cost and its code out of
 * consumers' bundles, and the runtime consumes a point set either way, which is what keeps Phase 2
 * compatible. Because `index.ts` never reaches this module, the library build cannot pull it into
 * `dist`.
 *
 * The demo imports from here so its tuning panel drives the real generator live, and the future
 * bake script will use the same entry.
 */

export { clockState, clockTime, resetClock, subscribeToClock } from "./core/clock.js";
export {
  DEFAULT_GENERATE_OPTIONS,
  type GenerateOptions,
  generateHeadLevel,
  HeadModel,
  LEVEL_RESOLUTIONS,
} from "./core/geometry.js";
export {
  DEFAULT_FEATURE_PARAMS,
  type FeatureParams,
} from "./core/landmarks.js";
export {
  EXECUTING_MOTION,
  GENERATING_MOTION,
  IDLE_MOTION,
  LISTENING_MOTION,
  type MotionParams,
  normalDisplacement,
  READING_MOTION,
  REVIEWING_MOTION,
  SEARCHING_MOTION,
  STATE_MOTION,
  STILL_MOTION,
  shimmerMultiplier,
  swayOffsets,
  THINKING_MOTION,
} from "./core/motion.js";
export type { HeadPointSet } from "./core/pointset.js";
export { validatePointSet } from "./core/pointset.js";
export {
  REGION,
  REGION_NAMES,
  type RegionName,
} from "./core/regions.js";
export { createCanvas2DRenderer } from "./core/render/canvas2d.js";
export {
  type CreatedRenderer,
  createRenderer,
  detectBackend,
  type RenderBackend,
} from "./core/render/createRenderer.js";
export {
  CELL_FILL,
  COMPACT_MAX_SIZE,
  GLYPH_MAX_SIZE,
  resolutionForSize,
  resolveTier,
  type SizeTier,
  TARGET_CELL_CSS,
  type TierName,
} from "./core/render/shading.js";
export {
  type Camera,
  DEFAULT_CAMERA,
  DEFAULT_STYLE,
  type HeadRenderer,
  type ParticleShape,
  type RenderFrame,
  type RenderStyle,
} from "./core/render/types.js";
export {
  DEFAULT_HEAD_PARAMS,
  type HeadParams,
} from "./core/sdf.js";
export { type VoxelLattice, voxelizeSurface } from "./core/voxel.js";
