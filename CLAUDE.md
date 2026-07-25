# CLAUDE.md — Thinking Head

**Single source of truth for this repo. Read this and `PROGRESS.md` at the start of
every session, before doing anything else. Keep both updated as decisions are made.**

---

## 1. What this is

An open source, installable UI component (`npm install thinking-head`) that renders a
small animated 3D particle head as a loading/status indicator for AI products — chat
apps, coding agents, voice assistants, image tools, anything with an "AI is working"
moment.

Instead of an abstract spinner, the indicator is a stylized human head made of particles
that visibly **emotes** according to what the AI is doing: thinking looks like thinking,
searching looks like searching, generating looks like generating.

**The emotional, human-first framing is the entire point of the project.** It is what
separates this from a generic particle effect. Expressive and charming, like a friendly
stylized character — not photorealistic, not uncanny-valley.

### Visual target

- Small, dense, precise: dozens to low-hundreds of tiny tightly-packed particles forming
  a clean, recognisable head silhouette.
- Compact by default — ~20–64px, used inline next to text, matching how loading
  indicators are sized in chat UIs.
- Also capable of a larger, fully interactive 360° orbit view when a developer wants to
  show it bigger or let users drag to rotate.
- Size and animation speed are both configurable props.

---

## 2. Hard constraints — do not violate

1. **Phase 1 is 100% client-side.** Zero external server, zero hosted API, zero API key,
   zero network call required for the head to render and animate. A developer who
   installs the package gets full functionality with nothing to host. This is
   non-negotiable. **If any approach would require a server, stop and flag it to Justin
   rather than proceeding.**
2. **No copying, structural imitation, or naming of any specific comparable open source
   project** — not in code, comments, commit messages, README, or any doc, including
   committed research notes. Research notes that name comparable products live only in
   `research-local/`, which is gitignored. Anything committed describes techniques
   generically (e.g. "offscreen pause via IntersectionObserver") with no project names.
3. **License: MIT**, using GitHub's standard generic MIT LICENSE template. Already
   present at repo root from the initial commit.
4. **README uses GitHub's standard generic README template** as its base structure,
   filled in with this project's real content.
5. **README and LICENSE are FINAL-STEP deliverables.** The README is written only once
   Phase 1 is functionally complete, tested, and Justin has confirmed it is correct. Do
   not scaffold it early as a placeholder. (The current `README.md` is a two-line stub
   from repo creation; it is to be replaced at the end, not built upon — note that its
   current wording closely mirrors a comparable product's tagline, so the final version
   must be written fresh.)
6. **Every change, however small, is its own git commit pushed to main.** Message format
   exactly: `v#.# - Your message here with 1-15 words`, no trailing period, version
   incremented sensibly per change.
7. **Never run destructive git commands** (force push, hard reset, history rewrite)
   without asking Justin explicitly first, even if it looks like the obvious fix.
8. **Public-repo engineering standard.** Cleanly structured and professionally organised,
   not a prototype. Comments are concise and only where they add real value —
   non-obvious logic, perf tradeoffs, the "why". No comment noise on self-explanatory
   code.
9. **Performance is a first-class requirement.** Must run smoothly from low-end phones to
   desktops. Prefer GPU-driven animation (vertex-shader particle displacement/blending)
   over per-frame CPU position updates. Detect device capability and scale particle
   density/quality accordingly.

### Out of scope right now

A public marketing/demo website (hosted live-demo site) is a future phase, after Phases 1
and 2. Do not scaffold or plan it.

---

## 3. Two-phase roadmap

### Phase 1 — "Thinking Head", hand-authored mascot head (BUILD NOW)

One designed head, not derived from any user photo, fully rigged with the state/emotion
system in §4, shipped as a real installable package, 100% client-side.

### Phase 2 — personalised head from a user photo (PLAN ONLY, DO NOT BUILD)

A developer's end users upload their own photo, which is converted into a personalised
particle head via 3D reconstruction, with the same state/emotion rig applied.

- Requires real AI model inference (photo → 3D geometry), which **needs server-side
  compute**. This is the one part of the project expected to break the client-side-only
  rule, and that is acceptable — but it must be documented as an **explicit exception
  scoped only to this optional future feature**, never bleeding into Phase 1.
- **Scoped to self-uploaded photos only** (not photos of other people) to avoid
  consent/likeness issues. State this constraint explicitly in the roadmap doc.
- **One photo is sufficient input** (front-facing, neutral expression). Expressions and
  states are synthesised via rigged deformation of the reconstructed geometry, not
  photographed per-state. Additional angle photos are an optional accuracy improvement,
  not a requirement.
