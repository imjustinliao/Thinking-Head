import { useState } from "react";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "thinking-head";
import { HeadSlot } from "./HeadSlot.js";
import { STATE_NOTES } from "./states.js";

const MODALITY_OPTIONS = ["none", "text", "audio", "vision"] as const;
type ModalityOption = (typeof MODALITY_OPTIONS)[number];

export function App() {
  const [size, setSize] = useState(48);
  const [speed, setSpeed] = useState(1);
  const [modality, setModality] = useState<ModalityOption>("none");

  return (
    <div className="page">
      <header className="header">
        <h1>Thinking Head</h1>
        <p className="tagline">An animated 3D particle head that shows what your AI is doing.</p>
        <p className="phase-note">Phase 1 · scaffolding complete · renderer not yet built</p>
      </header>

      <section className="controls" aria-label="Live controls">
        <label className="control">
          <span className="control-label">
            Size <output>{size}px</output>
          </span>
          <input
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
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>

        <fieldset className="control control--radios">
          <legend className="control-label">Modality accent</legend>
          <div className="radio-row">
            {MODALITY_OPTIONS.map((option) => (
              <label key={option} className="radio">
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
        <h2 id="inline-heading">Inline</h2>
        <p className="section-note">
          The primary use case — sized to sit beside a line of text in a chat UI.
        </p>
        <p className="inline-sample">
          <HeadSlot state="thinking" size={size} speed={speed} />
          <span>Thinking through the request…</span>
        </p>
      </section>

      <section className="section" aria-labelledby="gallery-heading">
        <h2 id="gallery-heading">All states</h2>
        <p className="section-note">
          All ten universal-verb states, side by side at the current size and speed.
        </p>
        <ul className="gallery">
          {THINKING_HEAD_STATES.map((state: ThinkingHeadState) => (
            <li key={state} className="tile">
              <div className="tile-stage">
                <HeadSlot state={state} size={size} speed={speed} />
              </div>
              <h3 className="tile-name">{state}</h3>
              <p className="tile-when">{STATE_NOTES[state].when}</p>
              <p className="tile-expression">{STATE_NOTES[state].expression}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="orbit-heading">
        <h2 id="orbit-heading">Large interactive view</h2>
        <p className="section-note">The drag-to-rotate 360° view, shown large. Not yet built.</p>
        <div className="orbit-stage">
          <HeadSlot state="idle" size={320} speed={speed} />
        </div>
      </section>

      <section className="section section--placeholder" aria-labelledby="phase2-heading">
        <h2 id="phase2-heading">
          Your own head <span className="badge">Phase 2 · not implemented</span>
        </h2>
        <p className="section-note">
          Structural placeholder for the future photo-upload flow, so this page's layout does not
          need redesigning later. Phase 2 is the one part of the project that requires server-side
          inference; Phase 1 stays fully client-side.
        </p>
        <div className="upload-placeholder" aria-hidden="true">
          <div className="upload-box">
            <span className="upload-icon">＋</span>
            <span>Upload a front-facing photo</span>
            <span className="upload-hint">One photo, neutral expression</span>
          </div>
          <div className="upload-arrow">→</div>
          <div className="upload-box upload-box--result">
            <span>Your personalised head</span>
          </div>
        </div>
      </section>
    </div>
  );
}
