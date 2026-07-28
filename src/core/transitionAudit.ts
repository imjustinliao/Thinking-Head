import { ACCENT_KEYS, STATE_ACCENT } from "./accent.js";
import {
  animateExpressionInto,
  createExpressionParams,
  EXPRESSION_KEYS,
  STATE_EXPRESSION,
} from "./expression.js";
import { MOTION_KEYS, STATE_MOTION } from "./motion.js";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "./states.js";
import { StateTransitionController } from "./transition.js";

const VALUE_EPSILON = 1e-9;
const ENDPOINT_EPSILON = 1e-4;
const MIN_DIRECTION_MAGNITUDE = 0.2;
export const MAX_NORMALIZED_FRAME_STEP = 0.22;
export const MAX_FACIAL_FRAME_STEP = 0.32;

export interface TransitionAuditOptions {
  fps?: number;
  duration?: number;
  startTime?: number;
}

export interface TransitionAuditResult {
  from: ThinkingHeadState;
  to: ThinkingHeadState;
  frameCount: number;
  settledAt: number | null;
  startDiscontinuity: number;
  endpointError: number;
  maxNormalizedStep: number;
  overshootCount: number;
  minimumDirectionMagnitude: number;
  facialStartDiscontinuity: number;
  maxFacialFrameStep: number;
  finite: boolean;
  passed: boolean;
}

function safeFps(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(240, Math.round(value ?? 60))) : 60;
}

function safeDuration(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0.1, Math.min(5, value ?? 0.8)) : 0.8;
}

function safeStartTime(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 37.25) : 37.25;
}

/**
 * Samples one named-state transition at a fixed cadence and returns machine-checkable continuity
 * evidence. This is development tooling only; it never enters the published runtime bundle.
 */