- Documented in a roadmap doc so Phase 1's code and data formats never need rewriting to
  support it. Write it once Phase 1's data format is stable — flag Justin when we get
  there.
- Academic prior art may be cited normally by name (this is standard citation, unrelated
  to constraint 2): GaussianAvatars, FlashAvatar, HeadGaS, Splatshot, and recent
  generalizable single-image full-head Gaussian avatar work.

---

## 4. State and emotion system

Ten core "universal verb" states, each with its own distinct facial/head expression and
particle motion:

| State | Meaning | Expression / motion |
|---|---|---|
| `idle` | Waiting, not yet started | Neutral, relaxed, slow ambient motion |
| `listening` | Receiving input | Head tilt, alert/focused |
| `reading` | Ingesting existing context/data | Eyes scanning, slight head dip |
| `thinking` | Reasoning/planning, no external action | Eyes unfocused/upward, contemplative |
| `searching` | Actively retrieving from an external source | Eyes darting, scanning head motion |
| `executing` | Running a tool/command/action | Sharper, more mechanical, precise |
| `generating` | Producing output | Active outward motion/energy |
| `reviewing` | Self-check/verification pass | Head nod, narrowed focus |
| `error` | Failed or blocked | Brief distinct expression + colour accent |
| `done` | Complete | Brief settle/brighten, then returns to `idle` |

### Modality accents

A lightweight colour **and** motion-texture layer hinting at what kind of model is
running (text vs audio vs vision) without a separate sculpted expression per modality.
Implemented as a post-blend modifier over the same parameter vector — see §5. Carries a
motion component as well as colour so it never becomes colour-alone information.

A mapping reference from common AI product states onto these 10 base states + accents
must be documented for downstream developers, covering:

- **text/LLM** — reasoning, retrieving, planning, acting, writing, verifying
- **audio** — listening, transcribing, composing, synthesising, mixing, analysing
- **vision** — perceiving, rendering, upscaling, segmenting, tracking, compositing

### Critical animation requirements

- **States are NOT one-shot animations.** Each is a continuous, seamlessly loopable
  animation with its own characteristic movement pattern and speed, so a long-running
  state (e.g. thinking for 30 seconds) reads as persistent living motion — never a frozen
  pose, never a jarring repeat.
- **Transitions are smooth interpolation** (blend/crossfade between the two states'
  particle targets and motion parameters), never a hard cut.
- **Transitions must handle being triggered at random, unpredictable times**, because
  real AI state changes are not on a fixed schedule.

### Custom developer-defined states

Letting developers define their own named state with custom expression/motion parameters
via the public API. **Confirmed feasible** — under the parametric architecture (§5) a
custom state is just a JSON-shaped object of the same scalars, so it needs no new
machinery. **Not built in Phase 1**; the architecture simply must not preclude it.

---

## 5. Tech stack and architecture decisions

Approved by Justin 2026-07-24.

| Decision | Choice | Why |
|---|---|---|
| Rendering | Purpose-built **WebGL2**, zero runtime deps, ~10–15 KB gzipped | A general 3D engine is ~155 KB gzipped, tree-shakes poorly, and we'd use one draw call / one shader pair / one camera from it. Bundle size is a product feature for a drop-in indicator |
| Particle primitive | **Instanced billboard quads**, single draw call | Point sprites cap at size 64 on Apple silicon (vs 512–2048 elsewhere) and clip on particle centre. Instancing costs 4× vertex invocations — negligible at our counts |
| Animation | **Parametric deformation** evaluated analytically in the vertex shader | Baked morph targets can't do 10 states × arbitrary blend pairs, and would make custom states impossible without shipping a mesh baker |
| Continuous motion | 4D simplex noise (position as spatial seed, time as 4th dim) + **incommensurate sinusoids** for deliberate rhythms | Neither has a start or end, so entry/exit at any moment is phase-safe and there is no perceptible loop point |
| Geometry | **Procedural, generated in code** — SDF (smooth-min union of quadrics: cranium, brow ridge, nose, jaw, cheeks) sampled to a blue-noise point set at build time | Zero licence surface, no binary assets, fully original, deterministic/seedable, live-tunable — and expressions are parameters of the same generator, so the rig comes free |
| Language | TypeScript, strict | |
| Package | Single package `thinking-head`, exports `.` (core) and `./react` (wrapper, React optional peer) | Framework-agnostic core with thin wrappers; keeps core testable in isolation |
| Build | **Vite library mode**, ESM-only, declarations via `tsc -p tsconfig.build.json` | tsdown was the original choice but cannot be installed by current stable npm (10.9.8) — it trips an arborist peer-resolution bug (`Cannot read properties of null (reading 'edgesOut')`), which would hit every contributor on `npm install`. Vite is already required for the demo, so this removes a dependency rather than adding one |
| Lint/format | Biome | |
| Test | Vitest for the pure core (sampling, blending, tier detection) + Playwright WebGL smoke test | Node has no WebGL, so render tests need a browser |
| Demo | Vite + React on `localhost:5173` | Runs continuously throughout the project |
| Shaders | Tagged template literals | Avoids a bundler plugin; keeps consumer build config at zero |

