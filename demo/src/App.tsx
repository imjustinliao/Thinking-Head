import { useState } from "react";
import { type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { MechIndicator } from "thinking-head/react";

const sceneStates: readonly MechState[] = [
  "thinking",
  "searching",
  "reading",
  "executing",
  "listening",
];

export function App() {
  const [state, setState] = useState<MechState>("thinking");
  const plan = STATE_FRAME_PLANS[state];

  return (
    <main className="marketing-shell">
      <nav className="masthead" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Thinking Head home">
          <span className="brand-mark" aria-hidden="true">
            TH
          </span>
          <span>Thinking Head</span>
        </a>
        <div className="nav-links">
          <a href="#signal">Signal language</a>
          <a href="#system">System</a>
        </div>
        <a className="nav-cta" href="#system">
          Explore the system <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="space-hero" id="top" aria-labelledby="hero-title">
        <div className="star-field far" aria-hidden="true" />
        <div className="star-field near" aria-hidden="true" />
        <div className="sun" aria-hidden="true">
          <i />
        </div>
        <div className="planet moon-one" aria-hidden="true" />
        <div className="planet moon-two" aria-hidden="true" />
        <svg
          className="orbit-map"
          aria-hidden="true"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <path d="M-90 692 C286 410 944 461 1530 676" />
          <path d="M-80 764 C359 496 976 528 1518 730" />
          <circle cx="1108" cy="512" r="4" />
          <circle cx="312" cy="567" r="3" />
        </svg>

        <div className="hero-copy">
          <p className="hero-overline">
            <span /> A visible language for agents
          </p>
          <h1 id="hero-title">
            Make intelligence
            <br />
            feel <em>present.</em>
          </h1>
          <p className="hero-summary">
            An original motion system that turns an agent’s invisible work into a clear, living
            signal—built for the moments between question and answer.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#signal">
              See the states <span aria-hidden="true">↓</span>
            </a>
            <a className="quiet-action" href="#system">
              View the component <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <aside className="orbit-note" aria-label="Current example status">
          <span className="note-line" />
          <div>
            <span className="note-index">01 — live signal</span>
            <strong>{plan.label}</strong>
            <p>{plan.form} mode engaged</p>
          </div>
        </aside>

        <div className="machine-world" aria-hidden="true">
          <div className="world-atmosphere" />
          <div className="world-surface" />
          <svg
            aria-hidden="true"
            className="world-plating"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id="world-clip">
                <circle cx="500" cy="500" r="496" />
              </clipPath>
              <linearGradient id="plate-light" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#e8f8ff" stopOpacity=".85" />
                <stop offset=".3" stopColor="#59c9ff" stopOpacity=".17" />
                <stop offset="1" stopColor="#08141f" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g clipPath="url(#world-clip)">
              <path d="M-36 383 L157 278 L330 356 L437 253 L601 332 L754 205 L1046 348" />
              <path d="M-20 472 L139 409 L283 472 L452 365 L644 451 L808 358 L1047 455" />
              <path d="M-8 577 L188 498 L336 573 L497 484 L660 582 L835 481 L1022 569" />
              <path d="M15 678 L192 605 L390 688 L562 580 L731 683 L916 599 L1020 645" />
              <path d="M144 206 L201 684 M340 160 L387 716 M580 154 L616 717 M786 130 L758 688" />
              <path
                className="bright-plate"
                d="M-15 388 L157 278 L330 356 L437 253 L601 332 L754 205 L1017 328"
              />
            </g>
          </svg>
          <div className="world-beacon" />
        </div>
      </section>

      <section className="signal-section" id="signal" aria-labelledby="signal-title">
        <div className="section-heading">
          <p className="hero-overline">
            <span /> Signal language
          </p>
          <h2 id="signal-title">One system. Five unmistakable modes.</h2>
          <p>
            Each state changes the machine’s function, silhouette, and cadence. Pick one to bring it
            into orbit.
          </p>
        </div>
        <div className="state-constellation" role="tablist" aria-label="Preview an activity state">
          {sceneStates.map((item, index) => (
            <button
              aria-selected={item === state}
              className={item === state ? "constellation-node active" : "constellation-node"}
              key={item}
              onClick={() => setState(item)}
              role="tab"
              type="button"
            >
              <span className="node-index">0{index + 1}</span>
              <MechIndicator size={48} speed={0.8} state={item} />
              <strong>{STATE_FRAME_PLANS[item].label}</strong>
              <small>{STATE_FRAME_PLANS[item].form} mode</small>
            </button>
          ))}
        </div>
      </section>

      <section className="system-section" id="system">
        <p className="hero-overline">
          <span /> Designed for the interface
        </p>
        <h2>
          Small enough to disappear.
          <br />
          Distinct enough to matter.
        </h2>
        <div className="system-facts">
          <p>
            <b>SVG + CSS</b>Original vector motion, sharp at any pixel density.
          </p>
          <p>
            <b>Client-only</b>No assets, requests, or processing outside the browser.
          </p>
          <p>
            <b>Motion-aware</b>Respects reduced-motion preferences without losing meaning.
          </p>
        </div>
      </section>
    </main>
  );
}
