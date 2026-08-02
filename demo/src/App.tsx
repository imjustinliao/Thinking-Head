import { useState } from "react";
import { type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { Backdrop } from "./components/Backdrop.js";
import { BrandMark } from "./components/BrandMark.js";
import { RigOutline, STATE_FORMS } from "./components/RigOutline.js";
import { type ReelSlide, ScrollReel } from "./components/ScrollReel.js";
import { SiteNav } from "./components/SiteNav.js";
import { StateSelector } from "./components/StateSelector.js";

const INSTALL_SNIPPET = "npm install /path/to/Thinking-Head";

const REACT_SNIPPET = `import { MechIndicator } from "thinking-head/react";

<MechIndicator state="thinking" />`;

function Identity() {
  return (
    <div className="rails slide slide--identity">
      <BrandMark className="slide__mark" size={40} />

      <p className="slide__eyebrow">Open source since 2026</p>

      <h1 className="slide__title" id="thinking-tf-title">
        Thinking TF
      </h1>

      <p className="slide__tagline">Every model lies beyond the transformer.</p>

      <p className="slide__description">
        An open-sourced UI component for each state of your AI agent.
      </p>
    </div>
  );
}

function States({ state, onChange }: { state: MechState; onChange: (next: MechState) => void }) {
  const plan = STATE_FRAME_PLANS[state];

  return (
    <div className="rails slide slide--states">
      <div className="slide__text">
        <p className="slide__eyebrow">Agent state</p>

        <h2 className="slide__state">{plan.label}</h2>

        <p className="slide__form">
          {STATE_FORMS[state] === "vehicle" ? "Low vehicle" : "Upright machine"}
        </p>

        <StateSelector onChange={onChange} value={state} />
      </div>

      <div className="stage">
        <div className="stage__scene">
          <div aria-hidden="true" className="stage__ground">
            <div className="stage__plane" />
            <div className="stage__horizon" />
          </div>

          <figure className="stage__figure">
            <RigOutline label={plan.label} state={state} />
          </figure>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<MechState>("thinking");
  const [slide, setSlide] = useState(0);

  const slides: ReelSlide[] = [
    { id: "identity", label: "Identity", content: <Identity /> },
    { id: "states", label: "States", content: <States onChange={setState} state={state} /> },
  ];

  return (
    <div className="page" id="top">
      <Backdrop slide={slide} />
      <SiteNav />

      <main>
        <ScrollReel active={slide} onActiveChange={setSlide} slides={slides} />

        <section aria-labelledby="guide-title" className="guide">
          <div className="rails">
            <h2 className="section-mark" id="guide-title">
              Guide
            </h2>

            <div className="guide__step">
              <h3 className="guide__heading">Install</h3>
              <pre className="guide__code">
                <code>{INSTALL_SNIPPET}</code>
              </pre>
            </div>

            <div className="guide__step">
              <h3 className="guide__heading">React</h3>
              <pre className="guide__code">
                <code>{REACT_SNIPPET}</code>
              </pre>
            </div>

            <footer className="footer__inner">@ Justin Liao</footer>
          </div>
        </section>
      </main>
    </div>
  );
}
