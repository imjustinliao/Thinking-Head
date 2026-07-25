/**
 * One animation clock for the whole page.
 *
 * Every head instance reads the same elapsed time, so a chat transcript showing a dozen
 * indicators has them all breathing in phase instead of drifting into a shimmering mess. That
 * is only true if there is exactly one time source — per-instance `requestAnimationFrame` loops
 * start at different moments and immediately disagree.
 *
 * It is also the largest power win available. The loop only runs while at least one instance is
 * subscribed, and instances unsubscribe when they scroll offscreen or the tab is hidden, so an
 * indicator buried in a long transcript costs nothing at all.
 */

export type ClockListener = (elapsedSeconds: number) => void;

/**
 * Frame scheduling, resolved once. `requestAnimationFrame` is absent when the package is
 * imported outside a browser — server rendering, or a test runner — and the clock must degrade
 * rather than throw on import.
 */
const requestFrame: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

const cancelFrame: (handle: number) => void =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout;

const listeners = new Set<ClockListener>();

let frame = 0;
let startedAt = 0;
/** Elapsed time survives pauses, so resuming never jumps the animation. */
let elapsed = 0;
let hidden = false;

function tick(now: number): void {
  frame = 0;
  elapsed += (now - startedAt) / 1000;
  startedAt = now;
  // Iterating a copy would allocate every frame; the Set tolerates a listener removing itself.
  for (const listener of listeners) listener(elapsed);
  schedule();
}

function schedule(): void {
  if (frame || hidden || listeners.size === 0) return;
  startedAt = performance.now();
  frame = requestFrame(tick);
}

function stop(): void {
  if (!frame) return;
  cancelFrame(frame);
  frame = 0;
}

function onVisibilityChange(): void {
  hidden = document.visibilityState === "hidden";
  if (hidden) stop();
  else schedule();
}

if (typeof document !== "undefined") {
  hidden = document.visibilityState === "hidden";
  document.addEventListener("visibilitychange", onVisibilityChange);
}

/** Subscribes to the shared clock. Returns an unsubscribe function. */
export function subscribeToClock(listener: ClockListener): () => void {
  listeners.add(listener);
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Current elapsed time, for a one-off static draw without subscribing. */
export function clockTime(): number {
  return elapsed;
}

/** Test seam: resets the module's state. */
export function resetClock(): void {
  listeners.clear();
  stop();
  elapsed = 0;
}

/** Test seam: how many listeners are live, and whether the loop is running. */
export function clockState(): { listeners: number; running: boolean } {
  return { listeners: listeners.size, running: frame !== 0 };
}
