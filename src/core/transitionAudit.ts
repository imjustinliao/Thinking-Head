import { EXPRESSION_KEYS, STATE_EXPRESSION } from "./expression.js";
import { MOTION_KEYS, STATE_MOTION } from "./motion.js";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "./states.js";
import { StateTransitionController } from "./transition.js";

const VALUE_EPSILON = 1e-9;
const ENDPOINT_EPSILON = 1e-4;
const MIN_DIRECTION_MAGNITUDE = 0.2;

export interface TransitionAuditOptions {
  fps?: number;
  duration?: number;
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
  finite: boolean;
  passed: boolean;
}

function safeFps(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(240, Math.round(value ?? 60))) : 60;
}

function safeDuration(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0.1, Math.min(5, value ?? 0.8)) : 0.8;
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
  const frameCount = Math.floor(duration * fps) + 1;
  const controller = new StateTransitionController(from, 0);
  if (to !== from) controller.setTargetState(to, 0);

  let startDiscontinuity = 0;
  let endpointError = 0;
  let maxNormalizedStep = 0;
  let overshootCount = 0;
  let minimumDirectionMagnitude = Number.POSITIVE_INFINITY;
  let finite = true;
  let settledAt: number | null = from === to ? 0 : null;
  const previousMotion = new Float64Array(MOTION_KEYS.length);
  const previousExpression = new Float64Array(EXPRESSION_KEYS.length);

  for (let frame = 0; frame < frameCount; frame++) {
    const time = frame / fps;
    const sample = controller.advance(time);
    if (settledAt === null && sample.settled) settledAt = time;

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
    endpointError <= ENDPOINT_EPSILON &&
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
    finite,
    passed,
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
