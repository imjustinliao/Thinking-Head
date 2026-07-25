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
| **Step** | **WebGL2 renderer + shared context complete** (v2.7–v2.9). Next: `idle` — the motion system |
| **Last commit** | `4e9a8e0` — v2.9 - Select renderer backend per instance and report it in the demo readout |
| **Dev server** | Running at **http://localhost:5173** (`npm run dev` from repo root) |
| **Blocked on** | Justin's review of the head's shape — tune it in the demo panel |

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

1. **`idle` — the motion system.** 4D simplex noise plus incommensurate sinusoids evaluated
   in the vertex shader from uniforms. Justin's target quality is an organised, purposeful
   swarm ("nano robots"), not loose drift. This milestone also brings the pieces that only
   matter once things move: shared animation clock across instances, offscreen pause via
   `IntersectionObserver`, Page Visibility pause, and `prefers-reduced-motion` (the Canvas 2D
   path is the static/reduced-motion renderer).
2. Then the remaining nine states one at a time, with a check-in after each.
5. The React wrapper and the `./react` subpath export — currently `package.json` exports
   only `.`; add the subpath when the wrapper lands. It owns the `role="status"` /
   `aria-live` pattern from `CLAUDE.md` §5, which the demo placeholder does not yet do.
6. Bake the tuned point set into a committed artifact once the shape is locked, and drop
   the generator from the runtime path entirely.
7. Phase 2 architecture doc (`ROADMAP.md`) — **the data format is now stable**, so this is
   unblocked whenever Justin wants it.
8. README and LICENSE last, only after Justin confirms Phase 1 is correct.

---

## Open questions for Justin

None currently blocking. Deferred until they matter:

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
