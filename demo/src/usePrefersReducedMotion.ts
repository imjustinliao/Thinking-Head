import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion`, live.
 *
 * Subscribed rather than read once: the preference can be toggled mid-session, and an
 * indicator that only honoured it at mount would keep animating for the rest of the page's
 * life for a user who just asked it to stop.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    setReduced(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