export function auditStateTransition(
  from: ThinkingHeadState,
  to: ThinkingHeadState,
  options: TransitionAuditOptions = {},
): TransitionAuditResult {
  const fps = safeFps(options.fps);
  const duration = safeDuration(options.duration);
  const startTime = safeStartTime(options.startTime);
  const frameCount = Math.floor(duration * fps) + 1;
  const controller = new StateTransitionController(from, startTime);
  if (to !== from) controller.setTargetState(to, startTime);

  let startDiscontinuity = 0;
  let endpointError = 0;
  let maxNormalizedStep = 0;
  let overshootCount = 0;
  let minimumDirectionMagnitude = Number.POSITIVE_INFINITY;
  let facialStartDiscontinuity = 0;
  let maxFacialFrameStep = 0;
  let finite = true;
  let settledAt: number | null = from === to ? 0 : null;
  const previousMotion = new Float64Array(MOTION_KEYS.length);
  const previousExpression = new Float64Array(EXPRESSION_KEYS.length);
  const previousAccent = new Float64Array(ACCENT_KEYS.length);
  const effectiveExpression = createExpressionParams();
  const previousEffectiveExpression = new Float64Array(EXPRESSION_KEYS.length);
  const sourceEffectiveExpression = createExpressionParams();
  animateExpressionInto(
    sourceEffectiveExpression,
    controller.sample.expression,
    startTime,
    controller.sample.motion,
    controller.sample.phase,
  );

  for (let frame = 0; frame < frameCount; frame++) {
    const time = startTime + frame / fps;
    const sample = controller.advance(time);
    animateExpressionInto(
      effectiveExpression,
      sample.expression,
      time,
      sample.motion,
      sample.phase,
    );
    if (settledAt === null && sample.settled) settledAt = time - startTime;

    for (let index = 0; index < MOTION_KEYS.length; index++) {
      const key = MOTION_KEYS[index];
      const value = sample.motion[key];
      const source = STATE_MOTION[from][key];
      const target = STATE_MOTION[to][key];
      finite &&= Number.isFinite(value);
      if (frame === 0) {
        startDiscontinuity = Math.max(startDiscontinuity, Math.abs(value - source));
      } else {
        const span = Math.abs(target - source);
        if (span > VALUE_EPSILON) {
          maxNormalizedStep = Math.max(
            maxNormalizedStep,
            Math.abs(value - previousMotion[index]) / span,
          );
          const minimum = Math.min(source, target) - VALUE_EPSILON;
          const maximum = Math.max(source, target) + VALUE_EPSILON;
          if (value < minimum || value > maximum) overshootCount++;
        }
      }
      previousMotion[index] = value;
      if (frame === frameCount - 1)
        endpointError = Math.max(endpointError, Math.abs(value - target));
    }

    for (let index = 0; index < EXPRESSION_KEYS.length; index++) {
      const key = EXPRESSION_KEYS[index];
      const value = sample.expression[key];
      const source = STATE_EXPRESSION[from][key];
      const target = STATE_EXPRESSION[to][key];
      finite &&= Number.isFinite(value);
      if (frame === 0) {
        startDiscontinuity = Math.max(startDiscontinuity, Math.abs(value - source));
      } else {
        const span = Math.abs(target - source);
        if (span > VALUE_EPSILON) {
          maxNormalizedStep = Math.max(
            maxNormalizedStep,
            Math.abs(value - previousExpression[index]) / span,
          );
          const minimum = Math.min(source, target) - VALUE_EPSILON;
          const maximum = Math.max(source, target) + VALUE_EPSILON;
          if (value < minimum || value > maximum) overshootCount++;
        }
      }
      previousExpression[index] = value;
      if (frame === frameCount - 1)
        endpointError = Math.max(endpointError, Math.abs(value - target));

      const effective = effectiveExpression[key];
      finite &&= Number.isFinite(effective);
      if (frame === 0) {
        facialStartDiscontinuity = Math.max(
          facialStartDiscontinuity,
          Math.abs(effective - sourceEffectiveExpression[key]),
        );
      } else {
        maxFacialFrameStep = Math.max(
          maxFacialFrameStep,
          Math.abs(effective - previousEffectiveExpression[index]),
        );
      }
      previousEffectiveExpression[index] = effective;
    }

    for (let index = 0; index < ACCENT_KEYS.length; index++) {
      const key = ACCENT_KEYS[index];
      const value = sample.accent[key];
      const source = STATE_ACCENT[from][key];
      const target = STATE_ACCENT[to][key];
      finite &&= Number.isFinite(value);
      if (frame === 0) {
        startDiscontinuity = Math.max(startDiscontinuity, Math.abs(value - source));
      } else {
        const span = Math.abs(target - source);
        if (span > VALUE_EPSILON) {
          maxNormalizedStep = Math.max(
            maxNormalizedStep,
            Math.abs(value - previousAccent[index]) / span,
          );
          const minimum = Math.min(source, target) - VALUE_EPSILON;
          const maximum = Math.max(source, target) + VALUE_EPSILON;
          if (value < minimum || value > maximum) overshootCount++;
        }
      }
      previousAccent[index] = value;
      if (frame === frameCount - 1)
        endpointError = Math.max(endpointError, Math.abs(value - target));
    }

    for (const phase of Object.values(sample.phase)) finite &&= Number.isFinite(phase);
    const directionMagnitude = Math.hypot(
      sample.motion.shimmerDirX,
      sample.motion.shimmerDirY,
      sample.motion.shimmerDirZ,
    );
    minimumDirectionMagnitude = Math.min(minimumDirectionMagnitude, directionMagnitude);
  }

  const passed =
    finite &&
    startDiscontinuity <= VALUE_EPSILON &&
    facialStartDiscontinuity <= VALUE_EPSILON &&
    endpointError <= ENDPOINT_EPSILON &&
    maxNormalizedStep <= MAX_NORMALIZED_FRAME_STEP &&
    maxFacialFrameStep <= MAX_FACIAL_FRAME_STEP &&
    overshootCount === 0 &&
    minimumDirectionMagnitude >= MIN_DIRECTION_MAGNITUDE &&
    settledAt !== null;

  return {
    from,
    to,
    frameCount,
    settledAt,
    startDiscontinuity,
    endpointError,
    maxNormalizedStep,
    overshootCount,
    minimumDirectionMagnitude,
    facialStartDiscontinuity,
    maxFacialFrameStep,
    finite,
    passed,
  };
}

export interface HeldFacialAuditResult {
  state: ThinkingHeadState;
  frameCount: number;
  upperFaceRange: number;
  lowerFaceRange: number;
  maxControlRange: number;
  finite: boolean;
  passed: boolean;
}

const UPPER_FACE_KEYS = [
  "brow_raiseL",
  "brow_raiseR",
  "brow_innerUp",
  "brow_furrow",
  "eye_openL",
  "eye_openR",
  "eye_gazeX",
  "eye_gazeY",
] as const;

const LOWER_FACE_KEYS = [
  "cheek_raise",
  "nose_scrunch",
  "mouth_cornerUpL",
  "mouth_cornerUpR",
  "mouth_open",
  "mouth_pucker",
  "mouth_press",
  "jaw_open",
  "jaw_shiftX",
  "jaw_forward",
] as const;

