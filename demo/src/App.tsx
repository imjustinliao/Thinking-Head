import { useState } from "react";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "thinking-head";
import { Backdrop } from "./Backdrop.js";
import { HeadSlot } from "./HeadSlot.js";
import { STATE_NOTES } from "./states.js";
import { useSpotlight } from "./useSpotlight.js";

const MODALITY_OPTIONS = ["none", "text", "audio", "vision"] as const;
type ModalityOption = (typeof MODALITY_OPTIONS)[number];

const READOUT = [
  { value: "10", label: "states" },
  { value: "0", label: "runtime deps" },
  { value: "20–64", label: "px inline" },
  { value: "1", label: "GL context" },
] as const;

export function App() {
  const [size, setSize] = useState(48);
  const [speed, setSpeed] = useState(1);
  const [modality, setModality] = useState<ModalityOption>("none");

  const shellRef = useSpotlight<HTMLDivElement>();
  const modalityIndex = MODALITY_OPTIONS.indexOf(modality);

  return (
    <div className="shell" data-modality={modality} ref={shellRef}>
      <Backdrop />

      <main className="content">
        <header className="hero">
          <p className="eyebrow">
            <span className="pulse" aria-hidden="true" />
            Phase 1 · fully client-side · renderer pending
          </p>
          <h1 className="hero-title">
            Thinking
            <em>Head</em>
          </h1>
          <p className="hero-lede">
            A particle head that <strong>emotes what your AI is doing</strong>. Thinking looks like
            thinking. Searching looks like searching. Not another spinner.
          </p>

          <dl className="readout glass">
            {READOUT.map((item) => (
              <div className="readout-cell" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="deck glass" aria-label="Live controls">
          <label className="control">
            <span className="control-label">
              Size <output>{size}px</output>
            </span>
            <input
              className="slider"
              type="range"
              min={16}
              max={256}
              step={1}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>

          <label className="control">
            <span className="control-label">
              Speed <output>{speed.toFixed(2)}×</output>
            </span>
            <input
              className="slider"
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>

          <fieldset className="control">
            <legend className="control-label">Modality accent</legend>
            <div className="segments" style={{ "--i": modalityIndex } as React.CSSProperties}>
              <span className="segments-thumb" aria-hidden="true" />
              {MODALITY_OPTIONS.map((option) => (
                <label className="segment" key={option}>
                  <input
                    type="radio"
                    name="modality"
                    value={option}
                    checked={modality === option}
                    onChange={() => setModality(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="section" aria-labelledby="inline-heading">
          <div className="section-head">
            <span className="section-index">01</span>
            <div>
              <h2 id="inline-heading">Inline</h2>
              <p className="section-note">
                The primary use case — sized to sit beside a line of text in a chat UI.
              </p>
            </div>
          </div>

          <div className="transcript glass">
            <div className="transcript-row">
              <HeadSlot state="thinking" size={size} speed={speed} />
              <span className="transcript-text">
                Thinking through the request
                <span className="ellipsis" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="gallery-heading">
          <div className="section-head">
            <span className="section-index">02</span>
            <div>
              <h2 id="gallery-heading">Ten states</h2>
              <p className="section-note">
                Every universal-verb state side by side at the current size and speed. Each is a
                continuous loop, not a one-shot — a 30-second wait has to stay alive.
              </p>
            </div>
          </div>

          <ul className="gallery" style={{ "--slot": `${size}px` } as React.CSSProperties}>
            {THINKING_HEAD_STATES.map((state: ThinkingHeadState, index) => (
              <li
                className="vitrine glass"
                key={state}
                style={{ "--delay": `${index * 55}ms` } as React.CSSProperties}
              >
                <span className="vitrine-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="vitrine-stage">
                  <HeadSlot state={state} size={size} speed={speed} />
                </div>
                <h3 className="vitrine-name">{state}</h3>
                <p className="vitrine-when">{STATE_NOTES[state].when}</p>
                <p className="vitrine-expression">{STATE_NOTES[state].expression}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="section" aria-labelledby="orbit-heading">
          <div className="section-head">
            <span className="section-index">03</span>
            <div>
              <h2 id="orbit-heading">Orbit</h2>
              <p className="section-note">
                The large drag-to-rotate 360° view, for when a product wants to show the head off
                rather than tuck it beside a label.
              </p>
            </div>
          </div>

          <div className="stage glass">
            <span className="stage-plate">awaiting renderer</span>
            <HeadSlot state="idle" size={320} speed={speed} />
          </div>
        </section>

        <section className="section section--future" aria-labelledby="phase2-heading">
          <div className="section-head">
            <span className="section-index">04</span>
            <div>
              <h2 id="phase2-heading">
                Your own head
                <span className="badge">Phase 2</span>
              </h2>
              <p className="section-note">
                Structural placeholder for the future photo-upload flow, so this layout never needs
                redesigning. Phase 2 is the one part of the project that requires server-side
                inference — Phase 1 stays entirely client-side.
              </p>
            </div>
          </div>

          <div className="pipeline" aria-hidden="true">
            <div className="pipeline-step glass">
              <span className="pipeline-glyph">＋</span>
              <span className="pipeline-title">Upload a photo</span>
              <span className="pipeline-hint">One frame, front-facing, neutral</span>
            </div>
            <div className="pipeline-link">
              <span />
            </div>
            <div className="pipeline-step glass">
              <span className="pipeline-glyph">◍</span>
              <span className="pipeline-title">Reconstruct</span>
              <span className="pipeline-hint">Server-side, once per photo</span>
            </div>
            <div className="pipeline-link">
              <span />
            </div>
            <div className="pipeline-step glass pipeline-step--result">
              <span className="pipeline-glyph">☺</span>
              <span className="pipeline-title">Your head, rigged</span>
              <span className="pipeline-hint">Same ten states</span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>thinking-head</span>
          <span className="footer-rule" aria-hidden="true" />
          <span>MIT · zero runtime dependencies</span>
        </footer>
      </main>
    </div>
  );
}
