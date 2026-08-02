import { Fragment, useEffect, useState } from "react";
import { type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { MechIndicator } from "thinking-head/react";

const tagline = "Every model lies beyond the transformer.";
const scramble = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?<>/";
const states: readonly MechState[] = ["thinking", "executing", "listening", "searching", "reading"];
const taglineSlots = [...tagline].map((letter, order) => ({
  letter,
  id: `${letter.codePointAt(0)}-${order.toString(36)}`,
}));

function GlitchTagline() {
  const [letters, setLetters] = useState(() =>
    taglineSlots.map(({ letter }) =>
      letter === " " ? " " : scramble[Math.floor(Math.random() * scramble.length)],
    ),
  );

  useEffect(() => {
    const timers: number[] = [];
    taglineSlots.forEach(({ letter }, index) => {
      if (letter === " ") return;
      const start = 90 + Math.random() * 620 + index * 17;
      const steps = 2 + Math.floor(Math.random() * 5);
      const cadence = 34 + Math.random() * 48;
      for (let step = 0; step <= steps; step += 1) {
        timers.push(
          window.setTimeout(
            () => {
              setLetters((current) => {
                const next = [...current];
                next[index] =
                  step === steps ? letter : scramble[Math.floor(Math.random() * scramble.length)];
                return next;
              });
            },
            start + step * cadence,
          ),
        );
      }
    });
    // A final deterministic pass makes the temporary cipher impossible to linger.
    timers.push(
      window.setTimeout(() => {
        setLetters(taglineSlots.map(({ letter }) => letter));
      }, 1320),
    );
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  return (
    <h1 aria-label={tagline} className="glitch-title">
      {tagline.split(" ").map((word, wordIndex, words) => {
        const start = words.slice(0, wordIndex).join(" ").length + (wordIndex ? 1 : 0);
        return (
          <Fragment key={`${word}-${start}`}>
            <span aria-hidden="true" className="glitch-word">
              {[...word].map((_, letterIndex) => {
                const index = start + letterIndex;
                return <span key={taglineSlots[index]?.id}>{letters[index]}</span>;
              })}
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </h1>
  );
}

function CopyBlock({ children, value }: { children: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <pre className="code-block">
      <code>{children}</code>
      <button aria-label="Copy code" onClick={copy} type="button">
        {copied ? "Copied" : "Copy"}
      </button>
    </pre>
  );
}

function LiquidNavigation() {
  return (
    <nav className="masthead" aria-label="Primary navigation">
      <a
        className="nav-control social-control github-control"
        aria-label="GitHub placeholder"
        href="https://github.com/"
      >
        <span aria-hidden="true">GH</span>
        <span className="sr-only">GitHub</span>
      </a>
      <a className="brand-control" aria-label="TF Thinks" href="#top">
        <span className="sr-only">TF Thinks</span>
        <span aria-hidden="true" className="brand-word brand-word-left">
          TF
        </span>
        <span className="tf-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span aria-hidden="true" className="brand-word brand-word-right">
          Thinks
        </span>
      </a>
      <a
        className="nav-control social-control x-control"
        aria-label="X placeholder"
        href="https://x.com/"
      >
        <span aria-hidden="true">𝕏</span>
        <span className="sr-only">X</span>
      </a>
    </nav>
  );
}

export function App() {
  const [activeState, setActiveState] = useState<MechState>("thinking");
  const activePlan = STATE_FRAME_PLANS[activeState];

  return (
    <main className="site-shell" id="top">
      <LiquidNavigation />
      <section aria-label="TF Thinks" className="hero">
        <div className="content-frame hero-frame">
          <p className="folio">01 / 02</p>
          <GlitchTagline />
          <section className="states-section" aria-label="Five states">
            {states.map((state, index) => (
              <button
                aria-pressed={state === activeState}
                className="state-choice"
                key={state}
                onClick={() => setActiveState(state)}
                type="button"
              >
                <span>0{index + 1}</span>
                <span>{STATE_FRAME_PLANS[state].label}</span>
              </button>
            ))}
          </section>
          <section aria-live="polite" className="state-stage">
            <p>0{states.indexOf(activeState) + 1} / 05</p>
            <MechIndicator key={activeState} size={152} speed={0.82} state={activeState} />
            <h2>{activePlan.label}</h2>
          </section>
        </div>
      </section>

      <section className="guide" aria-labelledby="guide-title">
        <div className="content-frame guide-frame">
          <p className="folio">02 / 02</p>
          <h2 id="guide-title">Use it locally</h2>
          <CopyBlock value="npm install /path/to/Thinking-Head">
            npm install /path/to/Thinking-Head
          </CopyBlock>
          <h3>React</h3>
          <CopyBlock
            value={
              'import { MechIndicator } from "thinking-head/react";\n\n<MechIndicator state="thinking" />'
            }
          >
            {
              'import { MechIndicator } from "thinking-head/react";\n\n<MechIndicator state="thinking" />'
            }
          </CopyBlock>
        </div>
      </section>

      <footer>
        <div className="content-frame">@ Justin Liao</div>
      </footer>
    </main>
  );
}