/** Proves that a settled semantic state keeps animating its face rather than only its head. */
export function auditHeldFacialState(
  state: ThinkingHeadState,
  options: TransitionAuditOptions = {},
): HeldFacialAuditResult {
  const fps = safeFps(options.fps);
  const duration = Math.max(3, safeDuration(options.duration));
  const startTime = safeStartTime(options.startTime);
  const frameCount = Math.floor(duration * fps) + 1;
  const controller = new StateTransitionController(state, startTime, 1, {
    autoReturnDone: false,
  });
  const effective = createExpressionParams();
  const minima = new Float64Array(EXPRESSION_KEYS.length);
  const maxima = new Float64Array(EXPRESSION_KEYS.length);
  minima.fill(Number.POSITIVE_INFINITY);
  maxima.fill(Number.NEGATIVE_INFINITY);
  let finite = true;

  for (let frame = 0; frame < frameCount; frame++) {
    const time = startTime + frame / fps;
    const sample = controller.advance(time);
    animateExpressionInto(effective, sample.expression, time, sample.motion, sample.phase);
    for (let index = 0; index < EXPRESSION_KEYS.length; index++) {
      const value = effective[EXPRESSION_KEYS[index]];
      finite &&= Number.isFinite(value);
      minima[index] = Math.min(minima[index], value);
      maxima[index] = Math.max(maxima[index], value);
    }
  }

  let upperFaceRange = 0;
  let lowerFaceRange = 0;
  let maxControlRange = 0;
  for (let index = 0; index < EXPRESSION_KEYS.length; index++) {
    const key = EXPRESSION_KEYS[index];
    const range = maxima[index] - minima[index];
    maxControlRange = Math.max(maxControlRange, range);
    if ((UPPER_FACE_KEYS as readonly string[]).includes(key)) {
      upperFaceRange = Math.max(upperFaceRange, range);
    }
    if ((LOWER_FACE_KEYS as readonly string[]).includes(key)) {
      lowerFaceRange = Math.max(lowerFaceRange, range);
    }
  }

  return {
    state,
    frameCount,
    upperFaceRange,
    lowerFaceRange,
    maxControlRange,
    finite,
    passed: finite && maxControlRange >= 0.02,
  };
}

export interface FacialRetargetEvent {
  at: number;
  state: ThinkingHeadState;
}

export interface FacialRetargetAuditResult {
  frameCount: number;
  eventDiscontinuity: number;
  maxFacialFrameStep: number;
  finite: boolean;
  passed: boolean;
}

/**
 * Replays timestamped state events and audits the effective animated face at every 60fps frame.
 * Events may land between frames; presentation and integrated phase are sampled at the exact
 * event time before retargeting, matching real unpredictable product state changes.
 */
export function auditFacialRetargetSequence(
  initialState: ThinkingHeadState,
  events: readonly FacialRetargetEvent[],
  options: TransitionAuditOptions = {},
): FacialRetargetAuditResult {
  const fps = safeFps(options.fps);
  const duration = safeDuration(options.duration);
  const startTime = safeStartTime(options.startTime);
  const frameCount = Math.floor(duration * fps) + 1;
  const controller = new StateTransitionController(initialState, startTime);
  const effective = createExpressionParams();
  const beforeEvent = createExpressionParams();
  const previous = new Float64Array(EXPRESSION_KEYS.length);
  let eventIndex = 0;
  let eventDiscontinuity = 0;
  let maxFacialFrameStep = 0;
  let finite = true;

  for (let frame = 0; frame < frameCount; frame++) {
    const elapsed = frame / fps;
    while (eventIndex < events.length && events[eventIndex].at <= elapsed) {
      const event = events[eventIndex];
      const eventTime = startTime + event.at;
      const before = controller.advance(eventTime);
      animateExpressionInto(beforeEvent, before.expression, eventTime, before.motion, before.phase);
      const after = controller.setTargetState(event.state, eventTime);
      animateExpressionInto(effective, after.expression, eventTime, after.motion, after.phase);
      for (const key of EXPRESSION_KEYS) {
        eventDiscontinuity = Math.max(
          eventDiscontinuity,
          Math.abs(effective[key] - beforeEvent[key]),
        );
      }
      eventIndex++;
    }

    const time = startTime + elapsed;
    const sample = controller.advance(time);
    animateExpressionInto(effective, sample.expression, time, sample.motion, sample.phase);
    for (let index = 0; index < EXPRESSION_KEYS.length; index++) {
      const value = effective[EXPRESSION_KEYS[index]];
      finite &&= Number.isFinite(value);
      if (frame > 0) {
        maxFacialFrameStep = Math.max(maxFacialFrameStep, Math.abs(value - previous[index]));
      }
      previous[index] = value;
    }
  }

  return {
    frameCount,
    eventDiscontinuity,
    maxFacialFrameStep,
    finite,
    passed:
      finite && eventDiscontinuity <= VALUE_EPSILON && maxFacialFrameStep <= MAX_FACIAL_FRAME_STEP,
  };
}

export function auditAllStateTransitions(
  options: TransitionAuditOptions = {},
): TransitionAuditResult[] {
  const results: TransitionAuditResult[] = [];
  for (const from of THINKING_HEAD_STATES) {
    for (const to of THINKING_HEAD_STATES) {
      if (from === to) continue;
      results.push(auditStateTransition(from, to, options));
    }
  }
  return results;
}
