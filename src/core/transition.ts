import { ACCENT_KEYS, STATE_ACCENT, type StateAccent } from "./accent.js";
import { EXPRESSION_KEYS, type ExpressionParams, STATE_EXPRESSION } from "./expression.js";
import {
  createMotionPhase,
  MOTION_KEYS,
  type MotionParams,
  type MotionPhase,
  STATE_MOTION,
} from "./motion.js";
import type { ThinkingHeadState } from "./states.js";

export const DEFAULT_TRANSITION_RESPONSE = 0.28;
export const DONE_HOLD_SECONDS = 0.9;

/**
 * Response is semantic rather than distance-based: urgent states arrive quickly, while a
 * completion is allowed a calmer release. These are spring response values, not fixed durations.
 */
export const STATE_TRANSITION_RESPONSE: Record<ThinkingHeadState, number> = {
  idle: 0.28,
  listening: 0.24,
  reading: 0.26,
  thinking: 0.3,
  searching: 0.22,
  executing: 0.2,
  generating: 0.26,
  reviewing: 0.26,
  error: 0.18,
  done: 0.34,
};

export interface StateTransitionSample {
  /** Stable object identity; values are updated in place. */
  motion: Readonly<MotionParams>;
  /** Stable object identity; values are updated in place. */
  expression: Readonly<ExpressionParams>;
  /** Integrated phases keep every oscillator continuous while its speed changes. */
  phase: Readonly<MotionPhase>;
  /** Stable semantic colour channels; renderers blend these without parsing CSS per frame. */
  accent: Readonly<StateAccent>;
  /** State most recently requested by the consumer. */
  requestedState: ThinkingHeadState;
  /** Current spring target. Becomes Idle after Done's completion hold. */
  targetState: ThinkingHeadState;
  /** True only when every scalar is resting exactly on the current target. */
  settled: boolean;
}

export interface StateTransitionControllerOptions {
  /** Disable only for static state studies that must hold Done as a permanent endpoint. */
  autoReturnDone?: boolean;
}

const POSITION_EPSILON = 1e-4;
const VELOCITY_EPSILON = 1e-3;
const TAU = Math.PI * 2;

const BREATH_SPEED_INDEX = MOTION_KEYS.indexOf("breathSpeed");
const WAVE_SPEED_INDEX = MOTION_KEYS.indexOf("waveSpeed");
const JITTER_SPEED_INDEX = MOTION_KEYS.indexOf("jitterSpeed");
const SHIMMER_SPEED_INDEX = MOTION_KEYS.indexOf("shimmerSpeed");
const SWAY_SPEED_INDEX = MOTION_KEYS.indexOf("swaySpeed");
const DART_SPEED_INDEX = MOTION_KEYS.indexOf("swayDartSpeed");
const FACIAL_SPEED_INDEX = MOTION_KEYS.indexOf("facialSpeed");
const BLINK_SPEED_INDEX = MOTION_KEYS.indexOf("blinkSpeed");

function springOmega(response: number): number {
  const safeResponse =
    Number.isFinite(response) && response > 0 ? response : DEFAULT_TRANSITION_RESPONSE;
  return TAU / Math.max(0.001, safeResponse);
}

/**
 * Exact integral of one critically damped spring value over `dt`.
 *
 * Phase integration needs the area under a changing speed, not merely its value at the end of a
 * frame. The closed form stays correct across long offscreen gaps without substeps or allocation.
 */
function integratedSpringValue(
  value: number,
  velocity: number,
  target: number,
  omega: number,
  dt: number,
): number {
  if (dt <= 0) return 0;
  const y = value - target;
  const j = velocity + omega * y;
  const decay = Math.exp(-omega * dt);
  const integralDecay = (1 - decay) / omega;
  const integralTimeDecay = (1 - decay * (1 + omega * dt)) / (omega * omega);
  return target * dt + y * integralDecay + j * integralTimeDecay;
}

function copyMotionInto(out: MotionParams, source: Readonly<MotionParams>): void {
  for (let i = 0; i < MOTION_KEYS.length; i++) {
    const key = MOTION_KEYS[i];
    out[key] = source[key];
  }
}

function copyExpressionInto(out: ExpressionParams, source: Readonly<ExpressionParams>): void {
  for (let i = 0; i < EXPRESSION_KEYS.length; i++) {
    const key = EXPRESSION_KEYS[i];
    out[key] = source[key];
  }
}

