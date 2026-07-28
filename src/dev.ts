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
  createExpressionRigMetrics,
  deformExpressionPoint,
  EXPRESSION_KEYS,
  type ExpressionKey,
  type ExpressionParams,
  type ExpressionRigMetrics,
  expressionRigOf,
  IDLE_EXPRESSION,
  LISTENING_EXPRESSION,
  measureExpressionRig,
  NEUTRAL_EXPRESSION,
  READING_EXPRESSION,
  STATE_EXPRESSION,
} from "./core/expression.js";
export {
  DEFAULT_GENERATE_OPTIONS,
  type GenerateOptions,
  generateHeadLevel,
  HeadModel,
  LEVEL_RESOLUTIONS,
} from "./core/geometry.js";
export {
  DEFAULT_HEAD_PARAMS,
  type HeadParams,
} from "./core/head.js";
export {
  DEFAULT_FEATURE_PARAMS,
  type FeatureParams,
} from "./core/landmarks.js";
export {
  createMotionPhase,
  DONE_MOTION,
  ERROR_MOTION,
  EXECUTING_MOTION,
  GENERATING_MOTION,
  IDLE_MOTION,
  LISTENING_MOTION,
  MOTION_KEYS,
  type MotionKey,
  type MotionParams,
  type MotionPhase,
  normalDisplacement,
  READING_MOTION,
  REVIEWING_MOTION,
  SEARCHING_MOTION,
  STATE_MOTION,
  STILL_MOTION,
  type SwayOffsets,
  shimmerMultiplier,
  swayOffsets,
  swayOffsetsInto,
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
  FULL_SURFACE_RESOLUTION,
  FULL_SURFACE_SIZE,
  GLYPH_MAX_SIZE,
  minimumResolutionForSize,
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
  DEFAULT_TRANSITION_RESPONSE,
  DONE_HOLD_SECONDS,
  STATE_TRANSITION_RESPONSE,
  StateTransitionController,
  type StateTransitionSample,
} from "./core/transition.js";
export {
  auditAllStateTransitions,
  auditStateTransition,
  MAX_NORMALIZED_FRAME_STEP,
  type TransitionAuditOptions,
  type TransitionAuditResult,
} from "./core/transitionAudit.js";
