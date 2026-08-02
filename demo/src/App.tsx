import liquidGL from "liquid-gl";
import { useEffect, useState } from "react";
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
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  return (
    <h1 aria-label={tagline} className="glitch-title">
      {letters.map((letter, index) => (
        <span aria-hidden="true" key={taglineSlots[index]?.id}>
          {letter}
        </span>
      ))}
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
  useEffect(() => {
    if (
      window.innerWidth < 681 ||
      window.matchMedia("(prefers-reduced-transparency: reduce)").matches
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (document.documentElement.dataset.tfLiquidNavReady === "true") return;
      document.documentElement.dataset.tfLiquidNavReady = "true";
      liquidGL({
        target: ".liquidGL",
        snapshot: ".hero",
        resolution: 0.75,
        refraction: 0.008,
        bevelDepth: 0.06,
        bevelWidth: 0.18,
        frost: 0.4,
        shadow: false,
        specular: true,
        reveal: "fade",
        tilt: false,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="liquidGL masthead-surface" />
      <nav className="masthead" aria-label="Primary navigation">
        <a className="brand" href="#top">
          <span className="tf-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>TF Thinks</span>
        </a>
        <div className="social-links">
          <a aria-label="GitHub placeholder" href="https://github.com/">
            <span aria-hidden="true">GH</span>
            <span className="sr-only">GitHub</span>
          </a>
          <a aria-label="X placeholder" href="https://x.com/">
            <span aria-hidden="true">𝕏</span>
            <span className="sr-only">X</span>
          </a>
        </div>
      </nav>
    </>
  );
}

export function App() {
  return (
    <main className="site-shell" id="top">
      <LiquidNavigation />
      <section className="hero" aria-labelledby="hero-title">
        <p className="folio">01 / 03</p>
        <GlitchTagline />
        <p className="hero-index" id="hero-title">
          TF Thinks
        </p>
      </section>

      <section className="states-section" aria-label="Five states">
        {states.map((state, index) => (
          <article className="state-space" key={state}>
            <p>0{index + 1}</p>
            <MechIndicator size={index === 1 ? 82 : 68} speed={0.78} state={state} />
            <h2>{STATE_FRAME_PLANS[state].label}</h2>
          </article>
        ))}
      </section>

      <section className="guide" aria-labelledby="guide-title">
        <p className="folio">02 / 03</p>
        <h2 id="guide-title">Installation Guide</h2>
        <CopyBlock value="npm install thinking-head">npm install thinking-head</CopyBlock>
        <h3>Usage</h3>
        <CopyBlock
          value={
            'import { MechIndicator } from "thinking-head/react";\n\n<MechIndicator state="thinking" />'
          }
        >
          {
            'import { MechIndicator } from "thinking-head/react";\n\n<MechIndicator state="thinking" />'
          }
        </CopyBlock>
      </section>

      <footer>by Justin Liao</footer>
    </main>
  );
}