function copyAccentInto(out: StateAccent, source: Readonly<StateAccent>): void {
  for (let i = 0; i < ACCENT_KEYS.length; i++) {
    const key = ACCENT_KEYS[i];
    out[key] = source[key];
  }
}

/**
 * Allocation-free, interruptible transition over the complete motion and expression vectors.
 *
 * Retargeting never replaces the presentation value or velocity. It only changes the spring's
 * destination, so a rapid state reversal bends the current trajectory instead of restarting it.
 */
export class StateTransitionController {
  readonly sample: StateTransitionSample;

  private readonly motion: MotionParams;
  private readonly expression: ExpressionParams;
  private readonly accent: StateAccent;
  private readonly phase: MotionPhase;
  private readonly motionVelocity = new Float64Array(MOTION_KEYS.length);
  private readonly expressionVelocity = new Float64Array(EXPRESSION_KEYS.length);
  private readonly accentVelocity = new Float64Array(ACCENT_KEYS.length);
  private targetMotion: Readonly<MotionParams>;
  private targetExpression: Readonly<ExpressionParams>;
  private targetAccent: Readonly<StateAccent>;
  private response: number;
  private lastTime: number;
  private readonly autoReturnDoneEnabled: boolean;
  private doneSettledAt = -1;
  private autoReturnDone = false;

  constructor(
    initialState: ThinkingHeadState,
    initialTime = 0,
    playbackRate = 1,
    options: StateTransitionControllerOptions = {},
  ) {
    this.motion = { ...STATE_MOTION[initialState] };
    this.expression = { ...STATE_EXPRESSION[initialState] };
    this.accent = { ...STATE_ACCENT[initialState] };
    this.targetMotion = STATE_MOTION[initialState];
    this.targetExpression = STATE_EXPRESSION[initialState];
    this.targetAccent = STATE_ACCENT[initialState];
    this.response = STATE_TRANSITION_RESPONSE[initialState];
    this.lastTime = Number.isFinite(initialTime) ? Math.max(0, initialTime) : 0;
    this.autoReturnDoneEnabled = options.autoReturnDone ?? true;
    const safePlaybackRate = Number.isFinite(playbackRate) ? playbackRate : 1;
    this.phase = createMotionPhase(this.lastTime, this.motion, safePlaybackRate);
    this.sample = {
      motion: this.motion,
      expression: this.expression,
      phase: this.phase,
      accent: this.accent,
      requestedState: initialState,
      targetState: initialState,
      settled: true,
    };
    if (initialState === "done" && this.autoReturnDoneEnabled) {
      this.autoReturnDone = true;
      this.doneSettledAt = this.lastTime;
    }
  }

  /**
   * Retargets to one of the ten named states after first sampling the current presentation.
   */
  setTargetState(state: ThinkingHeadState, now: number, playbackRate = 1): StateTransitionSample {
    this.advance(now, playbackRate);
    if (
      this.sample.requestedState === state &&
      this.sample.targetState === state &&
      this.targetMotion === STATE_MOTION[state] &&
      this.targetExpression === STATE_EXPRESSION[state] &&
      this.targetAccent === STATE_ACCENT[state]
    ) {
      return this.sample;
    }
    this.beginTarget(
      state,
      STATE_MOTION[state],
      STATE_EXPRESSION[state],
      STATE_ACCENT[state],
      STATE_TRANSITION_RESPONSE[state],
      state === "done" && this.autoReturnDoneEnabled,
    );
    return this.sample;
  }

  /** Replays a semantic event even when its named state is already the current target. */
  restartState(state: ThinkingHeadState, now: number, playbackRate = 1): StateTransitionSample {
    this.advance(now, playbackRate);
    const alreadyAtEndpoint =
      this.sample.settled &&
      this.targetMotion === STATE_MOTION[state] &&
      this.targetExpression === STATE_EXPRESSION[state] &&
      this.targetAccent === STATE_ACCENT[state];
    this.beginTarget(
      state,
      STATE_MOTION[state],
      STATE_EXPRESSION[state],
      STATE_ACCENT[state],
      STATE_TRANSITION_RESPONSE[state],
      state === "done" && this.autoReturnDoneEnabled,
    );
    if (alreadyAtEndpoint) {
      this.settleExactly();
      this.doneSettledAt = state === "done" && this.autoReturnDoneEnabled ? this.lastTime : -1;
    }
    return this.sample;
  }

