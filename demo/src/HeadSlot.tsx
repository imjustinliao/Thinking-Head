import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  createRenderer,
  type HeadModel,
  type HeadRenderer,
  type RenderBackend,
  type RenderStyle,
  resolveTier,
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
  targetCellCss: number;
  /** Multiplies the shared clock, so the demo's speed control affects every instance alike. */
  speed: number;
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
  targetCellCss,
  speed,
  onBackend,
}: HeadSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeadRenderer | null>(null);
  const reducedMotion = usePrefersReducedMotion();

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
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(size, dpr);
    // The LOD is chosen against *device* pixels: a high-DPR screen genuinely has room for a
    // finer lattice, and choosing against CSS pixels would throw that resolution away.
    const pointSet = model.levelForSize(size * dpr, targetCellCss);

    // Reduced motion simplifies rather than removes: the head still renders, fully shaded, it
    // simply holds still. Deleting the indicator would delete the status signal with it.
    const motion = reducedMotion ? STILL_MOTION : STATE_MOTION[state];

    const draw = (time: number) => {
      renderer.draw({
        pointSet,
        count: pointSet.count,
        camera: effectiveCamera,
        style,
        time,
        motion,
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
  }, [size, model, effectiveCamera, style, targetCellCss, state, speed, reducedMotion]);

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