### The core data format (Phase 2 forward-compatibility)

The runtime consumes a **tagged point set**, never a mesh:

```
positions  Float32Array   rest position per particle (xyz)
normals    Float32Array   surface normal per particle (xyz)
regionId   Uint8Array     facial region tag (eye, brow, mouth, jaw, cranium, …)
weights    Float32Array   per-region rig influence weights
```

Topology, UVs and edge flow are irrelevant to a particle head. Every single-image
reconstruction method in the literature targets a **fixed-topology parametric head
model**, so Phase 2 can assign region tags and rig weights once against that topology and
reuse them for every user — server-side, offline, once per uploaded photo. **Phase 1's
data format therefore never needs to change for Phase 2**, provided it stays a tagged
point set.

A **state** is a vector of ~15–20 named scalar controls (naming discipline borrowed from
standard facial rig conventions: `brow_`, `eye_`, `mouth_`, `jaw_` prefixes). Blending two
states is `mix()` over that scalar vector, not over position buffers. Per-frame CPU work
is writing a handful of uniforms.

### Non-negotiable architectural requirements

- **One WebGL context per page, not per instance.** Browsers cap live contexts at ~16 on
  desktop and as few as 8 on mobile Chrome, evicting the oldest. A chat transcript could
  mount a dozen indicators. A shared renderer driving multiple canvases is required, plus
  explicit context release on unmount and `webglcontextlost` handling.
- **One shared animation clock** across instances so multiple indicators stay in phase.
- **Offscreen pause** via `IntersectionObserver`, plus Page Visibility API for background
  tabs. Largest available power win.
- **DPR capped at 2**, lower on weak devices.
- **Density is a function of rendered pixel size**, evaluated at mount and on resize — a
  design legible at 64px is not the same design at 20px.
- **No per-frame allocation.** Reuse typed arrays and matrices.
- **Canvas 2D fallback** for no-WebGL environments and as the reduced-motion path.

### Accessibility requirements

- `prefers-reduced-motion` **simplifies, never deletes** the indicator — static frame or
  slow opacity breath. Subscribe to changes; the query can flip mid-session.
- `role="status"` + `aria-live="polite"` on a text label; canvas itself `aria-hidden`,
  meaning carried by adjacent visually hidden text.
- `aria-busy` belongs on the **consumer's** loading container, not ours — document it,
  don't set it.
- Never colour alone — binding on `error` and on modality accents.
- Throttle announcements so rapid state changes don't cause screen reader chatter.
- Verify at 200% zoom and with reduced motion enabled.

---

## 6. Workflow

- **Incremental, small reviewable steps — never all at once.** After every meaningful
  step (a design decision, a component milestone, a tuning pass), stop and either show
  Justin something to check/interact with, or ask whether to proceed. **Do not batch
  multiple unreviewed steps.**
- **Use plan mode at the start of each new phase or major component**; get explicit
  go-ahead before executing.
- **The dev server stays running for the whole project.** It is a real localhost server
  Justin opens on his own initiative at any time, not just at checkpoints. Every change
  to the head — shape, a state's expression, particle density, size, speed — must be
  visible and live-tunable there the moment it is saved. Tell him the URL and port, and
  keep it running unless he asks otherwise.
- **The demo page grows into a full showcase**: a gallery view of all completed states
  side by side (grid layout, Storybook-like) for visual comparison, plus live controls
  for size and speed, plus a clearly labelled non-functional placeholder section for the
  Phase 2 photo-upload flow so the layout never needs redesigning.
- **Update `PROGRESS.md` at every session/step boundary.**

### Commit format

```
v#.# - Your message here with 1-15 words
```

No trailing period. Increment sensibly. Every change is its own commit, pushed to main.

---

## 7. Repo layout

```
/
├── src/              published package
│   ├── core/         renderer, geometry, states — no framework
│   ├── react/        React wrapper
│   └── index.ts
├── demo/             Vite showcase, not published
├── docs/             research notes, roadmap
├── research-local/   GITIGNORED — notes naming comparable products
├── CLAUDE.md         this file
└── PROGRESS.md       session continuity
```