  /**
   * Retargets the same machinery to caller-provided vectors.
   *
   * This is the seam future custom named states use; no mesh or morph-target path is involved.
   */
  setTarget(
    state: ThinkingHeadState,
    motion: Readonly<MotionParams>,
    expression: Readonly<ExpressionParams>,
    now: number,
    playbackRate = 1,
    response = STATE_TRANSITION_RESPONSE[state] ?? DEFAULT_TRANSITION_RESPONSE,
  ): StateTransitionSample {
    this.advance(now, playbackRate);
    if (
      this.sample.requestedState === state &&
      this.sample.targetState === state &&
      this.targetMotion === motion &&
      this.targetExpression === expression
    ) {
      return this.sample;
    }
    this.beginTarget(
      state,
      motion,
      expression,
      STATE_ACCENT[state],
      Number.isFinite(response) && response > 0 ? response : DEFAULT_TRANSITION_RESPONSE,
      false,
    );
    return this.sample;
  }

  /**
   * Advances from absolute shared-clock time. The returned object and its children are reused.
   */
  advance(now: number, playbackRate = 1): StateTransitionSample {
    const safeNow = Number.isFinite(now) ? Math.max(this.lastTime, now) : this.lastTime;
    const dt = safeNow - this.lastTime;
    this.lastTime = safeNow;

    if (dt > 0) {
      const omega = springOmega(this.response);
      this.integratePhases(dt, Number.isFinite(playbackRate) ? playbackRate : 1, omega);
      const decay = Math.exp(-omega * dt);
      let settled = true;

      for (let i = 0; i < MOTION_KEYS.length; i++) {
        const key = MOTION_KEYS[i];
        const target = this.targetMotion[key];
        const value = this.motion[key];
        const velocity = this.motionVelocity[i];
        const y = value - target;
        const j = velocity + omega * y;
        const next = target + (y + j * dt) * decay;
        const nextVelocity = (velocity - omega * j * dt) * decay;
        this.motion[key] = next;
        this.motionVelocity[i] = nextVelocity;
        if (
          Math.abs(next - target) > POSITION_EPSILON ||
          Math.abs(nextVelocity) > VELOCITY_EPSILON
        ) {
          settled = false;
        }
      }

      for (let i = 0; i < EXPRESSION_KEYS.length; i++) {
        const key = EXPRESSION_KEYS[i];
        const target = this.targetExpression[key];
        const value = this.expression[key];
        const velocity = this.expressionVelocity[i];
        const y = value - target;
        const j = velocity + omega * y;
        const next = target + (y + j * dt) * decay;
        const nextVelocity = (velocity - omega * j * dt) * decay;
        this.expression[key] = next;
        this.expressionVelocity[i] = nextVelocity;
        if (
          Math.abs(next - target) > POSITION_EPSILON ||
          Math.abs(nextVelocity) > VELOCITY_EPSILON
        ) {
          settled = false;
        }
      }

      for (let i = 0; i < ACCENT_KEYS.length; i++) {
        const key = ACCENT_KEYS[i];
        const target = this.targetAccent[key];
        const value = this.accent[key];
        const velocity = this.accentVelocity[i];
        const y = value - target;
        const j = velocity + omega * y;
        const next = target + (y + j * dt) * decay;
        const nextVelocity = (velocity - omega * j * dt) * decay;
        this.accent[key] = next;
        this.accentVelocity[i] = nextVelocity;
        if (
          Math.abs(next - target) > POSITION_EPSILON ||
          Math.abs(nextVelocity) > VELOCITY_EPSILON
        ) {
          settled = false;
        }
      }

      if (settled) this.settleExactly();
      else this.sample.settled = false;
    }

    this.updateDoneReturn(safeNow);
    return this.sample;
  }

  /**
   * Accessibility/static-rendering seam: preserves the semantic expression while removing the
   * spatial transition itself.
   */
  snapToState(state: ThinkingHeadState, now: number, playbackRate = 1): StateTransitionSample {
    this.advance(now, playbackRate);
    this.sample.requestedState = state;
    this.sample.targetState = state;
    this.targetMotion = STATE_MOTION[state];
    this.targetExpression = STATE_EXPRESSION[state];
    this.targetAccent = STATE_ACCENT[state];
    this.response = STATE_TRANSITION_RESPONSE[state];
    copyMotionInto(this.motion, this.targetMotion);
    copyExpressionInto(this.expression, this.targetExpression);
    copyAccentInto(this.accent, this.targetAccent);
    this.motionVelocity.fill(0);
    this.expressionVelocity.fill(0);
    this.accentVelocity.fill(0);
    this.sample.settled = true;
    this.doneSettledAt = state === "done" ? this.lastTime : -1;
    this.autoReturnDone = state === "done" && this.autoReturnDoneEnabled;
    return this.sample;
  }

