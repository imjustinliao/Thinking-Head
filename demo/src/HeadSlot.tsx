import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  createRenderer,
  type ExpressionParams,
  type HeadModel,
  type HeadRenderer,
  type RenderBackend,
  type RenderStyle,
  resolveTier,
  STATE_EXPRESSION,
  STATE_MOTION,
  STILL_MOTION,
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
  onBackend?: (backend: RenderBackend) => void;
}

const STATE_COLOR: Partial<Record<ThinkingHeadState, string>> = {
  error: "#ff6f5c",
  done: "#8affc1",
};

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
  onBackend,
}: HeadSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeadRenderer | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const expression = expressionOverride ?? STATE_EXPRESSION[state];

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

  // Semantic accents supplement each state's non-colour motion. This demo-level mapping previews
  // the state colour layer the public wrapper will own; the core renderer stays style-driven.
  const effectiveStyle = useMemo<RenderStyle>(() => {
    const color = STATE_COLOR[state];
    return color ? { ...style, color } : style;
  }, [state, style]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(size, dpr);
    // The LOD is chosen against *device* pixels: a high-DPR screen genuinely has room for a
    // finer lattice, and choosing against CSS pixels would throw that resolution away. The
    // CSS-size tier still supplies a floor so glyph heads never lose their eyes or mouth.
    const pointSet = model.levelForSize(size * dpr, targetCellCss, resolveTier(size).minResolution);

    // Reduced motion simplifies rather than removes: the head still renders, fully shaded, it
    // simply holds still. Deleting the indicator would delete the status signal with it.
    const motion = reducedMotion ? STILL_MOTION : STATE_MOTION[state];

    const draw = (time: number) => {
      renderer.draw({
        pointSet,
        count: pointSet.count,
        camera: effectiveCamera,
        style: effectiveStyle,
        time,
        motion,
        expression,
      });
    };

    if (reducedMotion) {
      draw(0);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    const start = () => {
      if (!unsubscribe) unsubscribe = subscribeToClock((t) => draw(t * speed));
    };
    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };

    // Draw once immediately so a head that mounts offscreen is already correct when scrolled to.
    draw(0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) start();
        else stop();
      },
      { rootMargin: "64px" },
    );
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [
    size,
    model,
    effectiveCamera,
    effectiveStyle,
    expression,
    targetCellCss,
    state,
    speed,
    reducedMotion,
  ]);

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
