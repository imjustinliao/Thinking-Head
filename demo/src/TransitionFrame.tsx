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
 * Every tile reconstructs its controller from t=0, so browser screenshots are repeatable and a
 * late frame never depends on the wall-clock time or on which earlier frames were mounted.
 */
export function TransitionFrame({
  from,
  to,
  time,
  size,
  dpr,
  pointSet,
  camera,
  style,
  className,
}: TransitionFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sample = useMemo(() => {
    const controller = new StateTransitionController(from, 0);
    if (to !== from) controller.setTargetState(to, 0);
    return controller.advance(time);
  }, [from, time, to]);

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
      time,
      phase: sample.phase,
      motion: sample.motion,
      expression: sample.expression,
    };
    renderer.draw(frame);
    return () => renderer.dispose();
  }, [camera, dpr, pointSet, sample, size, style, time]);

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
