import { useMemo } from "react";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "thinking-head";
import {
  HeadModel,
  minimumResolutionForSize,
  type RenderStyle,
  STATE_TRANSITION_RESPONSE,
} from "thinking-head/dev";
import { TransitionFrame } from "./TransitionFrame.js";
import { DEFAULT_TUNING } from "./tuning.js";

const LAB_STYLE: RenderStyle = {
  color: "#ffffff",
  shape: "disc",
  particleScale: DEFAULT_TUNING.style.particleScale,
  backfaceDim: DEFAULT_TUNING.style.backfaceDim,
  depthDim: DEFAULT_TUNING.style.depthDim,
  featureBoost: DEFAULT_TUNING.style.featureBoost,
  lighting: DEFAULT_TUNING.style.lighting,
};

function stateFromQuery(value: string | null, fallback: ThinkingHeadState): ThinkingHeadState {
  return THINKING_HEAD_STATES.includes(value as ThinkingHeadState)
    ? (value as ThinkingHeadState)
    : fallback;
}

function numberFromQuery(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function frameTimes(duration: number, fps: number): number[] {
  const count = Math.floor(duration * fps);
  return Array.from({ length: count + 1 }, (_, index) => index / fps);
}

function pairUrl(from: ThinkingHeadState, to: ThinkingHeadState, size: number): string {
  const query = new URLSearchParams({
    "transition-lab": "1",
    from,
    to,
    size: String(size),
    fps: "60",
    duration: "0.8",
  });
  return `?${query.toString()}`;
}

export function TransitionLab() {
  const query = new URLSearchParams(window.location.search);
  const from = stateFromQuery(query.get("from"), "thinking");
  const to = stateFromQuery(query.get("to"), "error");
  const size = Math.round(numberFromQuery(query.get("size"), 96, 32, 192));
  const fps = Math.round(numberFromQuery(query.get("fps"), 60, 12, 60));
  const duration = numberFromQuery(query.get("duration"), 0.8, 0.2, 1.2);
  const times = useMemo(() => frameTimes(duration, fps), [duration, fps]);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const model = useMemo(() => new HeadModel(DEFAULT_TUNING.head, DEFAULT_TUNING.features), []);
  const selectedPointSet = useMemo(
    () =>
      model.levelForSize(
        size * dpr,
        DEFAULT_TUNING.sampling.targetCellCss * dpr,
        minimumResolutionForSize(size),
      ),
    [dpr, model, size],
  );
  const matrixSize = 48;
  const matrixPointSet = useMemo(
    () =>
      model.levelForSize(
        matrixSize * dpr,
        DEFAULT_TUNING.sampling.targetCellCss * dpr,
        minimumResolutionForSize(matrixSize),
      ),
    [dpr, model],
  );

  return (
    <main className="transition-lab">
      <header className="transition-lab__header">
        <p>Thinking Head · deterministic motion audit</p>
        <h1>
          {from} → {to}
        </h1>
        <p>
          {times.length} exact frames · {fps} fps · {duration.toFixed(2)} seconds · {size}px
        </p>
        <form className="transition-lab__controls" method="get">
          <input type="hidden" name="transition-lab" value="1" />
          <label>
            From
            <select name="from" defaultValue={from}>
              {THINKING_HEAD_STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label>
            To
            <select name="to" defaultValue={to}>
              {THINKING_HEAD_STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label>
            Size
            <input name="size" type="number" min="32" max="192" defaultValue={size} />
          </label>
          <label>
            FPS
            <input name="fps" type="number" min="12" max="60" defaultValue={fps} />
          </label>
          <label>
            Seconds
            <input
              name="duration"
              type="number"
              min="0.2"
              max="1.2"
              step="0.1"
              defaultValue={duration}
            />
          </label>
          <button type="submit">Load sequence</button>
          <a href="/">Return to demo</a>
        </form>
      </header>

      <section className="transition-lab__section" aria-labelledby="frames-heading">
        <div className="transition-lab__section-heading">
          <span>01</span>
          <div>
            <h2 id="frames-heading">Frame recording</h2>
            <p>Each tile is reconstructed from t=0; no wall-clock animation is sampled.</p>
          </div>
        </div>
        <div
          className="transition-lab__frames"
          style={{ "--frame-size": `${size}px` } as React.CSSProperties}
        >
          {times.map((time) => (
            <TransitionFrame
              key={time}
              from={from}
              to={to}
              time={time}
              size={size}
              dpr={dpr}
              pointSet={selectedPointSet}
              camera={DEFAULT_TUNING.camera}
              style={LAB_STYLE}
              className="transition-lab__frame"
            />
          ))}
        </div>
      </section>

      <section className="transition-lab__section" aria-labelledby="matrix-heading">
        <div className="transition-lab__section-heading">
          <span>02</span>
          <div>
            <h2 id="matrix-heading">Directed-pair matrix</h2>
            <p>
              Every source and target at the target spring’s 50%-distance frame. Select any tile for
              its complete 60 fps sequence.
            </p>
          </div>
        </div>
        <div className="transition-lab__matrix">
          {THINKING_HEAD_STATES.flatMap((source) =>
            THINKING_HEAD_STATES.map((target) => {
              const midpoint = STATE_TRANSITION_RESPONSE[target] * 0.25;
              return (
                <a
                  className="transition-lab__pair"
                  href={pairUrl(source, target, size)}
                  key={`${source}-${target}`}
                >
                  <TransitionFrame
                    from={source}
                    to={target}
                    time={midpoint}
                    size={matrixSize}
                    dpr={dpr}
                    pointSet={matrixPointSet}
                    camera={DEFAULT_TUNING.camera}
                    style={LAB_STYLE}
                    className="transition-lab__matrix-frame"
                  />
                  <span>
                    {source} → {target}
                  </span>
                </a>
              );
            }),
          )}
        </div>
      </section>
    </main>
  );
}
