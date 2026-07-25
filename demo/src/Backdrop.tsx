/**
 * Purely decorative light field behind the page: three slow volumetric blooms, a hairline
 * measurement grid, and a grain layer. All CSS-driven so it costs no JavaScript per frame,
 * and all of it freezes under prefers-reduced-motion.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="bloom bloom--key" />
      <div className="bloom bloom--fill" />
      <div className="bloom bloom--rim" />
      <div className="grid-veil" />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}
