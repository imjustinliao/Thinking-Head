import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "thinking-head";
import { HeadModel, type RenderBackend, type RenderStyle } from "thinking-head/dev";
import { Backdrop } from "./Backdrop.js";
import { HeadSlot } from "./HeadSlot.js";
import { STATE_NOTES } from "./states.js";
import { TuningPanel } from "./TuningPanel.js";
import { DEFAULT_TUNING, type TuningConfig } from "./tuning.js";
import { useSpotlight } from "./useSpotlight.js";

const MODALITY_OPTIONS = ["none", "text", "audio", "vision"] as const;
type ModalityOption = (typeof MODALITY_OPTIONS)[number];

/** Present-participle copy for the inline sample, so the label matches what the state is doing. */
const INLINE_COPY: Record<ThinkingHeadState, string> = {
  idle: "Waiting for you",
  listening: "Listening",
  reading: "Reading the context",
  thinking: "Thinking through the request",
  searching: "Searching",
  executing: "Running a tool",
  generating: "Generating a response",
  reviewing: "Reviewing the answer",
  error: "Something went wrong",
  done: "Done",
};

function inlineCopyForState(state: ThinkingHeadState): string {
  return INLINE_COPY[state];
}

/** Head colour per modality accent. Mirrors the CSS accent so the head matches the page. */
const MODALITY_COLOR: Record<ModalityOption, string> = {
  none: "#ffffff",
  text: "#c9f8ff",
  audio: "#ffe6c2",
  vision: "#ffd0ee",
};

export function App() {
  const [size, setSize] = useState(48);
  const [speed, setSpeed] = useState(1);
  const [modality, setModality] = useState<ModalityOption>("none");
  const [tuning, setTuning] = useState<TuningConfig>(() => structuredClone(DEFAULT_TUNING));
  const [backend, setBackend] = useState<RenderBackend | null>(null);
  // The pill the user has clicked; drives the inline sample and the orbit head. Until every
  // state has its own motion this only changes the labels — but it's the wiring the state
  // milestones need in place, so building it here makes each future state a one-line change.
  const [activeState, setActiveState] = useState<ThinkingHeadState>("thinking");

  // Stable so it does not retrigger every instance's renderer effect on each render.
  const onBackend = useCallback((next: RenderBackend) => setBackend(next), []);

  const shellRef = useSpotlight<HTMLDivElement>();
  const modalityIndex = MODALITY_OPTIONS.indexOf(modality);

  // Geometry regeneration is the expensive step, so it trails the sliders by a frame rather than
  // blocking them. React keeps the last committed head on screen while the new one is computed.
  const deferredTuning = useDeferredValue(tuning);

  // One model per parameter set; LOD levels inside it are built on demand and cached, so the
  // page only ever generates the resolutions actually shown.
  const { model, generateMs } = useMemo(() => {
    const started = performance.now();
    const built = new HeadModel(deferredTuning.head, deferredTuning.features);
    // Warm the level the controls are currently showing so the timing readout is meaningful.
    built.levelForSize(48 * 2, deferredTuning.sampling.targetCellCss);
    return { model: built, generateMs: performance.now() - started };
  }, [deferredTuning]);

  const camera = deferredTuning.camera;

  const style = useMemo<RenderStyle>(
    () => ({
      color: MODALITY_COLOR[modality],
      particleScale: deferredTuning.style.particleScale,
      backfaceDim: deferredTuning.style.backfaceDim,
      depthDim: deferredTuning.style.depthDim,
      featureBoost: deferredTuning.style.featureBoost,
      lighting: deferredTuning.style.lighting,
      shape: "square",
    }),
    [modality, deferredTuning.style],
  );

  const targetCellCss = deferredTuning.sampling.targetCellCss;

  // Pills keep their row shape at any slider value: the head tracks the size control but stays
  // within icon range, while the inline sample and orbit stage demo the full range.
  const pillHeadSize = Math.max(28, Math.min(size, 72));

  const READOUT = [
    {
      value: String(model.level(model.levelForSize(size * 2, targetCellCss).resolution).count),
      label: `particles at ${size}px`,
    },
    { value: String(model.levelForSize(size * 2, targetCellCss).resolution), label: "lattice" },
    {
      value: backend === "webgl2" ? "WebGL2" : backend === "canvas2d" ? "2D" : "—",
      label: "backend",
    },
    { value: "1", label: "GL context" },
  ];

  return (
    <div className="shell" data-modality={modality} data-state={activeState} ref={shellRef}>
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

        <TuningPanel
          config={tuning}
          onChange={setTuning}
          generateMs={generateMs}
          particleCount={model.levelForSize(size * 2, targetCellCss).count}
        />

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
              <HeadSlot
                state={activeState}
                size={size}
                model={model}
                camera={camera}
                style={style}
                targetCellCss={targetCellCss}
                speed={speed}
                onBackend={onBackend}
              />
              <span className="transcript-text">
                {inlineCopyForState(activeState)}
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
                Every universal-verb state, presented the way AI products actually surface status:
                head beside a shimmering label. Each will be a continuous loop, never a one-shot.
                <strong> Click a pill</strong> to drive the inline sample and the orbit head below —
                the first nine states now have distinct tuned motion, while the remaining state
                inherits <code>idle</code> until its own milestone lands.
              </p>
            </div>
          </div>

          <ul className="pills" aria-label="Thinking head states">
            {THINKING_HEAD_STATES.map((state: ThinkingHeadState, index) => {
              const label = `${state.charAt(0).toUpperCase()}${state.slice(1)}…`;
              const active = state === activeState;
              return (
                <li key={state} style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}>
                  <button
                    type="button"
                    className={`pill glass${active ? " pill--active" : ""}`}
                    onClick={() => setActiveState(state)}
                    aria-pressed={active}
                    title={`${STATE_NOTES[state].when} — ${STATE_NOTES[state].expression}`}
                  >
                    <HeadSlot
                      state={state}
                      size={pillHeadSize}
                      model={model}
                      camera={camera}
                      style={style}
                      targetCellCss={targetCellCss}
                      speed={speed}
                    />
                    <span className="shimmer" data-text={label}>
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
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
            <span className="stage-plate">{`state · ${activeState}`}</span>
            <HeadSlot
              state={activeState}
              size={320}
              model={model}
              camera={camera}
              style={style}
              targetCellCss={targetCellCss}
              speed={speed}
            />
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
