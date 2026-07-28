import { useEffect, useMemo, useRef } from "react";
import type { ThinkingHeadState } from "thinking-head";
import {
  type Camera,
  createRenderer,
  type HeadPointSet,
  type RenderFrame,
  type RenderStyle,
  StateTransitionController,
} from "thinking-head/dev";

interface TransitionFrameProps {
  from: ThinkingHeadState;
  to: ThinkingHeadState;
  time: number;
  startTime: number;
  fps: number;
  size: number;
  dpr: number;
  pointSet: HeadPointSet;
  camera: Camera;
  style: RenderStyle;
  className?: string;
}

/**
 * One deterministic transition frame.
 *
 * Every tile reconstructs its controller from the selected shared-clock phase, so browser
 * screenshots are repeatable and a late frame never depends on wall-clock timing or which earlier
 * tiles happened to mount.
 */
export function TransitionFrame({
  from,
  to,
  time,
  startTime,
  fps,
  size,
  dpr,
  pointSet,
  camera,
  style,
  className,
}: TransitionFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sample = useMemo(() => {
    const controller = new StateTransitionController(from, startTime);
    if (to !== from) controller.setTargetState(to, startTime);
    const step = 1 / Math.max(1, fps);
    let elapsed = step;
    while (elapsed < time) {
      controller.advance(startTime + elapsed);
      elapsed += step;
    }
    return controller.advance(startTime + time);
  }, [fps, from, startTime, time, to]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { renderer } = createRenderer(canvas);
    renderer.resize(size, dpr);
    const frame: RenderFrame = {
      pointSet,
      count: pointSet.count,
      camera,
      style,
      time: startTime + time,
      phase: sample.phase,
      motion: sample.motion,
      expression: sample.expression,
    };
    renderer.draw(frame);
    return () => renderer.dispose();
  }, [camera, dpr, pointSet, sample, size, startTime, style, time]);

  return (
    <figure className={className}>
      <canvas
        ref={canvasRef}
        aria-label={`${from} to ${to} transition at ${Math.round(time * 1000)} milliseconds`}
      />
      <figcaption>{Math.round(time * 1000)}ms</figcaption>
    </figure>
  );
}
