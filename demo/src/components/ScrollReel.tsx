import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

export interface ReelSlide {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface ScrollReelProps {
  readonly slides: readonly ReelSlide[];
  readonly active: number;
  /** Must be referentially stable — a state setter is ideal. */
  readonly onActiveChange: (index: number) => void;
}

/**
 * A sticky stage held for the length of the track, with one invisible mark per
 * slide. An IntersectionObserver watching a one-pixel band at the middle of the
 * viewport reports which mark the reader has reached, so the slide change costs
 * two observer callbacks for the whole section rather than a scroll handler.
 *
 * The progress steps are real buttons. Inactive slides are `visibility: hidden`
 * and so are out of the tab order, which would otherwise strand a keyboard user
 * — the steps are how they reach a slide without scrolling to it.
 */
export function ScrollReel({ slides, active, onActiveChange }: ScrollReelProps) {
  const marks = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onActiveChange(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );

    for (const mark of marks.current) {
      if (mark) observer.observe(mark);
    }
    return () => observer.disconnect();
  }, [onActiveChange]);

  return (
    <section
      className="reel"
      style={{ "--slides": slides.length } as CSSProperties}
      aria-label="Thinking TF"
    >
      <div className="reel__track">
        {slides.map((slide, index) => (
          <div
            className="reel__mark"
            data-index={index}
            key={slide.id}
            ref={(element) => {
              marks.current[index] = element;
            }}
            style={{ "--index": index } as CSSProperties}
          />
        ))}

        <div className="reel__stage">
          <div className="rails reel__rails">
            <ol className="progress">
              {slides.map((slide, index) => (
                <li className="progress__step" key={slide.id}>
                  <button
                    aria-current={index === active ? "true" : undefined}
                    className="progress__button"
                    onClick={() => marks.current[index]?.scrollIntoView({ block: "center" })}
                    type="button"
                  >
                    <span className="progress__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="progress__label">{slide.label}</span>
                    <span aria-hidden="true" className="progress__rail" />
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {slides.map((slide, index) => (
            <div className="reel__slide" data-active={index === active} key={slide.id}>
              {slide.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
