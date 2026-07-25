import type { HeadRenderer, RenderFrame } from "../types.js";
import { acquireSharedGL, type SharedGLRenderer } from "./sharedContext.js";

/**
 * WebGL2 backend. Each instance owns only a cheap 2D context on its own canvas; the actual
 * drawing happens in the page's single shared GL context, which then blits the result here.
 *
 * Returns null when WebGL2 is unavailable, so the factory can fall back to Canvas 2D.
 */
export function createWebGLRenderer(canvas: HTMLCanvasElement): HeadRenderer | null {
  const shared = acquireSharedGL();
  if (!shared) return null;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    shared.release();
    return null;
  }

  let cssSize = 0;
  let ratio = 1;
  let released = false;

  return {
    resize(pixelSize: number, dpr: number): void {
      // DPR capped at 2: rendering at 3 costs 9x the fill of 1 for no perceptible gain at 24px.
      const cappedDpr = Math.min(dpr, 2);
      const backing = Math.max(1, Math.round(pixelSize * cappedDpr));
      if (cssSize === pixelSize && ratio === cappedDpr && canvas.width === backing) return;
      cssSize = pixelSize;
      ratio = cappedDpr;
      canvas.width = backing;
      canvas.height = backing;
      canvas.style.width = `${pixelSize}px`;
      canvas.style.height = `${pixelSize}px`;
    },

    draw(frame: RenderFrame): void {
      if (released) return;
      const devicePixels = Math.max(1, Math.round(cssSize * ratio));
      shared.render(ctx, devicePixels, cssSize, frame);
    },

    dispose(): void {
      if (released) return;
      released = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      shared.release();
    },
  };
}

export type { SharedGLRenderer };
