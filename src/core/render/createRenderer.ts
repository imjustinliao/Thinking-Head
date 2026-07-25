import { createCanvas2DRenderer } from "./canvas2d.js";
import type { HeadRenderer } from "./types.js";
import { createWebGLRenderer } from "./webgl/renderer.js";

export type RenderBackend = "webgl2" | "canvas2d";

/**
 * Whether WebGL2 is usable on this canvas, without building a renderer.
 *
 * Separate from {@link createRenderer} so the decision is testable without a GL implementation,
 * and so callers can report the active backend before committing to one.
 */
export function detectBackend(canvas: HTMLCanvasElement): RenderBackend {
  try {
    // A probe context would itself count against the browser's context limit, so this checks for
    // the entry point rather than instantiating one.
    if (typeof WebGL2RenderingContext === "undefined") return "canvas2d";
    if (typeof canvas.getContext !== "function") return "canvas2d";
    return "webgl2";
  } catch {
    return "canvas2d";
  }
}

export interface CreatedRenderer {
  renderer: HeadRenderer;
  backend: RenderBackend;
}

/**
 * Builds the best available renderer for a canvas: WebGL2 through the page's shared context,
 * falling back to Canvas 2D where WebGL2 is missing, blocked, or fails to initialise.
 *
 * `preferCanvas2D` forces the fallback — used for the reduced-motion path, where a static frame
 * has nothing to gain from the GPU.
 */
export function createRenderer(canvas: HTMLCanvasElement, preferCanvas2D = false): CreatedRenderer {
  if (!preferCanvas2D && detectBackend(canvas) === "webgl2") {
    const renderer = createWebGLRenderer(canvas);
    if (renderer) return { renderer, backend: "webgl2" };
  }
  return { renderer: createCanvas2DRenderer(canvas), backend: "canvas2d" };
}
