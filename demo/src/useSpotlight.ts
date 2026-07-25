import { useEffect, useRef } from "react";

/**
 * Treats the pointer as a light source: the glass panel under the cursor gets local
 * `--mx`/`--my` so its specular hotspot tracks the pointer.
 *
 * One delegated listener rather than one per panel, coalesced into a single rAF, and only
 * ever touching the panel currently under the pointer — so a gallery of twenty panels
 * still costs one write per frame.
 */
export function useSpotlight<T extends HTMLElement>() {
  const rootRef = useRef<T>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let frame = 0;
    let pending: { panel: HTMLElement; x: number; y: number } | null = null;
    let lit: HTMLElement | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { panel, x, y } = pending;
      if (lit && lit !== panel) lit.style.removeProperty("--lit");
      panel.style.setProperty("--mx", `${x}px`);
      panel.style.setProperty("--my", `${y}px`);
      panel.style.setProperty("--lit", "1");
      lit = panel;
      pending = null;
    };

    const onMove = (event: PointerEvent) => {
      const target = event.target;
      const panel = target instanceof Element ? target.closest<HTMLElement>(".glass") : null;

      if (!panel) {
        if (lit) {
          lit.style.removeProperty("--lit");
          lit = null;
        }
        pending = null;
        return;
      }

      const box = panel.getBoundingClientRect();
      pending = { panel, x: event.clientX - box.left, y: event.clientY - box.top };
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onLeave = () => {
      pending = null;
      if (lit) {
        lit.style.removeProperty("--lit");
        lit = null;
      }
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return rootRef;
}