  /**
   * Snaps to the controller's current target without changing the requested semantic state.
   * Reduced-motion rendering uses this when Done's hold ends and its visual target becomes Idle.
   */
  snapToTarget(now: number, playbackRate = 1): StateTransitionSample {
    this.advance(now, playbackRate);
    copyMotionInto(this.motion, this.targetMotion);
    copyExpressionInto(this.expression, this.targetExpression);
    copyAccentInto(this.accent, this.targetAccent);
    this.motionVelocity.fill(0);
    this.expressionVelocity.fill(0);
    this.accentVelocity.fill(0);
    this.sample.settled = true;
    return this.sample;
  }

  private beginTarget(
    state: ThinkingHeadState,
    motion: Readonly<MotionParams>,
    expression: Readonly<ExpressionParams>,
    accent: Readonly<StateAccent>,
    response: number,
    autoReturnDone: boolean,
  ): void {
    this.sample.requestedState = state;
    this.sample.targetState = state;
    this.targetMotion = motion;
    this.targetExpression = expression;
    this.targetAccent = accent;
    this.response = response;
    this.sample.settled = false;
    this.doneSettledAt = -1;
    this.autoReturnDone = autoReturnDone;
  }

  private integratePhases(dt: number, playbackRate: number, omega: number): void {
    const motion = this.motion;
    const target = this.targetMotion;
    const velocity = this.motionVelocity;
    const phase = this.phase;

    phase.breath +=
      playbackRate *
      integratedSpringValue(
        motion.breathSpeed,
        velocity[BREATH_SPEED_INDEX],
        target.breathSpeed,
        omega,
        dt,
      );
    phase.wave +=
      playbackRate *
      integratedSpringValue(
        motion.waveSpeed,
        velocity[WAVE_SPEED_INDEX],
        target.waveSpeed,
        omega,
        dt,
      );
    phase.jitter +=
      playbackRate *
      integratedSpringValue(
        motion.jitterSpeed,
        velocity[JITTER_SPEED_INDEX],
        target.jitterSpeed,
        omega,
        dt,
      );
    phase.shimmer +=
      playbackRate *
      integratedSpringValue(
        motion.shimmerSpeed,
        velocity[SHIMMER_SPEED_INDEX],
        target.shimmerSpeed,
        omega,
        dt,
      );
    phase.sway +=
      playbackRate *
      integratedSpringValue(
        motion.swaySpeed,
        velocity[SWAY_SPEED_INDEX],
        target.swaySpeed,
        omega,
        dt,
      );
    phase.dart +=
      playbackRate *
      integratedSpringValue(
        motion.swayDartSpeed,
        velocity[DART_SPEED_INDEX],
        target.swayDartSpeed,
        omega,
        dt,
      );
    phase.facial +=
      playbackRate *
      integratedSpringValue(
        motion.facialSpeed,
        velocity[FACIAL_SPEED_INDEX],
        target.facialSpeed,
        omega,
        dt,
      );
    phase.blink +=
      playbackRate *
      integratedSpringValue(
        motion.blinkSpeed,
        velocity[BLINK_SPEED_INDEX],
        target.blinkSpeed,
        omega,
        dt,
      );
  }

  private settleExactly(): void {
    copyMotionInto(this.motion, this.targetMotion);
    copyExpressionInto(this.expression, this.targetExpression);
    copyAccentInto(this.accent, this.targetAccent);
    this.motionVelocity.fill(0);
    this.expressionVelocity.fill(0);
    this.accentVelocity.fill(0);
    this.sample.settled = true;
  }

  private updateDoneReturn(now: number): void {
    if (!this.autoReturnDone || this.sample.targetState !== "done" || !this.sample.settled) return;
    if (this.doneSettledAt < 0) {
      this.doneSettledAt = now;
      return;
    }
    if (now - this.doneSettledAt < DONE_HOLD_SECONDS) return;

    this.sample.targetState = "idle";
    this.targetMotion = STATE_MOTION.idle;
    this.targetExpression = STATE_EXPRESSION.idle;
    this.targetAccent = STATE_ACCENT.idle;
    this.response = STATE_TRANSITION_RESPONSE.idle;
    this.sample.settled = false;
    this.doneSettledAt = -1;
    this.autoReturnDone = false;
  }
}
