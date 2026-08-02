import { useState } from "react";
import { type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { BrandMark } from "./components/BrandMark.js";
import { RigOutline, STATE_FORMS } from "./components/RigOutline.js";
import { SiteNav } from "./components/SiteNav.js";
import { StateSelector } from "./components/StateSelector.js";

const INSTALL_SNIPPET = "npm install /path/to/Thinking-Head";

const REACT_SNIPPET = `import { MechIndicator } from "thinking-head/react";

<MechIndicator state="thinking" />`;

export function App() {
  const [state, setState] = useState<MechState>("thinking");
  const plan = STATE_FRAME_PLANS[state];

  return (
    <div className="page" id="top">
      <SiteNav />

      <main>
        <section aria-labelledby="thinking-tf-title" className="hero">
          <div className="rails rails--drawn">
            <BrandMark className="hero__mark" size={40} />

            <h1 className="hero__title" id="thinking-tf-title">
              Thinking TF
            </h1>

            <p className="hero__tagline">Every model lies beyond the transformer.</p>

            <p className="hero__description">
              An open-sourced UI component for each state of your AI agent.
            </p>
          </div>
        </section>

        <section aria-labelledby="states-title" className="states">
          <div className="rails">
            <h2 className="section-mark" id="states-title">
              States
            </h2>

            <div className="stage">
              <figure className="stage__figure">
                <RigOutline label={plan.label} state={state} />
              </figure>
            </div>

            <p className="stage__caption">
              <span className="stage__state">{plan.label}</span>
              <span className="stage__form">
                {STATE_FORMS[state] === "vehicle" ? "Low vehicle" : "Upright machine"}
              </span>
            </p>

            <StateSelector onChange={setState} value={state} />
          </div>
        </section>

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
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="rails">
          <p className="footer__inner">@ Justin Liao</p>
        </div>
      </footer>
    </div>
  );
}
