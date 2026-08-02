import { Fragment, useEffect, useState } from "react";
import { type MechState, STATE_FRAME_PLANS } from "thinking-head";
import { MechIndicator } from "thinking-head/react";

const tagline = "Every model lies beyond the transformer.";
const scramble = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?<>/";
const states: readonly MechState[] = ["thinking", "executing", "listening", "searching", "reading"];
const stateBackdrops: Record<MechState, string> = {
  thinking: "/state-backdrops/thinking.jpg",
  executing: "/state-backdrops/executing.jpg",
  listening: "/state-backdrops/listening.jpg",
  searching: "/state-backdrops/searching.jpg",
  reading: "/state-backdrops/reading.jpg",
};
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

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 1.7a10.3 10.3 0 0 0-3.25 20.08c.52.1.7-.22.7-.5v-1.8c-2.86.62-3.46-1.2-3.46-1.2-.47-1.18-1.14-1.5-1.14-1.5-.93-.63.07-.62.07-.62 1.03.08 1.58 1.06 1.58 1.06.92 1.57 2.4 1.12 2.99.85.1-.66.36-1.12.65-1.38-2.29-.26-4.7-1.14-4.7-5.08 0-1.12.4-2.04 1.06-2.76-.11-.26-.46-1.3.1-2.72 0 0 .87-.28 2.83 1.05A9.8 9.8 0 0 1 12 6.8c.87 0 1.75.12 2.57.35 1.96-1.33 2.82-1.05 2.82-1.05.57 1.42.22 2.46.11 2.72.66.72 1.06 1.64 1.06 2.76 0 3.95-2.42 4.81-4.72 5.07.37.32.7.94.7 1.9v2.81c0 .28.19.6.71.5A10.3 10.3 0 0 0 12 1.7Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18.9 2.8h3.3l-7.2 8.25 8.48 10.15h-6.64l-5.2-6.46-5.65 6.46H2.67l7.71-8.81L2.25 2.8h6.8l4.7 5.9 5.15-5.9Zm-1.17 16.4h1.83L8.05 4.69H6.09L17.73 19.2Z" />
    </svg>
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
        <GitHubIcon />
        <span className="sr-only">GitHub</span>
      </a>
      <a className="brand-control" aria-label="TF Thinks" href="#top">
        <span className="sr-only">TF Thinks</span>
        <span className="tf-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span aria-hidden="true" className="brand-word">
          TF Thinks
        </span>
      </a>
      <a
        className="nav-control social-control x-control"
        aria-label="X placeholder"
        href="https://x.com/"
      >
        <XIcon />
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
        <div
          aria-hidden="true"
          className="state-backdrop"
          key={activeState}
          style={{ backgroundImage: `url(${stateBackdrops[activeState]})` }}
        />
        <div aria-hidden="true" className="hero-scrim" />
        <div className="content-frame hero-frame">
          <GlitchTagline />
          <section aria-label="Selected state" aria-live="polite" className="state-stage">
            <div className="stage-portal">
              <MechIndicator key={activeState} size={160} speed={0.82} state={activeState} />
            </div>
            <p>{activePlan.label}</p>
          </section>
          <nav aria-label="Choose a state" className="state-ribbon">
            {states.map((state) => (
              <button
                aria-pressed={state === activeState}
                className="state-choice"
                key={state}
                onClick={() => setActiveState(state)}
                type="button"
              >
                {STATE_FRAME_PLANS[state].label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="guide" aria-labelledby="guide-title">
        <div className="content-frame guide-frame">
          <h2 id="guide-title">Use it locally</h2>
          <p className="guide-intro">
            Install a local checkout into a React project. The package builds before it is
            installed.
          </p>
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
