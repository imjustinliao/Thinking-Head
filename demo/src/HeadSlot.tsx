import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  clockTime,
  createRenderer,
  type ExpressionParams,
  type HeadModel,
  type HeadRenderer,
  minimumResolutionForSize,
  type RenderBackend,
  type RenderFrame,
  type RenderStyle,
  resolveTier,
  STATE_MOTION,
  STILL_MOTION,
  StateTransitionController,
  subscribeToClock,
} from "thinking-head/dev";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

interface HeadSlotProps {
  state: ThinkingHeadState;
  size: number;
  model: HeadModel;
  camera: Camera;
  style: RenderStyle;
  /** Manual sandbox value; null renders the named state's reviewed expression preset. */
  expressionOverride: ExpressionParams | null;
  targetCellCss: number;
  /** Multiplies the shared clock, so the demo's speed control affects every instance alike. */
  speed: number;
  /** Increment to replay a semantic event even when `state` has not changed. */
  requestId?: number;
  /** Active indicators return Done to Idle; static gallery studies keep the endpoint. */
  autoReturnDone?: boolean;
  onDoneReturn?: () => void;
  onBackend?: (backend: RenderBackend) => void;
}

/**
 * One rendered head.
 *
 * Every instance shares the page's single geometry model, its single WebGL context, and its
 * single animation clock. The instance itself owns only a canvas and a subscription.
 *
 * It draws only when it needs to: offscreen instances unsubscribe from the clock entirely
 * rather than rendering into a canvas nobody can see, which for an indicator buried in a long
 * transcript is the difference between free and a permanent frame cost.
 */
export function HeadSlot({
  state,
  size,
  model,
  camera,
  style,
  expressionOverride,
  targetCellCss,
  speed,
  requestId = 0,
  autoReturnDone = false,
  onDoneReturn,
  onBackend,
}: HeadSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeadRenderer | null>(null);
  const controllerRef = useRef<StateTransitionController | null>(null);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const refreshClockRef = useRef<(() => void) | null>(null);
  const speedRef = useRef(speed);
  const requestIdRef = useRef(requestId);
  const doneReturnNotifiedRef = useRef(false);
  const onDoneReturnRef = useRef(onDoneReturn);
  onDoneReturnRef.current = onDoneReturn;
  const reducedMotion = usePrefersReducedMotion();

  if (!controllerRef.current) {
    controllerRef.current = new StateTransitionController(state, clockTime(), speed, {
      autoReturnDone,
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { renderer, backend } = createRenderer(canvas);
    rendererRef.current = renderer;
    onBackend?.(backend);
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onBackend]);

  // Pose comes from the size tier: the three-quarter turn that reads alive at display sizes
  // smears the features sideways on a glyph-sized head, so small heads sit face-on.
  const effectiveCamera = useMemo(() => {
    const { poseScale } = resolveTier(size);
    return { ...camera, yaw: camera.yaw * poseScale, pitch: camera.pitch * poseScale };
  }, [camera, size]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const now = clockTime();
    const previousSpeed = speedRef.current;
    const replay = requestId !== requestIdRef.current;
    requestIdRef.current = requestId;
    if (state === "done") doneReturnNotifiedRef.current = false;

    if (reducedMotion) {
      if (expressionOverride) {
        controller.setTarget(state, STATE_MOTION[state], expressionOverride, now, previousSpeed);
        controller.snapToTarget(now, previousSpeed);
      } else {
        controller.snapToState(state, now, previousSpeed);
      }
    } else if (expressionOverride) {
      controller.setTarget(state, STATE_MOTION[state], expressionOverride, now, previousSpeed);
    } else if (replay) {
      controller.restartState(state, now, previousSpeed);
    } else {
      controller.setTargetState(state, now, previousSpeed);
    }

    drawRef.current?.(now);
    refreshClockRef.current?.();
  }, [expressionOverride, reducedMotion, requestId, state]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const now = clockTime();
    controller.advance(now, speedRef.current);
    speedRef.current = speed;
    drawRef.current?.(now);
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const controller = controllerRef.current;
    if (!canvas || !renderer || !controller) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(size, dpr);
    // Both size and target spacing move into device pixels together. DPR sharpens each circle's
    // edge; it must not multiply particle density or a 16px face becomes subpixel grey noise.
    const pointSet = model.levelForSize(
      size * dpr,
      targetCellCss * dpr,
      minimumResolutionForSize(size),
    );

    // Reuse one frame object. Animation changes only its scalar/vector references, so the live
    // path adds no per-frame garbage for the collector to clean up.
    const frame: RenderFrame = {
      pointSet,
      count: pointSet.count,
      camera: effectiveCamera,
      style,
      time: clockTime(),
      phase: controller.sample.phase,
      motion: reducedMotion ? STILL_MOTION : controller.sample.motion,
      expression: controller.sample.expression,
      accent: controller.sample.accent,
    };

    const draw = (time: number): void => {
      let sample = controller.advance(time, speedRef.current);
      if (
        reducedMotion &&
        sample.requestedState === "done" &&
        sample.targetState === "idle" &&
        !sample.settled
      ) {
        sample = controller.snapToTarget(time, speedRef.current);
      }
      if (
        sample.requestedState === "done" &&
        sample.targetState === "idle" &&
        !doneReturnNotifiedRef.current
      ) {
        doneReturnNotifiedRef.current = true;
        onDoneReturnRef.current?.();
      }
      frame.time = time;
      frame.phase = sample.phase;
      frame.motion = reducedMotion ? STILL_MOTION : sample.motion;
      frame.expression = sample.expression;
      frame.accent = sample.accent;
      renderer.draw(frame);
    };
    drawRef.current = draw;

    let unsubscribe: (() => void) | null = null;
    let visible = false;
    const needsClock = (): boolean =>
      !reducedMotion ||
      (controller.sample.requestedState === "done" && controller.sample.targetState === "done");

    const stop = (): void => {
      unsubscribe?.();
      unsubscribe = null;
    };

    const start = () => {
      if (unsubscribe || !visible || !needsClock()) return;
      unsubscribe = subscribeToClock((time) => {
        draw(time);
        if (!needsClock()) stop();
      });
    };
    const refreshClock = (): void => {
      if (!visible || !needsClock()) stop();
      else start();
    };
    refreshClockRef.current = refreshClock;

    // Draw once immediately so a head that mounts offscreen is already correct when scrolled to.
    draw(clockTime());

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        refreshClock();
      },
      { rootMargin: "64px" },
    );
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      stop();
      if (drawRef.current === draw) drawRef.current = null;
      if (refreshClockRef.current === refreshClock) refreshClockRef.current = null;
    };
  }, [size, model, effectiveCamera, style, targetCellCss, reducedMotion]);

  return (
    <span
      className="chamber"
      style={{ width: size, height: size }}
      data-state={state}
      role="img"
      aria-label={`Particle head, ${state} state`}
    >
      <span className="chamber-halo" />
      {/* No aria-hidden needed: role="img" on the wrapper already hides this subtree. */}
      <canvas className="chamber-canvas" ref={canvasRef} />
      <span className="chamber-ring" />
    </span>
  );
}
