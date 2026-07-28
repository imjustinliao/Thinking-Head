# PROGRESS

**Resume protocol:** read `CLAUDE.md` first, then this file. Between them they carry
full project context — a fresh session, a new context window, or a different coding
agent should be able to pick up from here without Justin re-explaining anything.

Updated at every session and step boundary.

---

## Status

| | |
|---|---|
| **Phase** | Phase 1 — "Thinking Head", hand-authored mascot head |
| **Step** | **Ten animated facial identities are rebuilt, frame-audited and independently approved.** Awaiting Justin's visual review |
| **Last implementation commit** | `52ab1a7` — v13.1 - Gate facial transitions and endpoint geometry |
| **Dev server** | Running at **http://localhost:5173** (`npm run dev` from repo root) |
| **Blocked on** | Nothing technical; Justin's visual review is the current checkpoint |

---

## Just completed

- **Research (first actions §1).** Written up in `docs/research-notes.md`, following the
  citation/naming rules — no comparable-product names in any tracked file (verified by
  scan on every commit). Notes that do name them live in gitignored `research-local/`.
- **Tech stack and geometry route approved (first actions §2).** Decision table in
  `CLAUDE.md` §5.
- **`CLAUDE.md` and `PROGRESS.md` written (first actions §3).**
- **Package scaffolded.** TypeScript strict (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Vite library build, Biome,
  Vitest installed. `npm run typecheck`, `npm run lint` and `npm run build` all pass
  clean.
- **State contract defined** in `src/core/states.ts` — the ten states, the three modality
  accents, and default screen-reader labels. This is the package's public surface so far.
- **Demo showcase live** at `localhost:5173` with the full layout already final: inline
  usage sample, ten-state gallery grid, large interactive view section, and a labelled
  non-functional Phase 2 photo-upload placeholder. Size and speed controls are wired.
  `HeadSlot` is a placeholder that reserves exactly the space the real head will occupy,
  so swapping in the component is a one-line change per call site.

### Static head rendering milestone (v1.1–v1.6)

The geometry pipeline is built and a real head renders in the demo, live-tunable.
`docs/research-notes.md` §5 and `CLAUDE.md` §5 hold the reasoning; this records what was
learned building it.

- **Pipeline:** `sdf.ts` (smooth-min union of quadrics) → `sample.ts` (shell rejection,
  Newton projection, weighted progressive elimination) → `landmarks.ts` (explicit eye,
  brow, mouth clusters) → `geometry.ts` → tagged point set → `render/canvas2d.ts`.
- **Generator is dev-only.** It lives in `src/core/` but is reachable only from
  `src/dev.ts`, which is absent from `package.json` exports. Verified: `dist/index.js` is
  still 0.59 kB and contains no generator code. The package will ship a **baked** point
  set; the runtime consumes a point set either way, which is what keeps Phase 2 compatible.
- **Ordering is done in two passes, and this is not optional.** A single elimination down
  to the target picks *which* particles survive but leaves them in arbitrary index order —
  and since feature clusters are appended to the cloud last, every eye and brow landed at
  the *end* of the output, breaking small-size legibility outright. Selection and ordering
  are separate problems. The `geometry.test.ts` legibility tests exist to catch exactly
  this regression.
- **The ordering pass runs in octaves.** Halve the set, grow the radius, repeat. One fixed
  radius cannot work: sized for the dense end the sparse end finds no neighbours and the
  first few dozen particles end up arbitrarily ordered; sized for the sparse end it
  degenerates to all-pairs and measured **81ms**. Octaves brought it to **~30ms**.
- **Normals come back from the projection**, not from a separate `sdHeadNormal` call — the
  gradient computed on the final Newton iteration *is* the normal, and asking again cost six
  redundant field evaluations per particle.
- **Particle radius derives from spacing** (`device / sqrt(count)`), not canvas size. A
  size-only radius made dense heads overlap into one solid white silhouette with no face.
- **Framing uses measured centre and radius** from the actual points, stored on the point
  set. Deriving it from the bounding-box corner rendered the head far too small, and not
  re-centring let asymmetric tuning shove it off-canvas.
- **`REGION_INTENSITY` gives the face internal structure.** With every region at one
  intensity the eyes vanish into the cheeks and only the outline reads. Structural surface
  is dimmed, features stay bright.
- **Density curve is superlinear** (`t ** 1.6`). An exponent below 1 put 115 particles on a
  20px head; strict area scaling (2) would put under a dozen. Current curve: 46 particles
  at 20px through 1400 at 256px, with dot radius drifting 0.88px → 2.05px.

Shape defaults are a first pass and expected to move — that is what the tuning panel is
for. `smoothK` is the biggest single charm lever; a large value dissolves the jaw and the
head loses its chin.

### Proportional-legibility pass (v1.8–v2.1, after Justin's first shape review)

Justin's review: facial structure fell apart at small sizes, and the head needed real
anatomical definition. Root causes found and the rules now in force:

- **Definition comes from the SDF, not dot count.** Nose is a bridge→tip chain of spheres
  with alar wings (a buried ellipsoid never shows in profile); chin is an explicit ball
  (`chinBoss`) — the jaw taper alone spikes it; cheek mass defaults moved up and forward
  (zygomatic, not jowl). Mouth is two lip strokes converging at the corners; explicit nose
  landmark dots make the nose read front-on.
- **Small sizes are a different rendering regime, not a scaled-down large one.** Three
  mechanisms, all size-driven:
  1. **Tiered feature promotion** (`geometry.ts`): tier A = 1 dot/eye + 2 mouth dots at the
     very front of the ordering; tier B (more eye, brows, nose) enters at position ~40.
     Promoting *more* features at 36 particles fuses them into a blob — the first quota
     attempt proved this. Cluster cores are picked by landmark weight.
  2. **Glyph mode** (`canvas2d.ts`, ≤32px): far-side dots culled entirely (they only stack
     alpha), skin dots shrink to 0.8× and dim to 0.58×, features keep full strength.
  3. **Pose eases toward face-on as size shrinks** (`HeadSlot.tsx`): the ¾ turn that looks
     alive at 256px smears features sideways at 20px.
- **Far-side features are always culled, at every size** (`isFeatureRegion`): a dimmed eye
  showing through the skull reads as a smudge stuck to the silhouette.
- **Emphasis multipliers compound — keep the product ≤ ~1.5×.** Region draw scale ×
  size emphasis at 1.9× total merged the eyes into one mass; current tables are tuned to
  stay under that.
- Verified ladder: 20px = two eyes + mouth glyph; 32px adds shape; 48px adds brows and a
  smile; 64px+ full structure. Regeneration median ~34ms (target 30; the SDF grew from ~6
  to ~11 primitives for the definition — `candidates` in the panel trades quality for
  speed if needed).
- Browser-pane note: `location.reload()` via the JS tool wedges the pane; use `navigate`
  with `force: true` instead.

### Sculpted-realism pass (v2.3–v2.5, Justin's second review)

Justin reaffirmed the realism direction with dense particle-head artwork as the target
look, so the "charming vs uncanny" default is now settled in favour of **defined adult
realism carried by the particle medium** — recorded in `CLAUDE.md` §1. What changed:

- **Eye sockets are carved into the SDF** (smooth subtraction, `smax`) after the base
  masses and before the nose, so the brow overhangs them and the nose bridge stands
  between them. Adult default proportions: less cranium lift, longer jaw.
- **A fixed key light (upper-front-left) + Lambertian shading** in the renderer, driven by
  each particle's view-space normal. One `lighting` knob (style + slider).
- **Baked per-particle ambient occlusion** — new `occlusion` channel in `HeadPointSet`,
  two field probes along the normal at generation time. This was the missing piece:
  directional light cannot darken a concavity whose floor faces the light; occlusion is
  what makes sockets and creases read dark. Tap radii must stay near feature scale
  (0.055/0.13) — wider taps murk the whole mid-face. Renderer floor 0.4.
- **Region brightness fades toward uniform above ~96px** (features only ~half-way), so the
  large head reads from shading like a sculpture instead of painted-on bright dots, while
  small sizes keep the glyph/feature coding. The full size continuum: glyph ≤32px →
  feature-coded mid → sculpted ≥96px.
- **Density defaults up:** maxParticles 1800, candidates 15000. Regen median ~28ms —
  within the 30ms budget (occlusion adds only 2 field evals per particle).
- **Demo gallery is now status pills**: head + label with a sweeping light-band shimmer
  (base text dim; `::before` duplicate via `content: attr(data-text)`, gradient band,
  `background-clip: text`, `background-position` keyframes ~2.2s). Under reduced motion
  the overlay is hidden entirely — a frozen mid-sweep band reads as a glitch. Pill head
  size clamps to 24–64px so pills keep their shape while the size slider demos the full
  range elsewhere.
- Motion note for the upcoming `idle`/state milestones: Justin wants the swarm quality of
  organised, purposeful micro-motion ("nano robots"), not loose drift.

### WebGL2 renderer + shared context (v2.7–v2.9)

- **One GL context per page, refcounted.** `render/webgl/sharedContext.ts` owns a single
  offscreen GL canvas; each instance renders into it and the result is blitted onto the
  instance's own 2D canvas with `drawImage`. Instances therefore hold only cheap 2D
  contexts. Verified: 12 mounted heads, **0 holding a GL context**; and 30 instances (well
  past the browser's ~8–16 limit) all render, twice, with a full teardown between.
- **`render/shading.ts` is the single source of the size-dependent rules** (radius from
  spacing, feature emphasis, glyph mode, sculpt ramp, light constants). Both backends read
  it, so the fallback cannot silently look different from the GPU path.
- **No CPU depth sort on the GPU path** — the depth buffer resolves occlusion. Linear depth
  into NDC. This is the main structural win over the 2D path, which must sort every frame.
- **Progressive ordering pays off again:** drawing the first N particles is just
  `drawArraysInstanced(..., count)`. No index buffer, no per-size geometry.
- **Measured:** WebGL 0.006ms/frame vs Canvas 2D 0.316ms/frame at 220px/1396 particles —
  **~53× faster**. Backend parity 94.5–98.4% of painted pixels, mean alpha delta 3–5%.
- **Two real bugs found by measuring parity, not by eyeballing:**
  1. The billboard quad was sized *exactly* to the disc radius, so the fragment shader could
     never see the outer ring of partially covered pixels Canvas 2D still paints — the head
     came out ~20% short on ink at every size. The quad is now padded 1px and coverage is
     computed in real pixel units. Parity went 70–80% → 94.5–98.4%.
  2. Before that, an edge falloff expressed as a *fraction* of the radius. At typical
     densities a disc is only ~1.6px across, so a fractional band eats the whole dot. Any
     future edge/AA work must be in pixel units.
- Remaining ~10–15% ink difference is legitimate: the depth buffer rejects hidden particles
  and does not accumulate alpha where dots overlap, whereas the 2D painter's-algorithm path
  blends them. The GPU path is the more correct of the two.
- **Note for future work:** `premultipliedAlpha` on the GL context turned out to make *no*
  measurable difference to `drawImage` output — the pairing is kept correct
  (`premultipliedAlpha: true` + `ONE / ONE_MINUS_SRC_ALPHA` + premultiplied fragment output)
  but it is not the cause of any brightness issue, so do not chase it as one.
- Still to do on the renderer: offscreen pause (`IntersectionObserver`) and Page Visibility,
  shared animation clock, device-capability tiering. These belong with the motion milestone,
  since there is nothing to pause until the head animates.
- **Verification harness worth reusing:** the demo's dev entry can be imported straight from
  the browser console via `/@fs/<abs path>/src/dev.ts?bust=<n>` (the cache-buster is
  required — without it a stale module is silently reused, which made one measurement look
  unchanged). That is how backend parity and per-frame cost were measured.

### Constant particle size + three size tiers (v3.1–v3.3) — the governing render rule

Justin's diagnosis, and it was correct: **a particle is always the same size. A bigger head is
more dots, not bigger dots.** The previous model derived dot radius from particle *spacing*
(`device / sqrt(count)`), which inverted the rule — fewer particles meant wider spacing meant
fatter dots, so a 32px head rendered as ~59 blobs of 2.17px radius instead of a face. That is
the "small heads look low-resolution" complaint, and no amount of feature emphasis fixes it.

Rules now in force, all in `render/shading.ts` and covered by tests:

- **`DOT_RADIUS_CSS = 1.05`**, constant at every rendered size, multiplied by DPR so a
  high-DPR screen gets a *sharper* dot of the same apparent size, not a bigger one. Radius
  must never be a function of count or size again — there are regression tests for both.
- **`PARTICLE_DENSITY = 0.18` particles per CSS px².** Count scales with *area*, so doubling
  the size quadruples the count and density stays constant. Derived from geometry (head disc
  ≈ 0.42·size radius, ~60% areal coverage, doubled for the far hemisphere), not guessed.
  Measured ladder: 20px→72, 32px→184, 48px→415, 72px→933, 128px→2949.
- **`REGION_DRAW_SCALE` is all 1.0 and `featureBoost` defaults to 0.** Enlarging feature dots
  was a crutch for an under-populated head; with a correct count the features read from
  placement and density. Both knobs are kept for the rig but are neutral by default.
- **Three tiers** (`glyph` ≤40px, `compact` ≤120px, `display` >120px) control only how much
  *modelling detail* the size can carry — never dot size or density:
  - `glyph`: lighting ×0.22 (shading detail reads as damage at that scale), far hemisphere
    culled, pose face-on, particle floor 70.
  - `compact`: lighting ×0.62, pose ×0.55, floor 150.
  - `display`: full lighting and pose, floor 400.
- Defaults raised to `maxParticles: 3200`, `candidates: 26000` to feed the display tier.

**Cost, honestly:** regeneration is now ~46ms median (was ~28ms), over the 30ms live-tuning
target, because the cloud must be large enough to eliminate down to 3200. Acceptable for now:
it is a tuning-time cost only, `useDeferredValue` keeps the sliders responsive, and the shipped
package will consume a **baked** point set with zero generation at runtime. The `candidates`
slider trades cloud quality for speed if it becomes annoying.

### Voxel-lattice rewrite (v3.5–v3.7) — superseded geometry history

Justin's reference imagery (dense voxel/cube heads, I, Robot-style) made the problem clear:
in all of it the particles sit on a **regular lattice**, tiling the surface contiguously.
Scattered points cannot produce that however carefully spaced — the legibility comes from
neighbouring cells lining up in rows, which is exactly what blue noise destroys. So sampling
was replaced wholesale.

- **`voxel.ts` — hierarchical narrow-band surface voxelisation.** Refines power-of-two
  *blocks of the target lattice*, halving to single cells. Cost is O(surface area), not
  O(volume). The field is a true SDF hence 1-Lipschitz, so the `|sdf| <= side·sqrt(3)/2`
  test is conservative and cannot miss geometry. A final tighter pass (0.58·cell) trims the
  shell from ~2 cells thick to one.
  - **Refinement must work in target-lattice indices.** An earlier version chained
    intermediate resolutions (8→16→32→48); the last step's factor rounds, children get
    addressed on a 64-lattice while evaluated as 48, and **every cell is pruned — res 48
    produced 0 particles.**
  - Also fixed here: the subdivision built `nextCount` children but the prune ran over the
    stale `cellCount`, silently processing 1/8 of them.
- **`sample.ts` is deleted.** Blue-noise elimination, progressive ordering and feature-tier
  promotion are all gone — the lattice makes them unnecessary. Density is chosen by picking
  a resolution, not by truncating an ordering.
- **Features are lattice *tags*, not extra particles** (`landmarks.ts`). Adding points for
  eyes would break uniform spacing, which is the one rule the model rests on. Anchors
  classify cells that already exist.
- **LOD via `HeadModel`.** Eight resolutions (12…136, ~1.4× apart), built lazily and cached.
  `levelForSize` picks the level whose cells land near `TARGET_CELL_CSS` (1.6 CSS px) on
  screen — this is what holds particle size constant while head size varies. Close spacing
  matters: the gap between levels is the most a particle's screen size can drift.
- **Particles are squares that tile their cell** (`CELL_FILL = 0.82`, leaving a hairline
  seam). Round particles read as scattered dots no matter how dense; square is what makes
  the grid read as structure.
- **`REGION_INTENSITY` is now albedo, and features are *darker* than skin.** The old table
  painted eyes at full brightness against dimmed skin — a crutch from when eyes were a few
  scattered dots with no geometry behind them. Against carved sockets plus occlusion it
  showed up as glaring white patches exactly where sockets should read dark. The sculpt
  flattening (`sculptT`/`SCULPT_UNIFORM_ALPHA`/`FEATURE_FLATTEN_RATIO`) existed only to
  reconcile those two models and is deleted.
- **Contrast:** `AMBIENT` 0.28→0.10, `OCCLUSION_FLOOR` 0.4→0.08, occlusion squared to
  sharpen, default lighting 0.95. A generous ambient flattens the head into a uniform bright
  mass; recesses must go genuinely dark for the form to read.

**Measured.** Draw: **0.03 ms/frame at 39,004 particles** (256px) — instancing plus the
depth buffer make particle count nearly free, so the size ladder costs almost nothing.
Generation is lazy and cached: 2.4 ms at r12, 9.8 ms at r34 (the common inline levels),
88 ms at r136 — paid once, and only if a display-size head is actually shown.
Ladder: 20px→r12/300 cells, 32px→r24/1192, 48px→r34/2422, 96px→r68/9806, 256px→r136/39004.

**Research inputs** (see `docs/research-notes.md`): variance/detail-adaptive voxel grids for
LOD ("resolution where it counts"), and hierarchical rasterisation-style voxelisation.
Licensed parametric head models (FLAME/BFM) were re-checked and rejected: registration,
attribution and a binary asset all conflict with the MIT/zero-asset constraints.

### `idle` and the motion system (v4.0)

The first continuous motion, and the machinery every other state will reuse.

- **`motion.ts` — `MotionParams`, a scalar vector per state.** Blending two states later is
  `mix()` over these scalars, exactly as the architecture requires. Only `idle` is tuned; the
  other nine inherit it so nothing renders frozen before its milestone.
- **Built from sinusoids at irrational ratios**, not keyframes. Two consequences fall straight
  out of that and both are hard requirements: the combined period is effectively infinite so
  there is no perceptible loop, and a sinusoid has no start or end so entering a state at an
  arbitrary moment is always phase-safe. There is no timeline to be part-way through.
- **Phase is seeded from each particle's rest position**, not from a per-particle random value.
  This is what makes the motion read as a purposeful swarm rather than static: neighbours sit at
  nearly the same phase and move together, so the surface ripples as a body. Tested directly.
- **Amplitudes are in lattice cell units**, so motion is the same visual magnitude at every LOD.
  In world units a wobble would be invisible on a fine lattice and violent on a coarse one.
- **Sway rotates the head as a rigid body** via the camera basis — two trig calls per frame
  rather than the same work repeated per particle, and it actually looks like a head turning.
- **`clock.ts` — one clock for the page.** Verified: ten visible instances are *pixel-identical*
  (mean alpha difference 0.000), which is only true with a single shared time source.
  Per-instance rAF loops start at different moments and immediately drift apart.
- **Offscreen pause verified end to end**: scrolled away → 0 listeners and the loop stopped;
  scrolled into view → 10 listeners, running. Instances unsubscribe entirely rather than
  rendering into a canvas nobody sees. Page Visibility pause is wired the same way.
- **`prefers-reduced-motion` simplifies, never deletes** — the head still renders fully shaded,
  it just holds still, so the status signal survives the preference. Subscribed live, since the
  preference can flip mid-session.
- **The clock degrades outside a browser.** `requestAnimationFrame` is absent under SSR and in
  the test runner, so scheduling is resolved once with a `setTimeout` fallback; importing the
  package server-side must not throw.

**Verification note that cost time:** the first animation check measured zero movement, which
looked like a broken motion system. It was the offscreen pause working correctly — the sampled
canvas was below the fold. Isolating the renderer (drawing the same frame at t=0 and t=3.7)
showed 3510 changed pixels on WebGL and 2583 on Canvas 2D, proving the motion path was fine and
pointing at the test, not the code. **Sample a canvas that is actually on screen.**

**Real bug found after that, by Justin visually inspecting the pills (v4.2):** even with the
clock and pause verified, `idle` still looked static side by side. Root cause was a genuine
design flaw, not a tuning miss — positional amplitudes are in **lattice cell units**, and the
LOD system deliberately holds one cell to a near-constant on-screen size (~1.6px, that's the
whole point of the LOD scheme). So even a generous positional amplitude is a sub-pixel wobble
at inline sizes, invisible regardless of how the numbers are tuned — pushing amplitude higher
to compensate would move particles out of their tiled cells and break the voxel-grid look.
**Fix:** added `shimmerMultiplier` — a travelling brightness band (`shimmerAmplitude/Scale/Speed`
in `MotionParams`) applied as an alpha multiplier in both backends, independent spatial/temporal
rate from the positional wave. Brightness has no sub-pixel floor: it reads at any particle size
because it changes colour, not position. This is now the **primary** carrier of "alive" at
inline sizes; position remains the carrier at display sizes where it's actually visible.
Verified: max per-particle alpha swing 241/255 on a 48px pill; 29,228 changed pixels on the
320px orbit view. Regression tests lock in non-zero shimmer for every state so this can't
silently regress back to sub-pixel-only motion.

### Tuned state motion (v4.5–v5.8)

All ten states now have distinct continuous motion signatures. The gallery pills drive the inline
sample and orbit head, so each state can be selected and reviewed in the live demo.

- **`listening` (v4.5):** held lateral tilt, suppressed ambient wandering, and a quicker,
  brighter attentive shimmer.
- **`reading` (v4.6):** chin dipped toward the material, horizontal line-following shimmer,
  and lateral sway rather than a nod.
- **`thinking` (v4.7):** lifted unfocused gaze, deepest slow breath, broadest slow shimmer,
  and a wide wandering sway.
- **`searching` (v4.8):** a slow wide scan with a second incommensurate fast yaw layered over
  it, producing extra saccadic reversals rather than a smooth pendulum. Its horizontal shimmer
  is tighter, faster and brighter than reading's.
- **`executing` (v5.0):** the lowest breath and camera sway in the tuned set, with a strict
  vertical processing band and fast fine lattice texture. Added `shimmerHarmonic`, an opt-in
  normalised third harmonic that sharpens a sinusoidal brightness wave without discontinuities
  or exceeding its configured amplitude. Earlier states keep it at zero and are mathematically
  unchanged. Verified in the live WebGL demo with no browser errors; 90 tests, typecheck, lint
  and build pass.
- **`generating` (v5.2):** a bounded non-negative normal pulse pushes lattice cells from rest
  outward and back, while concentric brightness rings travel toward larger facial radii so the
  same emitted-energy idea remains visible at inline sizes. Added opt-in `outwardAmplitude` and
  `shimmerRadial` controls with matching Canvas/WebGL formulas; every earlier state keeps both at
  zero and is mathematically unchanged. Verified in the live WebGL demo with no browser errors;
  96 tests, typecheck, lint and build pass.
- **`reviewing` (v5.4):** the largest pitch sway in the tuned set produces a restrained repeated
  nod, while mirrored horizontal brightness fronts move inward from both sides toward the facial
  centreline. Added opt-in `shimmerMirror` with matching Canvas/WebGL formulas; every earlier
  state keeps it at zero and is mathematically unchanged. Verified in the live WebGL demo with no
  browser errors; 102 tests, typecheck, lint and build pass.
- **`error` (v5.6):** a fast, wide secondary yaw produces a clear lateral rejection while
  sharpened concentric brightness rings contract inward—the inverse of generating's outward
  energy. The demo applies the alarm accent to Error's particles and active interface, while the
  motion keeps the state legible without colour. Verified in the live WebGL demo with no browser
  errors; 108 tests, typecheck, lint and build pass.
- **`done` (v5.8):** the smallest movement envelope in the active set settles into Idle's
  neutral pose, with an opt-in uniform brightness lift that keeps every particle above its normal
  shaded level and a slow broad glow that remains alive if held. The demo applies a green
  completion accent. Done defines the endpoint only; the later transition controller owns the
  brief hold and smooth return to Idle. Verified in the live WebGL demo with no browser errors;
  114 tests, typecheck, lint and build pass.

These milestones tune **motion and whole-head posture**. Per-region facial deformation now runs
in both renderers, but every named state deliberately remains at the neutral expression until its
own reviewed tuning milestone.

- **Glyph landmark floor (v6.0):** LOD selection now accepts the active size tier's minimum
  lattice resolution, so a 16px DPR-1 head cannot fall back to the 12-cell lattice that has eyes
  but no mouth. Higher-size density selection is unchanged. Verified in the live WebGL demo at
  16px (resolution 17, 596 particles, one GL context, no runtime errors); 115 tests, typecheck,
  lint and build pass.
- **Expression rig foundation (v6.2):** `ExpressionParams` defines 18 bounded scalar controls
  across brows, eyes/gaze, cheeks, nose, mouth and jaw. Region centres and extents are derived
  from any tagged point set and cached by identity, so neither the current procedural geometry
  nor a future Phase 2 point set needs hard-coded facial coordinates or a changed data format.
  `deformExpressionPoint` writes deformed position plus normal into caller-owned scratch with no
  per-point allocation; jaw articulation rotates its normals, and every control is tested for
  target-region isolation. No renderer consumes it yet, so this milestone has no intended visual
  change. 123 tests, typecheck, lint and build pass; the public bundle remains 0.59 kB.
- **Expression renderer integration (v6.4):** `RenderFrame` now carries the expression vector.
  Canvas 2D evaluates the allocation-free CPU kernel before continuous motion; WebGL uploads the
  existing rig weight, packed controls and cached region metrics, then mirrors the same equations
  in the vertex shader. Motion and shimmer keep immutable rest-space phase seeds, so changing a
  face cannot make its continuous loop jump. The demo exposes all 18 controls in one manual
  sandbox shared across sizes, with neutral defaults and reset; named state presets remain
  neutral. Live verification compiled the WebGL shader with one shared context, exercised an
  exaggerated mouth/jaw pose in both backends, restored neutral, and found no browser warnings or
  errors. 123 tests, typecheck, lint and build pass; the public bundle remains 0.59 kB.
- **`listening` expression (v6.6):** added the state-expression registry with `idle` as the
  neutral baseline and every untuned state explicitly sharing it. Listening lifts both brows
  (`0.4`), adds a smaller inner lift (`0.1`), opens both eyes (`0.5`) and lightly presses the
  mouth (`0.15`), producing receptive attention without gaze diversion, surprise or a negative
  furrow. The demo now renders reviewed presets by default; its sliders become a temporary
  all-size manual override, and selecting a state or resetting returns to presets. The same
  listening motion was compared live with neutral and tuned faces at pill and orbit sizes.
  WebGL2 remained on one shared context with no browser warnings; 126 tests, typecheck, lint and
  build pass.
- **`reading` expression (v6.8):** lowers both brows (`-0.1`), narrows both eyes (`-0.15`),
  lowers the gaze (`-0.3`) and lightly presses the mouth (`0.1`). Paired with Reading's chin dip,
  horizontal line-following shimmer and lateral head motion, it reads as sustained concentration
  rather than Listening's alert attention. Furrow stays neutral so it does not drift into
  Reviewing or frustration, and every later untuned state still shares the neutral baseline.
  The same Reading motion was compared live with neutral and tuned faces at pill and orbit sizes.
  WebGL2 remained on one shared context with no browser warnings; 128 tests, typecheck, lint and
  build pass.

### Expression and anatomy review (2026-07-26)

Justin rejected the current facial result against dense particle-head references: it does not
read as an accurate human face, and the ten states appear to share the same eyes, nose, mouth and
overall structure. The live review confirms both points.

- Seven active states (`thinking` through `done`) still intentionally use the exact neutral
  expression vector. Only `listening` and `reading` have tuned presets, and those controls move
  narrow tagged bands by small amounts; they cannot create missing eyelids, lips or facial planes.
- The neutral base is the primary failure. Its union of ellipsoids and spheres produces a bulbous
  cranium, oversized spherical socket cavities, a weak segmented nose and a pinched lower face.
  The mouth is a tagged surface band rather than sculpted lip/oral anatomy.
- Further preset tuning is paused. The current renderer, shared clock, motion system, point-set
  contract and region rig remain useful, but expression work should not resume until the neutral
  canonical head is replaced and visually approved.
- The supplied first screenshot path was unavailable, so the current result was inspected directly
  in the live demo. All three available references were reviewed. WebGL2 remained on one shared
  context with no runtime warnings.

### Facial-realism direction (2026-07-26)

Justin explicitly brought the dedicated realism pass forward and requested a fundamental redo.
Further named-expression tuning stays paused.

- Research confirms that accurate systems use a canonical scan-derived surface plus separate
  identity/expression deformation; recent work maps complete head geometry into regular
  spherical or UV domains.
- A newly available permissively licensed statistical head model validates the attainable
  quality, but its core model is about 53 MB and would add third-party licence obligations. It is
  a research reference only, not package input.
- Chosen implementation: an original quantised spherical radial-displacement atlas sampled by
  the existing voxel lattice. This replaces the quadric union while preserving the renderer,
  LODs, motion, shared context and tagged point-set contract.
- First checkpoint is neutral geometry only, reviewed at front, three-quarter, profile and inline
  sizes. Do not resume expressions until that base is approved.

### Canonical neutral-head replacement (v7.2)

The first implementation checkpoint of the facial-realism redo is complete and live for review.
It is a fundamental geometry replacement, not another quadric tuning pass.

- Replaced the 25-control smooth-min quadric union with an original 96×72 quantised spherical
  relief atlas. The authored neutral surface coordinates adult skull/jaw planes with orbital
  rims and recesses, glabella, nasal bridge/tip/alar planes, cheekbones, philtrum, upper and lower
  lips, mouth seam, mentolabial sulcus and chin.
- The neutral atlas is bilaterally symmetric and converges to one value at crown and chin so the
  spherical seam cannot pinch. Tests lock those properties plus the projecting nasal profile.
- Global tuning now scales one coherent identity (`width`, `height`, `frontDepth`, `backDepth`,
  `relief`) instead of moving independent face primitives. The tagged region/weight point-set
  contract and expression rig are unchanged.
- Replaced volumetric field search with direct atlas-to-lattice rasterisation. At the demo's
  68-cell level it produces 7,819 particles in 11.5 ms, down from roughly 50 ms during the first
  atlas implementation, while retaining the regular one-cell voxel shell.
- Reviewed live at the default three-quarter view, exact side profile, orbit size and 48px inline
  size. A clean reload uses one WebGL2 context and has no runtime error after the final source
  state.
- Full verification passes: 131 tests, typecheck, build and lint.

This is **ready for Justin's visual review, not yet visually approved**. Named-expression work
remains paused until the neutral head is accepted or receives a specific correction list.

### Neutral anatomy correction checkpoint (v7.5)

Justin rejected the v7.2 neutral as non-human and explicitly requested browser-led comparison
against the supplied dense particle-face references. The first correction checkpoint is live:

- Re-authored the canonical relief at 128×96 resolution around adult facial planes. Circular
  orbital cavities are replaced by shallow horizontal eye openings with separate upper and lower
  lid support.
- Reduced the bulb-like nasal tip and lip/chin projection, widened the bridge into a continuous
  nasal line, and rebalanced zygomatic, temple and mandibular planes.
- Corrected the global skull from a short broad egg to a more adult width/height ratio, with
  facial region anchors retuned to the new eyes, brows and mouth.
- Moved the default review camera close to front-facing so both sides of the neutral anatomy can
  be judged instead of hiding one eye behind the nose.
- Compared the old and new large Idle head in the live browser after each uncommitted adjustment.
  The new surface is visibly more human and less skull-like, but it is **not signed off or claimed
  to match the reference yet**.
- Full verification passes: 132 tests, typecheck, build and lint. The new test coverage locks the
  horizontal eye opening and allows a high-curvature landmark to cross a lattice cell without
  requiring opposite signs at the cell's eight corners.

### Baked human-surface replacement (v8.0)

Justin rejected v7.5 as still non-human and requested a complete first-principles redo. The
radial atlas and Cartesian voxel pipeline are now removed rather than tuned again.

- Replaced all procedural anatomy with 4,096 topology-free points baked offline from an official
  upstream neutral-human asset whose OBJ header explicitly declares CC0.
- The source mesh does not ship. `scripts/bake-canonical-head.mjs` validates the CC0 declaration,
  crops the head/neck, derives normals and face-centroid candidates, seeds sixteen anatomical
  landmarks, builds a face-weighted progressive farthest-point order, bakes local ambient
  occlusion and emits quantised TypeScript data.
- Runtime LODs are prefixes of one canonical human identity: about 32 particles at resolution 12
  through 4,096 at resolution 136. Crown, chin, nose, paired eyes, mouth, brows, ears, jaw and
  neck are deliberately seeded before progressive fill.
- The live head now has genuine eyelids, a continuous nasal bridge/tip/alar profile, lips,
  cheek planes, mandibular contour, ears, rear cranium and neck. Browser comparison was performed
  at front, three-quarter and profile views in the actual WebGL renderer.
- Existing motion, shared renderer, one-context rule, expression vector and tagged point-set
  contract remain intact. Region anchors were moved onto the real eye, brow and mouth anatomy;
  global shape controls now scale one coherent surface.
- The offline bake reproduced byte-identical output. Browser logs contain no warning or error;
  116 tests, typecheck, lint and build pass.

At that checkpoint this was **ready for Justin's visual review, not yet visually approved**, and
named-expression work remained paused until Justin reopened tuning at v8.2.

### Dense facial definition and first expression-rig correction (v8.2)

Justin found the v8.0 mid-face difficult to read: the eyelid openings exposed empty space and
low ambient light made valid nose, eye and mouth samples appear as holes. He also explicitly
approved beginning the tuning process.

- Doubled the progressive maximum from 4,096 to 8,192 points while preserving deterministic LOD
  prefixes and the existing tagged point-set contract.
- Added paired anterior ocular surfaces behind the source body's eyelids. They are generated
  deterministically by the baker and do not add a runtime asset or dependency.
- Rebalanced the portrait material around a broad frontal key, weaker opposing fill, higher
  occlusion floor and size-tiered albedo. Real surface lighting now defines the eyes, nose, lips
  and jaw instead of dark regional paint creating false holes.
- Began expression-region validation by separating eyeball points from eyelid deformation. Eye
  opening now moves the lids while preserving the spherical ocular surface.
- Compared Idle, Listening and Reading at large size and the default Thinking state at 48px in
  the live WebGL renderer. Front and profile anatomy remain coherent; browser logs have no
  warnings or errors.
- The deterministic rebake matches byte-for-byte. All 120 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. The next tuning step is
one named expression at a time, beginning with Listening, after review of this checkpoint.

### Anatomical Listening retune (v8.4)

The first state-specific pass on the baked human anatomy is complete.

- Corrected the old conceptual error where a yaw turn was labelled a listening "tilt". Motion
  now carries a state-driven view-axis roll; Listening uses a persistent 6.9° ear-to-shoulder
  cock plus a smaller source-facing yaw that keeps both eyes visible.
- Retuned the face away from the previous symmetric wide-eyed preset. The source-facing lid and
  brow open slightly more, both cheeks and mouth corners lift gently, and mouth compression is
  nearly neutral. The result reads receptive rather than surprised or tense.
- Roll is evaluated once per frame and applied identically in Canvas 2D and WebGL. All other
  states explicitly keep zero roll, so their existing motion is unchanged.
- Compared Listening against Idle at 256px and verified the Listening silhouette at the default
  48px in the live WebGL renderer. The final page defaults remain 48px Thinking; browser logs
  contain no warnings or errors.
- All 121 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. Reading is next after
this isolated checkpoint is reviewed.

### Anatomical Reading retune (v8.6)

The second state-specific pass on the baked human anatomy is complete.

- Replaced the old uniform downward shift of both eyelids with an anatomical response: the upper
  lid follows a lowered gaze farther while the lower lid moves less. The ocular sphere remains
  fixed behind the lids.
- Narrowed both apertures, settled the brows only slightly and reduced mouth compression from
  `0.1` to `0.03`, preserving concentration without making the face angry, sleepy or tense.
- Increased the persistent chin dip from `0.16` to `0.19` radians. Reading remains laterally
  level with zero roll, clearly separating it from Listening's shoulderward cock.
- Matched the lid equation in the allocation-free CPU deformation kernel and WebGL vertex shader.
- Compared Reading against Listening and Idle at 256px, then verified its silhouette at the
  default 48px. The final page defaults remain 48px Thinking; browser logs contain no warnings
  or errors.
- All 122 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. Thinking is next after
this isolated checkpoint is reviewed.

### Anatomical Thinking retune (v8.8)

The third state-specific pass on the baked human anatomy is complete.

- Lifted the gaze above and slightly off-centre while keeping both lids softly narrowed, producing
  unfocused internal attention rather than alert surprise.
- Split the brow lift asymmetrically and raised the medial ends only slightly, so the expression
  remains contemplative instead of drifting into Searching's active scan.
- Added a restrained lip purse with one subtly lowered corner. The mouth stays closed and relaxed
  enough to preserve the neutral adult anatomy.
- Compared Thinking against Idle at 256px and verified its silhouette at 48px in the live WebGL
  renderer. The final page defaults remain 48px Thinking; browser logs contain no runtime error.
- All 124 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Justin explicitly
approved completing all remaining named expressions first; Searching is next.

### Anatomical Searching retune (v9.0)

The fourth state-specific pass on the baked human anatomy is complete.

- Opened both lids and moved the gaze decisively sideways, creating an externally directed scan
  that is structurally distinct from Thinking's lifted inward gaze and Reading's lowered gaze.
- Raised the brows unequally around a very light medial furrow, preserving alertness without
  becoming worried or surprised.
- Added a small closed-mouth brace. The two-speed searching yaw changes the apparent target while
  the face itself remains precise and controlled.
- Compared Searching at 256px and 48px in the live WebGL renderer. The final page defaults remain
  48px Thinking; browser logs contain no runtime error.
- All 126 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Executing is next.

### Anatomical Executing retune (v9.2)

The fifth state-specific pass on the baked human anatomy is complete.

- Lowered both brows and narrowed both lids symmetrically, replacing exploratory eye movement
  with a stable task-facing aperture.
- Added a moderate medial furrow, firm mouth compression and slight jaw projection. The lower
  face reads braced for action without the stronger inward scrutiny reserved for Reviewing.
- Kept both gaze axes neutral, separating Executing from Searching's lateral scan and Thinking's
  lifted off-centre attention.
- Compared Executing at 256px and 48px in the live WebGL renderer. The final page defaults remain
  48px Thinking; browser logs contain no runtime error.
- All 128 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Generating is next.

### Anatomical Generating retune (v9.4)

The sixth state-specific pass on the baked human anatomy is complete.

- Parted the lips and opened the jaw enough to create visible speech-like articulation, giving
  Generating a lower-face structure that no eye-led state shares.
- Lifted the cheeks, mouth corners, brows and lids moderately. The face reads actively productive
  without becoming the broad settled smile reserved for Done.
- Kept the mouth uncompressed and paired the articulation with Generating's existing outward
  normal pulse and expanding brightness rings.
- Compared Generating at 256px and 48px in the live WebGL renderer, then increased lip and jaw
  separation after the first large-size comparison. Final defaults remain 48px Thinking.
- All 130 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Reviewing is next.

### Anatomical Reviewing retune (v9.6)

The seventh state-specific pass on the baked human anatomy is complete.

- Lowered and narrowed the gaze under a stronger medial furrow, turning the face inward toward
  verification rather than outward toward execution.
- Added slight brow and lid asymmetry plus a closed, compressed mouth. Reviewing now differs from
  Executing in gaze direction, aperture, furrow strength and facial symmetry.
- Retained a restrained jaw brace while the existing repeated nod and mirrored inward shimmer
  carry the ongoing checking action.
- Compared Reviewing at 256px and 48px in the live WebGL renderer. The final page defaults remain
  48px Thinking; browser logs contain no runtime error.
- All 132 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Error is next.

### Anatomical Error retune (v9.8)

The eighth state-specific pass on the baked human anatomy is complete.

- Raised the medial brows against a furrow, widened both eyes and added a restrained nose scrunch,
  producing a recognisable worried interruption rather than another focused work face.
- Lowered both mouth corners, parted the lips and opened the jaw slightly. Error now carries its
  meaning in facial geometry alongside its rejection shake, not in the red accent alone.
- Kept the expression bilaterally coherent so the fast lateral motion does not make the face read
  as a one-sided tracking state.
- Compared Error at 256px and 48px in the live WebGL renderer. The final page defaults remain 48px
  Thinking; browser logs contain no runtime error.
- All 134 tests, typecheck, lint and build pass.

This is **ready for Justin's later visual review, not yet visually approved**. Done is next.

### Anatomical Done retune and completed expression set (v10.0)

The ninth active state-specific pass is complete; Idle remains the neutral baseline.

- Softened both lids and lifted the cheeks and mouth corners into a broad closed completion smile.
  Done is now structurally distinct from Generating's parted active articulation.
- Increased the smile after the first 256px browser comparison so its mouth shape survives the
  particle medium without becoming a cartoon exaggeration.
- Removed obsolete "later states remain neutral" test scaffolding. Every active state now owns a
  frozen expression vector, and a regression test locks Idle as the sole neutral registry entry.
- Exercised all ten gallery buttons in sequence, verified Done at 256px and 48px, then restored
  the live page to its 48px Thinking default. One WebGL2 context remains active with no warnings
  or errors.
- All 136 tests, typecheck, lint and build pass.

The complete expression sequence is **ready for Justin's visual evaluation, not yet visually
approved**. Any correction should remain an isolated state-specific pass.

### Sculptural facial-depth lighting correction (v10.2)

Justin confirmed that the underlying facial structure is present but still too vague to read
because the bright and dark planes do not describe enough depth.

- Corrected the depth attenuation model. The previous perspective-distance ratio began the
  fade halfway through the head, so even the nearest face plane lost roughly one fifth of its
  brightness before material lighting. Depth now maps the actual surface span: front `0`, centre
  `0.5`, back `1`.
- Moved the portrait key to a stronger upper-side angle so the nose, orbital rims and cheekbones
  break into separate planes. Reduced the near-frontal fill so it preserves the shadow side
  without washing those planes together.
- Lifted ambient and occlusion floors enough that shadowed particles remain visible rather than
  becoming false holes, while increasing back-depth attenuation to keep the volume distinct.
- Matched the equations in Canvas 2D and WebGL, added depth-mapping regression tests, and compared
  Thinking and neutral Idle live at the 320px orbit size. One WebGL2 context remains active with
  no warnings or errors.
- All 138 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. Cursor-drag 360° orbit is
the next isolated checkpoint after this review.

### Dense sculptural surface correction (v10.4)

Justin's exact orbit screenshot showed that the v10.2 light direction was no longer the main
failure: the sampled anatomy was broken into visibly disconnected rows across the eyes, nose,
lips and cheeks.

- Compared the supplied screenshot against a matching live Searching-state orbit view, then
  tested particle size and camera proximity independently through the tuning panel.
- Increased square-tile coverage from `0.9` to `1.15` times nominal spacing. The slight overlap
  closes projection gaps across curved facial planes while the tile edges preserve the particle
  medium.
- Rebalanced ambient, occlusion and frontal fill downward after closing those gaps. Increasing
  size alone filled holes but flattened the face; the retained combination restores dark orbital
  sockets and nasal separation without deleting the shadow-side surface.
- Repeated the live browser comparison after hot reload. The brow ridge, both sockets, nose
  bridge and tip, philtrum, lips, chin, jaw and ears now read as one continuous adult face in the
  same Searching orbit pose. Browser logs contain no runtime warnings or errors.
- Updated the renderer regression test to require controlled cell overlap and cap it below `1.2`
  so future tuning cannot silently return to either disconnected rows or a fused solid mask.
- All 138 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. The 320px orbit canvas
still leaves substantial stage space unused; change its presentation scale only as a separate
reviewed step rather than conflating geometry coverage with showcase framing.

### Size-tiered dense skin correction (v10.6)

Justin rejected v10.4 because the orbit face remained vague and the smaller heads were still
visibly hollow. The root cause was not point count alone: the old glyph tier deliberately shrank
skin tiles to `0.92` and faded them to `0.72`, while the tier decision used the square canvas size
even though the projected portrait occupies only about 55–60% of it.

- Replaced the faded glyph shell with an opaque, closed front surface. Skin tiles overlap by
  `1.35×` at glyph size and `1.18×` at compact size, then return to `1×` at display size.
- Enlarged eye, brow and mouth landmark footprints only where the projected face lacks enough
  pixels to carry full anatomy. They step from `1.35×` glyph to `1.12×` compact to `1×` display.
- Moved the component thresholds to 64px and 160px so tiering follows the actual projected face:
  a 48px canvas contains only about a 28px-wide face and therefore needs the glyph treatment.
- Restored feature-material separation at compact and display sizes instead of flattening nearly
  every region to white.
- Added a matched nonlinear shade curve in Canvas 2D and WebGL. Highlights remain fixed while
  midtones and recesses deepen, clarifying the sockets, nose, lips and jaw without deleting skin.
- Compared the actual live renderer at 24px, 32px, 48px and 320px. Small heads now read as closed
  face glyphs; the orbit head retains individual tiles with stronger facial depth. The default
  remains 48px, one WebGL2 context is active and browser logs contain no warning or error.
- All 139 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. Further facial changes
must continue to be checked across all three size tiers rather than only in the orbit view.

### Complete-surface circular splat rewrite (v10.8)

Justin rejected v10.6 because the small faces still collapsed toward bright masks and the
underlying anatomy remained too difficult to read. External primary research and the supplied
screenshot pointed to a sampling/filtering failure rather than another anatomy-parameter tweak.

- Replaced built-in prefix-thinned LODs with the complete 8,192-point anatomical surface at every
  size tier. Rasterisation now integrates the full eye, nose, mouth and jaw signal instead of
  deleting most of it before projection.
- Replaced the square-tile default with anti-aliased circular particles, matching the requested
  small particle-bot medium. Square remains an explicit public style option.
- Separated radiance from opacity in both WebGL and Canvas 2D. Lighting, occlusion, material and
  shimmer alter particle colour; only geometric coverage, back-facing attenuation and depth alter
  opacity. Shadowed skin therefore stays present rather than opening false holes.
- Added size-dependent face framing and landmark contrast. A 16px render is intentionally a
  low-frequency face glyph; 48px exposes the paired sockets, nose axis, mouth and jaw; 320px
  retains the complete shaded sculpt and individual circular particles.
- Updated the demo readout and warm-up path to report the level the runtime actually renders.
- Repeated live browser comparisons at 16px, 48px and 320px. One WebGL2 context remains active,
  and the 48px gallery now reads as faces instead of the rejected checkerboard masks.
- All 142 tests, lint and build pass.

This is **ready for Justin's visual review, not yet visually approved**. Cursor-drag orbit remains
the next isolated interaction checkpoint only after this renderer direction is accepted.

### Small-face optical level of detail (v11.0)

Justin approved the large sculpt but found that forcing all 8,192 particles into smaller canvases
made the face barely visible. The failure was over-sampling: thousands of subpixel circles
averaged into a pale miniature instead of reading as individual particle bots.

- Preserved the approved complete 8,192-point surface from 48px upward. No display-size geometry,
  lighting, material or motion value changed.
- Added dedicated optically corrected variants below 48px: 128 particles at 16px, 255 at 24px and
  1,020 at 32px. The canonical progressive ordering keeps paired eyes and the mouth in every
  prefix.
- Coupled particle footprint to optical framing below 48px. Enlarging a sparse glyph now enlarges
  its circles as well as their positions, preventing the face from opening into a disconnected
  constellation.
- Corrected DPR handling: rendered size and target spacing now scale together. Retina displays
  sharpen circle edges without silently quadrupling particle density.
- Browser-compared 16px, 24px, 32px and the unchanged 48px boundary. The live readout confirms the
  intended particle ladder, the 320px orbit remains on the complete surface, and one WebGL2
  context remains active.
- All 145 tests, lint and build pass. Regression coverage locks the optical ladder, framing
  footprint and DPR-invariant CSS density.

This is **ready for Justin's small-size visual review, not yet visually approved**. The large
sculpt is approved and must remain unchanged.

### Small-face optical master rebuild (v11.2)

Justin found that v11.0 still failed at the gallery's default 48px and below. The boundary itself
was wrong: 48px switched straight back to all 8,192 particles, recreating the subpixel averaging
that the optical LOD was supposed to remove. The smallest tier also enlarged positions by as much
as 4.3×, clipping the silhouette, while state-driven head rotation smeared the remaining facial
pixels.

- Extended the deliberate optical ladder through 80px: 16→r17/128 particles,
  24→r24/255, 32→r34/512, 48→r48/1,020, 64→r68/2,048 and 80→r96/4,082. The complete
  r136/8,192 sculpt now begins at 96px.
- Replaced runaway glyph zoom with a bounded 1.20–1.25× optical frame and coupled the particle
  footprint to it, producing controlled overlap rather than either holes or an opaque blob.
- Enlarged and darkened eye, brow and mouth particles progressively as the pixel budget shrinks.
  The canonical surface still supplies the silhouette and real landmark placement.
- Applied the size tier's pose scale to state-driven sway and pose biases in both WebGL2 and
  Canvas 2D. Glyph heads now remain front-facing; 96px+ motion is unchanged.
- The in-app browser refused localhost access during this checkpoint, so no live visual approval
  is claimed. The dev server is running for Justin's review.
- All 147 tests, typecheck, lint and build pass. Regression coverage locks the complete optical
  ladder, DPR-invariant density, bounded framing and progressively stronger glyph landmarks.

This is **ready for Justin's visual review, not yet visually approved**. The approved large head
path is unchanged from 96px upward.

### Interruptible transition foundation (v11.4)

The core transition machinery is implemented but deliberately not wired into `HeadSlot` yet.

- Added one allocation-free critically damped controller that blends every motion and expression
  scalar from its current presentation value, preserving velocity through rapid retargets.
- Integrated oscillator phase from the exact area under each changing speed. State changes and
  playback-rate changes therefore cannot multiply the page's elapsed time into a visual jump.
- Added semantic response values per state plus Done's 900ms completion hold and return to Idle.
- Canvas 2D and WebGL2 both accept the same integrated motion phases.
- All 90 directed state pairs, random interruptions, frame-partition independence, Done lifecycle,
  stable object identity and legacy constant-speed equivalence are covered by tests.

The next transition step is demo integration plus deterministic frame-by-frame capture. Do not
rebuild this controller or hard-cut the existing state vectors.

### Feature-balanced small-face surfels (v11.5–v11.6)

Justin approved the large head but found every previous small-size strategy too sparse and vague.
The failure was a data-budget and rasterisation mismatch: the r17 master had only two samples per
eye, three for the mouth and no brows, while dark feature particles disappeared into holes.

- Added deterministic `?size=16` through `?size=256` demo deep links for repeatable browser
  comparison.
- Replaced raw progressive prefixes at tiny resolutions with landmark-balanced subsets of the
  same canonical human anatomy. Eye, brow, nose and mouth quotas are reserved first; the remaining
  budget comes from the canonical progressive skin order.
- Raised the optical ladder one density rung: 16px→r24/255, 24px→r34/512, 32px→r48/1,020,
  48px→r68/2,048, 64–80px→r96/4,082 and 96px+→r136/8,192.
- Reconstructed tiny skin with overlapping support discs plus brighter circular cores. The face
  stays continuous without hiding the particle medium.
- At ≤32px, omitted neck particles and used a tighter face crop. The key light remains frontal
  through 32px, rotates into the approved raking angle through 64px, then leaves the large renderer
  unchanged.
- Lifted tiny feature material so sockets, nose and mouth read as planes rather than black holes.
- Implemented the same optical rules in WebGL2 and Canvas 2D. Browser checks found no shader or
  console errors and retained one shared WebGL context.
- Browser-reviewed 16, 24, 32, steady-state 48, 64 and 320px. Independent visual audit approved
  the final spectrum: 16px satisfies the glyph contract, 32px reads immediately as human, 48/64px
  retain visible particle anatomy, and the approved 320px sculpt is unregressed.
- All 161 tests, typecheck, lint and build pass.

This is **ready for Justin's visual review**. The 16px tier is intentionally an optical face glyph;
individual circular particles become physically distinguishable as the available pixels increase.

### Interruptible state transitions and optical expression gain (v11.8–v12.5)

The ten-state controller is now the demo's live source of motion and expression. Every change
begins from the currently presented value, so a second state can interrupt the first without a
cut, velocity reset or oscillator phase jump.

- Integrated the allocation-stable critically damped controller into every live `HeadSlot`.
  Expression, pose, continuous motion, shimmer direction and semantic accents all crossfade
  through the same presentation frame.
- Added a deterministic browser recorder at `?transition-lab=1`. It reconstructs exact 60fps
  frames from an explicit phase and exposes every directed pair as a 10×10 matrix.
- The numeric audit gates all 90 directed transitions for start jumps, endpoint error,
  overshoot, non-finite values, direction collapse, settling and largest normalized frame step.
  Current result: **90/90 pass**, no jumps or overshoots, 20.8% maximum frame step and 767ms
  slowest exact settle.
- Error and Done now blend as numeric accent channels in both renderers instead of hard CSS
  colour switches. Done holds for 900ms, returns the live semantic state to Idle and can be
  replayed; static gallery studies remain stable.
- Reduced motion uses one static Canvas 2D frame and a semantic timer rather than an animation
  loop. Renderer recreation, hidden-instance redraw and context lifecycle bugs found during the
  audit were corrected.
- Independent visual review inspected full frame sequences plus all 100 cells of the 48px
  directed-pair matrix. It approved every transition: no doubled or collapsed face, broken
  silhouette, hollow midpoint, missing landmark band or hard accent cut.
- Added a size-aware expression optical master after the matrix audit. Facial displacement is
  2× at 16px, 1.6× at 48px, 1.4× at 64px and tapers to exactly 1× at 96px. The approved large
  sculpt is mathematically unchanged. WebGL2 and Canvas 2D share the same curve.
- Browser-compared exact Reading→Thinking frames at 16, 32, 48, 64 and 96px, plus the 16px
  reduced-motion fallback. The smallest tier remains the required eyes-and-mouth glyph; 48/64px
  carry clearer expression while preserving one coherent human face.
- All **170 tests**, typecheck, lint and production build pass.

This is **ready for Justin's small-size expression review** at `http://localhost:5173`.

### Connected animated facial identities (v12.7–v13.1)

Justin correctly found that the previous ten states changed head pose, shimmer and tint while the
actual face remained nearly static. The old deformation moved most features by only fractions of a
particle, excluded surrounding skin and front ocular particles, kept neutral normals, and stopped
all local facial motion after a transition settled.

- Replaced exclusive one-region deformation with an analytic connected-skin rig. Brow, eyelid,
  cheek, nose, mouth and jaw controls propagate through bounded anatomical halos into adjacent
  forehead, orbital, nasolabial, chin and mandibular tissue. Deformed normals now make the key
  light reveal changing facial planes.
- Added allocation-free continuous facial behaviour to the same interruptible state vector:
  blinks, gaze scans, brow tension, mouth articulation and jaw follow-through. Facial and blink
  speeds have independently integrated phases, so random retargets bend their timing without a
  cut.
- Corrected the physical details found during review: gaze rotates the ocular normal and moves the
  monochrome iris/pupil while the globe stays fixed in its socket; a human-scale blink closes to a
  particle seam for roughly 152–202ms; the lower lip inherits about 84% of mandibular travel while
  the upper lip stays nearly fixed; the deep jaw core rotates rigidly; nose scrunch remains
  centreline-symmetric.
- Retuned all ten endpoints as distinct upper- plus lower/mid-face combinations. Generating uses
  central speech-like articulation instead of a wide cheek seam; Error reads worried rather than
  hollow; Done remains a closed settled smile. The eye aperture/iris material keeps gaze readable
  at inline sizes without colour.
- Added a fixed-camera, neutral-white facial endpoint gallery at 48, 96 and 320px, plus a
  production/facial-only switch for exact frame recording. State pose, shimmer and tint can no
  longer conceal a weak facial endpoint during review.
- Deterministic audits now compose the effective animated face on every 60fps frame. **90/90**
  directed transitions pass with zero facial start discontinuity, all **10/10** held states retain
  local facial life, four rapid timestamped retarget sequences have zero event discontinuity, and
  all **45/45** endpoint pairs clear production-projected two-family separation gates at both 48
  and 96px.
- Three independent post-correction reviews approved the final result: visual identity at
  48/96/320px, anatomical cohesion and jaw/eye/blink physics, and transition/retarget timing.
- All **182 tests**, tracked-source lint, typecheck and production build pass. The package runtime
  remains one shared WebGL2 context, zero dependencies, one expression-vector upload and no
  per-frame allocation.

This is **ready for Justin's visual review**. The deterministic review surface is
`http://localhost:5173/?transition-lab=1`; choose `Facial only` to isolate any transition.

### Local showcase redesign brief (requested 2026-07-26)

Justin rejected the existing showcase presentation and requested a complete local-demo redesign.
This is a new reviewed component, not the deferred hosted marketing site.

- **Rendering report:** the blank canvases in Justin's screenshot were reproduced as the shell
  left behind by a failed hot-reload, not as the current committed renderer. A new browser tab at
  `http://localhost:5173` renders all ten heads through WebGL2 with no runtime errors. Hard-refresh
  any tab that remained open during the canonical-atlas source repair.
- **Composition:** replace the hero/readout/deck/tube grid/duplicate orbit/pipeline sequence with
  a simple navigation bar, one dominant live head workbench, an asymmetric gallery of ten large
  state studies, compact engineering evidence, and a quieter Phase 2 placeholder.
- **Visual system:** Source Code Pro; black/white polarity themes; only restrained semantic or
  modality accents; flowing ribbon geometry, carved voids, repeated curves and large negative
  space; measured construction details without faux-historical decoration.
- **Interaction:** pointer light and a spring-constrained reactive grid should feel physical.
  State selection and theme changes must respond immediately, remain interruptible, and collapse
  to a clear static composition under reduced motion or reduced transparency.
- **Material:** reserve refraction/translucency for the navigation and compact control surfaces.
  Bare content and strong whitespace replace the current glass-card treatment.
- **Design standard:** apply Rams's ten principles and Apple's purpose, agency, familiarity,
  flexibility, simplicity, craft and delight. Meet WCAG contrast using luminance, never hue alone.

The requested `liquid-gl` package cannot currently share Thinking Head's context. Its renderer
creates a full-page canvas and calls `getContext()` internally; Thinking Head already supplies the
page's one shared WebGL2 context. No package or visual code has been changed yet. The next step is
an explicit choice between:

1. a **demo-only two-context exception**, which uses the package literally but weakens a documented
   performance guarantee on the showcase page; or
2. preserving the **one-context guarantee** and implementing a small compatible refractive
   material in Thinking Head's renderer, which follows the requested effect but does not instantiate
   the package.

### Previous demo design language — superseded 2026-07-26

Justin asked for a creative, high-contrast liquid-glass treatment. The demo now has a
committed aesthetic direction: **"particle observatory"** — obsidian void, volumetric
light, floating glass instrument panels. This section is retained as implementation history only;
the local showcase redesign brief above supersedes it.

- **Type:** Instrument Serif (display, italic for the accent word), IBM Plex Sans (body),
  IBM Plex Mono (all labels, data and state names).
- **Glass material:** the `.glass` class is the single source of the material — layered
  translucent gradient, `backdrop-filter` blur + saturate, inset specular edges, a
  pointer-tracked hotspot via `::before`, and top-rim lensing via `::after`.
- **Lighting:** three slow drifting blooms, a hairline measurement grid, animated grain,
  and a vignette, all in `Backdrop.tsx` and all CSS-driven (no per-frame JS).
- **Pointer as light source:** `useSpotlight.ts` sets local `--mx`/`--my`/`--lit` on the
  glass panel under the cursor. One delegated listener, rAF-coalesced, one write per
  frame regardless of panel count, and it no-ops entirely under reduced motion.
- **Modality accent re-lights the whole page** (`--accent` swapped off
  `.shell[data-modality]`) — a live preview of the colour layer the real component will
  apply to the head. Cyan / amber / rose for text / audio / vision.
- **Reduced motion** collapses every decorative animation to its resting state rather
  than removing it, matching the accessibility rule the component itself must follow.
  Implemented but not yet verified in a browser with the preference actually enabled.
- The gallery grid and stage heights track the size slider via `--slot`, so a 256px head
  reflows the grid instead of being clipped.

### Decisions locked in this session

1. Geometry: **progressive 8,192-point human surface**, offline-baked from an explicitly CC0
   neutral base. The source mesh and topology do not ship; the runtime decodes compact quantised
   point data. Display LODs use deterministic prefixes, while tiny optical masters reserve
   landmark-balanced subsets from that same identity. This supersedes the rejected quadric,
   radial-atlas and Cartesian-voxel routes while preserving zero runtime dependencies and the
   tagged point-set rig contract.
2. Renderer: **purpose-built WebGL2, zero runtime dependencies** — chosen over a
   general-purpose 3D engine on bundle size (~10–15 KB vs ~155 KB gzipped) and because
   the required shared-context architecture isn't provided by such an engine anyway.
3. npm package name: **`thinking-head`** (verified available on the registry).
4. Build tooling: **Vite library mode instead of tsdown.** tsdown cannot be installed by
   current stable npm — it trips an arborist peer-resolution bug that would hit every
   contributor. Vite was already required for the demo, so this removed a dependency.
   Outputs are unchanged: ESM-only plus generated declarations.

---

## Next

1. **Justin reviews the v13.1 ten-state facial system at `http://localhost:5173`.** Use
   `?transition-lab=1` for the 48/96/320px facial-only gallery and exact frame recordings.
2. **Implement cursor-drag 360° orbit as a separate interaction checkpoint.** Use direct Pointer
   Events, capture, immediate one-to-one tracking and bounded pitch while preserving continuous
   state motion.
3. **Address any isolated facial corrections from Justin's evaluation.** Keep each correction as
   its own browser-verified commit.
4. The React wrapper and the `./react` subpath export — currently `package.json` exports
   only `.`; add the subpath when the wrapper lands. It owns the `role="status"` /
   `aria-live` pattern from `CLAUDE.md` §5, which the demo placeholder does not yet do.
5. Phase 2 architecture doc (`ROADMAP.md`) — **the data format is now stable**, so this is
   unblocked whenever Justin wants it.
6. Return to the local black/white showcase redesign when Justin supplies the next website
   direction. Resolve the liquidGL context rule before its material milestone.
7. README and LICENSE last, only after Justin confirms Phase 1 is correct.

---

## Open questions for Justin

Deferred until they matter:

- Default inline size and default particle budget per device tier — to be resolved
  empirically in the demo rather than decided up front.
- Whether literal use of `liquid-gl` justifies a demo-only second WebGL context, or the one-context
  guarantee takes priority and the material is implemented inside the existing renderer.
- Whether a Web Components wrapper is Phase 1 scope or deferred.

---

## Notes carried forward

- The repo was **not** a blank slate at kickoff. `v0.1` (`0952e9c`) had already committed
  and pushed a research notes doc, which was then deleted in the working tree. That
  deletion was resolved by rewriting the file with verified figures at `v0.3`; the
  original remains in history if it needs revisiting.
- `README.md` and `LICENSE` already exist from the initial commit. LICENSE is GitHub's
  standard MIT template and satisfies the constraint as-is. The README is a two-line
  stub to be **replaced** at the final step — and its current wording closely mirrors a
  comparable product's tagline, so the final version must be written fresh from GitHub's
  generic template.
- The demo resolves `thinking-head` to package **source** via a Vite alias (and a
  matching `paths` entry in `tsconfig.json`), so there is no build step in the edit loop
  and every change to the head is live on save.
