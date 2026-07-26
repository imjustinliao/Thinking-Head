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
| **Step** | **Expression/anatomy review complete.** Preset tuning paused pending geometry direction |
| **Last commit** | `4c2f22d` — v6.8 - Add focused reading expression preset |
| **Dev server** | Running at **http://localhost:5173** (`npm run dev` from repo root) |
| **Blocked on** | Justin's follow-up on bringing the deferred facial-realism pass forward |

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

### Voxel-lattice rewrite (v3.5–v3.7) — the current render model

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

### Demo design language — established, do not flatten

Justin asked for a creative, high-contrast liquid-glass treatment. The demo now has a
committed aesthetic direction: **"particle observatory"** — obsidian void, volumetric
light, floating glass instrument panels. A future session should extend this, not
replace it with defaults.

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

1. Geometry: **procedural, generated in code** (SDF sampled to a blue-noise point set at
   build time) — chosen over a licensed base mesh and a published parametric head model,
   because the rig comes free as parameters of the same generator and there is zero
   licence surface.
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

1. **Justin confirms whether to bring the deferred facial-realism pass forward now.** If approved,
   the first milestone is an accurate neutral canonical human surface in the existing tagged
   point-set format. Stop after the neutral head is visible in the live demo for review; do not
   tune state expressions on the rejected base.
2. **State transitions** — `mix()` over the `MotionParams` scalars plus the expression vector,
   triggerable at any moment. The sinusoid basis already makes arbitrary-time entry safe.
3. The React wrapper and the `./react` subpath export — currently `package.json` exports
   only `.`; add the subpath when the wrapper lands. It owns the `role="status"` /
   `aria-live` pattern from `CLAUDE.md` §5, which the demo placeholder does not yet do.
4. Bake the tuned point set into a committed artifact once the shape is locked, and drop
   the generator from the runtime path entirely.
5. Phase 2 architecture doc (`ROADMAP.md`) — **the data format is now stable**, so this is
   unblocked whenever Justin wants it.
6. README and LICENSE last, only after Justin confirms Phase 1 is correct.

---

## Open questions for Justin

Blocking:

- Bring the dedicated facial-realism pass forward now, pausing the remaining Phase 1 expression
  presets, or finish the non-visual Phase 1 machinery first as `CLAUDE.md` currently specifies?

Deferred until they matter:

- Default inline size and default particle budget per device tier — to be resolved
  empirically in the demo rather than decided up front.
- Whether the large interactive orbit view ships within Phase 1 or immediately after the
  ten states are done.
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
