import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  createRenderer,
  type HeadPointSet,
  type HeadRenderer,
  particleCountForSize,
  type RenderBackend,
  type RenderStyle,
  resolveTier,
} from "thinking-head/dev";

interface HeadSlotProps {
  state: ThinkingHeadState;
  size: number;
  pointSet: HeadPointSet;
  camera: Camera;
  style: RenderStyle;
  maxParticles: number;
  /** Reports which backend this instance actually got, for the demo readout. */
  onBackend?: (backend: RenderBackend) => void;
}

/**
 * One rendered head. Every instance shares the same generated point set — the gallery mounts a
 * dozen of these and generating geometry per instance would be pure waste, quite apart from
 * being the wrong architecture.
 *
 * Static for now: the renderer draws on mount and whenever inputs change. The animation
 * milestone turns this into a per-frame `draw()` without changing the shape of the component.
 */
export function HeadSlot({
  state,
  size,
  pointSet,
  camera,
  style,
  maxParticles,
  onBackend,
}: HeadSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeadRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { renderer, backend } = createRenderer(canvas);
    rendererRef.current = renderer;
    onBackend?.(backend);
    return () => {
      // Explicit teardown: with the shared GL context this is what drops the instance's
      // reference, and the context itself is released when the last head unmounts.
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onBackend]);

  // Pose comes from the size tier: the three-quarter turn that reads alive at display sizes
  // smears the features sideways on a glyph-sized head, so small heads sit face-on. The camera
  // panel's yaw/pitch are the display-tier pose.
  const effectiveCamera = useMemo(() => {
    const { poseScale } = resolveTier(size);
    return { ...camera, yaw: camera.yaw * poseScale, pitch: camera.pitch * poseScale };
  }, [camera, size]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.resize(size, window.devicePixelRatio || 1);
    renderer.draw({
      pointSet,
      count: particleCountForSize(size, maxParticles),
      camera: effectiveCamera,
      style,
    });
  }, [size, pointSet, effectiveCamera, style, maxParticles]);

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
