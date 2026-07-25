import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  createCanvas2DRenderer,
  type HeadPointSet,
  type HeadRenderer,
  particleCountForSize,
  type RenderStyle,
} from "thinking-head/dev";

interface HeadSlotProps {
  state: ThinkingHeadState;
  size: number;
  pointSet: HeadPointSet;
  camera: Camera;
  style: RenderStyle;
  maxParticles: number;
}

/**
 * One rendered head. Every instance shares the same generated point set — the gallery mounts a
 * dozen of these and generating geometry per instance would be pure waste, quite apart from
 * being the wrong architecture.
 *
 * Static for now: the renderer draws on mount and whenever inputs change. The animation
 * milestone turns this into a per-frame `draw()` without changing the shape of the component.
 */
export function HeadSlot({ state, size, pointSet, camera, style, maxParticles }: HeadSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeadRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createCanvas2DRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Pose is a function of size, like density: the three-quarter turn that reads alive at 256px
  // smears the features sideways at 20px, so small heads straighten toward face-on. The camera
  // panel's yaw/pitch remain the full-size pose.
  const effectiveCamera = useMemo(() => {
    const poseT = Math.min(1, Math.max(0, (size - 20) / 236)) ** 0.6;
    return { ...camera, yaw: camera.yaw * poseT, pitch: camera.pitch * (0.4 + 0.6 * poseT) };
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
