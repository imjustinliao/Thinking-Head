/**
 * The room the page sits in: one overhead key, a floor receding to a horizon,
 * and a lit void on that horizon. It is fixed behind the content so the whole
 * page reads as one lit space rather than a stack of decorated sections.
 *
 * Everything that moves here animates transform or opacity only, so it stays
 * on the compositor and never drives a JavaScript frame loop.
 */
export function Backdrop({ slide }: { slide: number }) {
  return (
    <div aria-hidden="true" className="backdrop" data-slide={slide}>
      <div className="backdrop__cone" />

      <div className="backdrop__void">
        <div className="backdrop__core" />
        <div className="backdrop__rim" />
        <div className="backdrop__arc" />
      </div>

      <div className="backdrop__floor" />
      <div className="backdrop__horizon" />
      <div className="backdrop__glint" />
      <div className="backdrop__grain" />
    </div>
  );
}
