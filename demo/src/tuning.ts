import {
  type Camera,
  DEFAULT_CAMERA,
  DEFAULT_FEATURE_PARAMS,
  DEFAULT_HEAD_PARAMS,
  DEFAULT_STYLE,
  type ExpressionParams,
  type FeatureParams,
  type HeadParams,
  TARGET_CELL_CSS,
} from "thinking-head/dev";

/**
 * Every knob on the head, in one object. The standing requirement is that shape, density, size
 * and speed are all live-tunable in the demo, so the panel is generated from these schemas
 * rather than hand-written per control.
 */
export interface SamplingConfig {
  /** On-screen particle spacing in CSS px. Lower is finer. */
  targetCellCss: number;
}

export interface StyleConfig {
  particleScale: number;
  backfaceDim: number;
  depthDim: number;
  featureBoost: number;
  lighting: number;
}

export interface TuningConfig {
  head: HeadParams;
  features: FeatureParams;
  sampling: SamplingConfig;
  camera: Camera;
  style: StyleConfig;
}

export const DEFAULT_TUNING: TuningConfig = {
  head: { ...DEFAULT_HEAD_PARAMS },
  features: { ...DEFAULT_FEATURE_PARAMS },
  sampling: { targetCellCss: TARGET_CELL_CSS },
  camera: { ...DEFAULT_CAMERA },
  style: {
    particleScale: DEFAULT_STYLE.particleScale,
    backfaceDim: DEFAULT_STYLE.backfaceDim,
    depthDim: DEFAULT_STYLE.depthDim,
    featureBoost: DEFAULT_STYLE.featureBoost,
    lighting: DEFAULT_STYLE.lighting,
  },
};

/**
 * The number-valued string keys of `T`. Interfaces have no index signature, so a
 * `Record<string, number>` constraint would reject `HeadParams` outright; this keeps the panel
 * generic and still checks that a field name really exists on the config it edits.
 */
export type NumericKey<T> = Extract<
  { [K in keyof T]: T[K] extends number ? K : never }[keyof T],
  string
>;

export interface Field<T> {
  key: NumericKey<T>;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const HEAD_FIELDS: Field<HeadParams>[] = [
  { key: "width", label: "head width", min: 0.4, max: 0.8, step: 0.005 },
  { key: "height", label: "head height", min: 0.6, max: 1, step: 0.005 },
  { key: "frontDepth", label: "facial depth", min: 0.35, max: 0.75, step: 0.005 },
  { key: "backDepth", label: "cranial depth", min: 0.45, max: 0.9, step: 0.005 },
];

export const FEATURE_FIELDS: Field<FeatureParams>[] = [
  { key: "eyeSpread", label: "eye spread", min: 0.1, max: 0.45, step: 0.005 },
  { key: "eyeHeight", label: "eye height", min: -0.3, max: 0.3, step: 0.005 },
  { key: "eyeRadius", label: "eye radius", min: 0.03, max: 0.22, step: 0.005 },
  { key: "browHeight", label: "brow height", min: -0.05, max: 0.4, step: 0.005 },
  { key: "browWidth", label: "brow width", min: 0.04, max: 0.3, step: 0.005 },
  { key: "browArc", label: "brow arc", min: -0.08, max: 0.12, step: 0.005 },
  { key: "browThickness", label: "brow thickness", min: 0.01, max: 0.1, step: 0.005 },
  { key: "mouthHeight", label: "mouth height", min: -0.6, max: -0.05, step: 0.005 },
  { key: "mouthWidth", label: "mouth width", min: 0.04, max: 0.35, step: 0.005 },
  { key: "mouthCurve", label: "mouth curve", min: -0.1, max: 0.12, step: 0.005 },
  { key: "mouthThickness", label: "mouth thickness", min: 0.01, max: 0.1, step: 0.005 },
  { key: "faceDepth", label: "face depth", min: -0.2, max: 0.4, step: 0.01 },
];

export const SAMPLING_FIELDS: Field<SamplingConfig>[] = [
  { key: "targetCellCss", label: "particle spacing (px)", min: 1, max: 5, step: 0.1 },
];

export const CAMERA_FIELDS: Field<Camera>[] = [
  { key: "yaw", label: "yaw", min: -1.2, max: 1.2, step: 0.01 },
  { key: "pitch", label: "pitch", min: -0.8, max: 0.8, step: 0.01 },
  { key: "distance", label: "distance", min: 1.8, max: 8, step: 0.05 },
  { key: "fov", label: "field of view", min: 0.25, max: 1.4, step: 0.01 },
];

export const STYLE_FIELDS: Field<StyleConfig>[] = [
  { key: "particleScale", label: "particle size", min: 0.3, max: 3, step: 0.02 },
  { key: "backfaceDim", label: "backface dim", min: 0, max: 1, step: 0.02 },
  { key: "depthDim", label: "depth dim", min: 0, max: 1, step: 0.02 },
  { key: "featureBoost", label: "feature emphasis", min: 0, max: 1.5, step: 0.05 },
  { key: "lighting", label: "key light", min: 0, max: 1, step: 0.02 },
];

export const BROW_EXPRESSION_FIELDS: Field<ExpressionParams>[] = [
  { key: "brow_raiseL", label: "left raise", min: -1, max: 1, step: 0.05 },
  { key: "brow_raiseR", label: "right raise", min: -1, max: 1, step: 0.05 },
  { key: "brow_innerUp", label: "inner lift", min: -1, max: 1, step: 0.05 },
  { key: "brow_furrow", label: "furrow", min: 0, max: 1, step: 0.05 },
];

export const EYE_EXPRESSION_FIELDS: Field<ExpressionParams>[] = [
  { key: "eye_openL", label: "left open", min: -1, max: 1, step: 0.05 },
  { key: "eye_openR", label: "right open", min: -1, max: 1, step: 0.05 },
  { key: "eye_gazeX", label: "gaze horizontal", min: -1, max: 1, step: 0.05 },
  { key: "eye_gazeY", label: "gaze vertical", min: -1, max: 1, step: 0.05 },
];

export const MIDFACE_EXPRESSION_FIELDS: Field<ExpressionParams>[] = [
  { key: "cheek_raise", label: "cheek raise", min: 0, max: 1, step: 0.05 },
  { key: "nose_scrunch", label: "nose scrunch", min: 0, max: 1, step: 0.05 },
];

export const MOUTH_EXPRESSION_FIELDS: Field<ExpressionParams>[] = [
  { key: "mouth_cornerUpL", label: "left corner", min: -1, max: 1, step: 0.05 },
  { key: "mouth_cornerUpR", label: "right corner", min: -1, max: 1, step: 0.05 },
  { key: "mouth_open", label: "mouth open", min: 0, max: 1, step: 0.05 },
  { key: "mouth_pucker", label: "pucker", min: 0, max: 1, step: 0.05 },
  { key: "mouth_press", label: "press", min: 0, max: 1, step: 0.05 },
];

export const JAW_EXPRESSION_FIELDS: Field<ExpressionParams>[] = [
  { key: "jaw_open", label: "jaw open", min: 0, max: 1, step: 0.05 },
  { key: "jaw_shiftX", label: "jaw shift", min: -1, max: 1, step: 0.05 },
  { key: "jaw_forward", label: "jaw forward", min: -1, max: 1, step: 0.05 },
];
