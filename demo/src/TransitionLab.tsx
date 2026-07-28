import { useMemo } from "react";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "thinking-head";
import {
  auditAllStateTransitions,
  auditHeldFacialState,
  type Camera,
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

const FACIAL_CAMERA: Camera = {
  ...DEFAULT_TUNING.camera,
  yaw: 0,
  pitch: 0,
};

const ENDPOINT_SIZES = [48, 96, 320] as const;

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
    start: "37.25",
  });
  return `?${query.toString()}`;
}

export function TransitionLab() {
  const query = new URLSearchParams(window.location.search);
  const from = stateFromQuery(query.get("from"), "thinking");
  const to = stateFromQuery(query.get("to"), "error");
  const size = Math.round(numberFromQuery(query.get("size"), 96, 16, 320));
  const fps = Math.round(numberFromQuery(query.get("fps"), 60, 12, 60));
  const duration = numberFromQuery(query.get("duration"), 0.8, 0.2, 3);
  const startTime = numberFromQuery(query.get("start"), 37.25, 0, 3600);
  const facialOnly = query.get("view") === "facial";
  const times = useMemo(() => frameTimes(duration, fps), [duration, fps]);
  const audit = useMemo(
    () => auditAllStateTransitions({ fps, duration: 0.8, startTime }),
    [fps, startTime],
  );
  const passedCount = audit.filter((result) => result.passed).length;
  const heldFacialAudit = useMemo(
    () =>
      THINKING_HEAD_STATES.map((state) =>
        auditHeldFacialState(state, { fps, duration: 3, startTime }),
      ),
    [fps, startTime],
  );
  const slowestSettle = Math.max(...audit.map((result) => result.settledAt ?? 0));
  const largestStep = Math.max(...audit.map((result) => result.maxNormalizedStep));
  const largestFacialStep = Math.max(...audit.map((result) => result.maxFacialFrameStep));
  const minimumDirection = Math.min(...audit.map((result) => result.minimumDirectionMagnitude));
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
  const endpointPointSets = useMemo(
    () =>
      ENDPOINT_SIZES.map((endpointSize) => ({
        size: endpointSize,
        pointSet: model.levelForSize(
          endpointSize * dpr,
          DEFAULT_TUNING.sampling.targetCellCss * dpr,
          minimumResolutionForSize(endpointSize),
        ),
      })),
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
          {times.length} exact frames · {fps} fps · {duration.toFixed(2)} seconds · {size}px · phase{" "}
          {startTime.toFixed(2)}s
        </p>
        <form className="transition-lab__controls" method="get">
          <input type="hidden" name="transition-lab" value="1" />
          <label>
            View
            <select name="view" defaultValue={facialOnly ? "facial" : "production"}>
              <option value="production">Production</option>
              <option value="facial">Facial only</option>
            </select>
          </label>
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
            <input name="size" type="number" min="16" max="320" defaultValue={size} />
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
              max="3"
              step="0.1"
              defaultValue={duration}
            />
          </label>
          <label>
            Start phase
            <input
              name="start"
              type="number"
              min="0"
              max="3600"
              step="0.01"
              defaultValue={startTime}
            />
          </label>
          <button type="submit">Load sequence</button>
          <a href="/">Return to demo</a>
        </form>
      </header>

      <section className="transition-lab__section" aria-labelledby="endpoints-heading">
        <div className="transition-lab__section-heading">
          <span>01</span>
          <div>
            <h2 id="endpoints-heading">Facial endpoint gallery</h2>
            <p>
              Fixed camera, neutral white material, and local facial motion only. Head sway,
              shimmer, and semantic tint are removed so the expression must carry the state.
            </p>
          </div>
        </div>
        {endpointPointSets.map(({ size: endpointSize, pointSet }) => (
          <div className="transition-lab__endpoint-row" key={endpointSize}>
            <h3>{endpointSize}px</h3>
            <div
              className="transition-lab__endpoints"
              style={{ "--endpoint-size": `${endpointSize}px` } as React.CSSProperties}
            >
              {THINKING_HEAD_STATES.map((state) => (
                <TransitionFrame
                  key={state}
                  from={state}
                  to={state}
                  time={0}
                  startTime={startTime}
                  fps={fps}
                  size={endpointSize}
                  dpr={dpr}
                  pointSet={pointSet}
                  camera={FACIAL_CAMERA}
                  style={LAB_STYLE}
                  facialOnly
                  caption={state}
                  className="transition-lab__endpoint"
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="transition-lab__section" aria-labelledby="frames-heading">
        <div className="transition-lab__section-heading">
          <span>02</span>
          <div>
            <h2 id="frames-heading">
              {facialOnly ? "Facial-only frame recording" : "Production frame recording"}
            </h2>
            <p>
              Each tile is reconstructed from the selected phase; no wall-clock animation is
              sampled.
            </p>
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
              startTime={startTime}
              fps={fps}
              size={size}
              dpr={dpr}
              pointSet={selectedPointSet}
              camera={facialOnly ? FACIAL_CAMERA : DEFAULT_TUNING.camera}
              style={LAB_STYLE}
              facialOnly={facialOnly}
              className="transition-lab__frame"
            />
          ))}
        </div>
      </section>

      <section className="transition-lab__section" aria-labelledby="matrix-heading">
        <div className="transition-lab__section-heading">
          <span>03</span>
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
              const midpoint = STATE_TRANSITION_RESPONSE[target] * 0.267;
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
                    startTime={startTime}
                    fps={fps}
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

      <section className="transition-lab__section" aria-labelledby="analysis-heading">
        <div className="transition-lab__section-heading">
          <span>04</span>
          <div>
            <h2 id="analysis-heading">Frame analysis</h2>
            <p>Scalar and oscillator continuity at {fps} fps across all 90 directed state pairs.</p>
          </div>
        </div>
        <dl className="transition-lab__summary">
          <div>
            <dt>Passing</dt>
            <dd>
              {passedCount} / {audit.length}
            </dd>
          </div>
          <div>
            <dt>Start jumps</dt>
            <dd>{audit.filter((result) => result.startDiscontinuity > 0).length}</dd>
          </div>
          <div>
            <dt>Overshoots</dt>
            <dd>{audit.reduce((sum, result) => sum + result.overshootCount, 0)}</dd>
          </div>
          <div>
            <dt>Slowest settle</dt>
            <dd>{Math.round(slowestSettle * 1000)}ms</dd>
          </div>
          <div>
            <dt>Largest frame step</dt>
            <dd>{(largestStep * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Largest facial step</dt>
            <dd>{(largestFacialStep * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Living held faces</dt>
            <dd>
              {heldFacialAudit.filter((result) => result.passed).length} / {heldFacialAudit.length}
            </dd>
          </div>
          <div>
            <dt>Min direction length</dt>
            <dd>{minimumDirection.toFixed(2)}</dd>
          </div>
        </dl>
        <div className="transition-lab__table-wrap">
          <table className="transition-lab__table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Frames</th>
                <th>Settle</th>
                <th>Largest step</th>
                <th>Facial step</th>
                <th>End error</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((result) => (
                <tr key={`${result.from}-${result.to}`}>
                  <td>
                    {result.from} → {result.to}
                  </td>
                  <td>{result.frameCount}</td>
                  <td>
                    {result.settledAt === null ? "—" : `${Math.round(result.settledAt * 1000)}ms`}
                  </td>
                  <td>{(result.maxNormalizedStep * 100).toFixed(1)}%</td>
                  <td>{(result.maxFacialFrameStep * 100).toFixed(1)}%</td>
                  <td>{result.endpointError.toExponential(1)}</td>
                  <td>{result.passed ? "pass" : "review"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
