import { useState } from "react";
import { MECH_STATES, type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { MechIndicator } from "thinking-head/react";

export function App() {
  const [state, setState] = useState<MechState>("thinking");
  const [size, setSize] = useState(152);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const plan = STATE_FRAME_PLANS[state];

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="#top">
          TH / 01
        </a>
        <p>Original status-motion study</p>
        <a href="#storyboard">frame plans</a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">AI state indicator · SVG / CSS · zero assets</div>
        <h1>
          A small machine
          <br />
          that makes AI activity legible.
        </h1>
        <p className="lede">
          Each state has its own silhouette, motion rhythm, and transformation sequence. The
          animation is code, not a downloaded video or a fragile pile of image frames.
        </p>
      </section>

      <section className="stage" aria-label="Interactive indicator preview">
        <div className="stage-grid" />
        <div className="stage-copy">
          <span className="state-kicker">
            {plan.form} form / 0{MECH_STATES.indexOf(state) + 1}
          </span>
          <h2>{plan.label}</h2>
          <p>{plan.description}</p>
        </div>
        <MechIndicator
          className="hero-mech"
          paused={paused}
          size={size}
          speed={speed}
          state={state}
        />
        <div className="stage-readout">
          <span>loop {Math.round((4.8 / speed) * 10) / 10}s</span>
          <span>{size}px</span>
        </div>
      </section>

      <section className="control-panel" aria-label="Preview controls">
        <div className="state-select" role="tablist" aria-label="Activity state">
          {MECH_STATES.map((item) => (
            <button
              aria-selected={state === item}
              key={item}
              onClick={() => setState(item)}
              role="tab"
              type="button"
            >
              <MechIndicator size={30} state={item} />
              <span>{STATE_FRAME_PLANS[item].label}</span>
            </button>
          ))}
        </div>
        <div className="sliders">
          <label>
            Scale{" "}
            <input
              aria-label="Indicator scale"
              max="160"
              min="44"
              onChange={(event) => setSize(Number(event.target.value))}
              type="range"
              value={size}
            />
          </label>
          <label>
            Tempo{" "}
            <input
              aria-label="Animation tempo"
              max="1.8"
              min="0.5"
              onChange={(event) => setSpeed(Number(event.target.value))}
              step="0.1"
              type="range"
              value={speed}
            />
          </label>
          <button className="pause" onClick={() => setPaused((value) => !value)} type="button">
            {paused ? "Resume motion" : "Pause motion"}
          </button>
        </div>
      </section>

      <section className="storyboard" id="storyboard">
        <div>
          <div className="eyebrow">Sequence language</div>
          <h2>Every transformation is planned before it is animated.</h2>
        </div>
        <ol className="pose-rail">
          {plan.poses.map((pose) => (
            <li key={pose.at} style={{ "--pose": `${pose.at}%` } as React.CSSProperties}>
              <span className="pose-dot" />
              <span className="pose-time">{String(pose.at).padStart(2, "0")}</span>
              <strong>{pose.name}</strong>
              <p>{pose.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="gallery" aria-label="All states">
        {MECH_STATES.map((item, index) => (
          <button
            className={item === state ? "gallery-card active" : "gallery-card"}
            key={item}
            onClick={() => setState(item)}
            type="button"
          >
            <span>0{index + 1}</span>
            <MechIndicator size={68} speed={0.85} state={item} />
            <strong>{STATE_FRAME_PLANS[item].label}</strong>
            <small>{STATE_FRAME_PLANS[item].form} form</small>
          </button>
        ))}
      </section>
    </main>
  );
}
