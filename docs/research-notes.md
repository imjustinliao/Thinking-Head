# Research Notes

Background research conducted before any architecture decisions were made, covering
rendering approaches, GPU-driven particle animation, expression rigging, geometry
sourcing, accessibility, and power/performance behaviour for animated status
indicators.

**Scope note:** comparable commercial and open source "AI is working" indicators were
reviewed only as background on *concepts* — rendering strategy, motion vocabulary,
accessibility affordances. No implementation, structure, naming, or asset from any of
them is used, referenced, or reproduced in this project. Only concepts and
platform-level standards are recorded here.

---

## 1. Rendering substrate: Canvas 2D vs WebGL2 vs WebGPU

| | Canvas 2D | WebGL2 | WebGPU |
|---|---|---|---|
| Availability | Universal | ~100% of live browsers | ~85% global, ~70% mobile (mid-2026); Safari since 26 / iOS 26 |
| Per-particle CPU cost | One draw call per particle | Zero (vertex shader) | Zero (vertex/compute) |
| Ceiling | ~1k sprites before jank | ~100k+ | ~1M+ |
| Fallback burden | None | Needs a no-GL fallback | Needs a WebGL2 fallback *and* a no-GL fallback |

**Finding.** Our working set is small by particle-system standards: roughly 60–200
particles at inline sizes and low thousands in the large orbit view. That is one to
three orders of magnitude below where WebGPU's compute advantage begins to matter.
WebGPU's benefit is concentrated in simulation-heavy systems (100k–1M particles doing
per-frame physics); our motion is analytic and evaluated per-vertex.

**Implication.** WebGL2 is the correct primary target — it reaches effectively every
device with none of WebGPU's dual-path maintenance cost, and it is not the bottleneck
at our particle counts. A WebGPU backend remains a clean future addition behind the
same renderer interface if Phase 2 geometry ever pushes counts up, but building it now
would be cost with no measurable user benefit. A non-GL fallback is still required for
locked-down/headless environments and for reduced-motion users.

## 2. Particle primitive: `gl.POINTS` vs instanced billboard quads

Point sprites are the cheapest way to draw many particles, but they carry two
platform hazards that matter specifically for us:

- **Size caps are wildly inconsistent.** `ALIASED_POINT_SIZE_RANGE` is only required by
  spec to reach 1.0. In practice most desktop GPUs report 512–2048, but Apple silicon
  reports a maximum of **64**. A head rendered large, or on a high-DPR display where
  we multiply point size by `devicePixelRatio`, would silently clamp and visually break
  on a very common class of device.
- **Whole-point clipping.** A point sprite is culled when its *centre* leaves the
  frustum, so particles pop out of existence at the canvas edge rather than sliding off
  — visible during orbit and during outward "generating" motion.

Instanced quads (WebGL2 `drawArraysInstanced`, 4 verts + per-instance attributes)
avoid both, and additionally give per-particle rotation, non-uniform scale, and soft
round alpha falloff via a distance function in the fragment shader. Instancing costs
4× the vertex shader invocations, which at our counts is negligible (hundreds of
instances = low thousands of vertices, versus a typical 60fps budget of hundreds of
thousands).

**Implication.** Instanced billboard quads, single draw call. The cost is
theoretical; the correctness win is not.

## 3. GPU-driven animation and expression morphing

The standard browser technique for morphing a particle cloud between shapes is to
supply two position attributes and mix them in the vertex shader against a `uProgress`
uniform, with `uTime` driving continuous motion — zero per-frame JavaScript per
particle. This is proven and cheap.

However, the **baked-target** form of it scales badly for our requirements. Ten states,
each a distinct expression, means ten position buffers per head; blending between
arbitrary state pairs at arbitrary moments means keeping several resident; and a
developer-defined custom state would be impossible without shipping a mesh baker to the
client.

The alternative found in rigging practice is **parametric deformation**: express
expression as a small set of named scalar controls (the blendshape/morph-target model
formalised by facial-rig conventions such as the widely used 52-shape ARKit set, whose
naming discipline — `brow_`, `eye_`, `mouth_`, `jaw_` prefixes — is a useful reference
for our own much smaller control set) and evaluate the deformation *analytically* in
the vertex shader from uniforms.

**Implication.** Each particle carries static attributes (rest position, surface
normal, region id, per-region influence weights). Each state is a vector of ~15–20
scalar controls. Blending two states is `mix()` over that scalar vector, not over
position buffers — which makes arbitrary-time transitions, three-way blends, and
runtime-defined custom states all fall out of the same mechanism for free. Per-frame
CPU work reduces to writing a handful of uniforms.

This also makes **user-defined custom states genuinely feasible** rather than
aspirational, since a custom state is just a JSON-shaped object of the same scalars.
Noted for the roadmap; not built in Phase 1.

## 4. Continuous motion, not one-shot animation

The requirement that a state look alive for 30 seconds without visible repeat rules out
fixed-length keyframe loops, which telegraph their period. Two techniques compose well
under the parametric model above:

- **Gradient/simplex noise sampled per particle** with the particle's rest position as
  a spatial seed and time as a fourth dimension — non-repeating, smooth, and evaluable
  entirely in the vertex shader. Per-state control of amplitude, frequency, and
  anisotropy gives each state a distinct motion *texture* (slow isotropic drift for
  idle, sharp axis-aligned steps for executing, outward radial bias for generating).
- **Incommensurate sinusoids** (periods at irrational ratios) for the deliberate
  rhythms — breathing, head sway, gaze saccades. Their combined period is effectively
  infinite, so no visible loop point.

Neither has a "start" or "end", so entering or leaving a state at an unpredictable
moment is always phase-safe.

## 5. Head geometry sourcing (no 3D artist available)

Three viable routes were evaluated.

**A. Licensed base mesh (CC0 asset), sampled offline to points.**
Sources such as Poly Haven and various CC0 asset collections offer commercially usable
head meshes with no attribution requirement. *Against:* provenance on CC0 asset
aggregators is frequently unverifiable — re-uploads and model-generated assets are
common — which is a real liability for a public MIT repo. It also ships a binary asset,
gives no control over stylisation, and, decisively, provides **no expression rig**:
authoring ten expressions on a downloaded mesh is exactly the artist-hours we do not
have.

**B. Procedural parametric head, generated in code.**
Build the head as an analytic surface — a smooth-minimum union of quadric primitives
(cranium, brow ridge, nose, jaw, cheeks) evaluated as a signed distance field — then
sample it into a point set at build time. *For:* zero license surface (100% original
work), no binary assets, complete control over stylisation, deterministic and seedable,
and every dimension becomes live-tunable in the demo page. Critically, expression
deformations are authored as *parameters of the same generator*, so the rig comes for
free. *Against:* achieving a *charming* result is an iteration problem — pure implicit
surfaces trend blobby, and legibility at 24px is not automatic.

**C. Model-generated mesh (text-to-3D).** Rejected: unclear license provenance for a
public repo, and the same missing-rig problem as A.

**Key insight from this comparison: we do not need a mesh.** A particle head needs a
point set with per-point normals and region tags — topology, UVs, and edge flow are
irrelevant to us. Dropping the mesh requirement removes the artist bottleneck entirely
and makes B strictly dominant.

**Legibility at small sizes** is a sampling-density problem, not a geometry-fidelity
problem. At 24px the head reads as a silhouette plus three or four landmark clusters
(eyes, brow line, mouth). Feature-weighted sampling — allocating disproportionate
particle budget to eyes, brows, lips, and the jaw/silhouette contour, and thinning the
cheeks and cranium — should preserve recognisability far better than uniform sampling
at the same count. Blue-noise/Poisson-style distribution within each region avoids the
clumping and moiré that uniform random sampling produces at low counts.

**Forward compatibility with Phase 2.** Since the runtime consumes a point set rather
than a mesh, Phase 2's photo→3D pipeline only has to emit the *same* buffer format
(position, normal, region id, influence weights) from a reconstructed head. Current
single-image head reconstruction research consistently targets a parametric head model
with a fixed topology, which means region tagging and rig weights can be assigned once
against that topology and reused for every user — server-side, offline, exactly once
per uploaded photo. The Phase 1 data format therefore does not need to change for
Phase 2, provided we define it as a tagged point set from the start.

## 6. Modality accents

The requirement is a lightweight layer over the ten base states hinting at model
modality (text / audio / vision) without new sculpted expressions. Options considered:

1. **Colour-only uniform** — cheapest, but colour alone is not perceivable by all users
   and is easily overridden by theming.
2. **Colour + motion-texture modifier** — the accent contributes a small multiplier set
   over the state's own motion parameters (e.g. audio biases toward rhythmic vertical
   pulsing, vision toward horizontal scanning, text toward fine high-frequency
   shimmer), applied *after* state blending.
3. **Separate expression per state × modality** — 30 expressions; rejected as
   combinatorially unmanageable and against the spec's intent.

**Implication.** Option 2. Because state and accent are both parameter vectors, the
accent is a post-blend modifier on the same uniform set — a few extra uniforms, no
extra shader permutations, and it composes with any custom state added later.

## 7. Accessibility

Findings from current guidance for animated loading indicators:

- **`prefers-reduced-motion`** should *simplify*, not delete, the indicator — the status
  signal must survive. Replace continuous motion with a static pose or a slow opacity
  breath. Honour changes live (the media query can flip mid-session).
- **`role="status"` + `aria-live="polite"`** on a text label announces state changes
  without interrupting. The canvas itself should be `aria-hidden` — a screen reader has
  nothing to gain from it — with the semantic meaning carried by adjacent visually
  hidden text.
- **`aria-busy="true"`** belongs on the *container whose content is loading*, which is
  the consuming application's element, not ours. We should document this rather than
  set it.
- Never rely on colour alone to distinguish states (directly relevant to error state and
  to modality accents).
- Announcements should be throttled; a rapid state sequence must not produce a burst of
  screen reader chatter.
- Verify at 200% zoom and with reduced motion enabled.

## 8. Performance and power

- **Pause when not visible.** `IntersectionObserver` to stop the render loop when
  offscreen, plus the Page Visibility API for background tabs. A status indicator in a
  long chat transcript is offscreen most of the time; this is the single largest power
  win available.
- **Cap `devicePixelRatio`.** Rendering at DPR 3 on a phone costs 9× the fragment work
  of DPR 1 for imperceptible gain at 24px. Cap at 2, lower on weak devices.
- **Device capability tiering.** Scale particle count, DPR cap, and effect complexity
  from cheap signals (`hardwareConcurrency`, `deviceMemory`, GPU renderer string,
  coarse-pointer heuristics), then adapt downward if measured frame time degrades.
- **Frame-rate governing.** A status indicator does not need 120fps; capping update rate
  well below display refresh on low-tier devices saves meaningful battery with no
  perceptual loss.
- **One WebGL context per page, not per instance.** Browsers hard-limit live WebGL
  contexts (commonly ~8–16) and evict the oldest. A chat transcript could easily mount
  a dozen indicators. A shared renderer driving multiple canvases — or a single context
  compositing to several targets — is a hard requirement, not an optimisation.
- Avoid per-frame allocation in the render loop entirely; reuse typed arrays and
  matrices.

## 9. Packaging and distribution

- A **zero-runtime-dependency framework-agnostic core** with thin framework wrappers is
  the established pattern for UI primitives that need to reach more than one ecosystem.
  It keeps the core testable in isolation and keeps wrapper packages trivial.
- **Bundle size is a product feature** for a drop-in indicator. A general-purpose 3D
  engine costs roughly 150 KB gzipped and tree-shakes poorly, against an estimated
  10–15 KB gzipped for a purpose-built renderer. Since we would use a very thin slice of
  such an engine — one draw call, one shader pair, one camera, one control scheme — the
  dependency is nearly all dead weight for a component whose entire job is to be a small
  ornament next to a line of text.
- **Subpath exports** (`.`, `./react`) with dual ESM/CJS output and generated
  declarations are the current baseline expectation for a published component library.
- Shaders authored as tagged template literals avoid a bundler plugin entirely, keeping
  consumer build configuration at zero.

## 10. Open questions carried into the architecture proposal

1. Package/scope naming for npm publication.
2. Exact inline default size and default particle budget per tier (tuning, resolved
   empirically in the demo).
3. Whether the large orbit view ships in Phase 1 or immediately after the ten states.
4. Whether a Web Components wrapper is in Phase 1 scope or deferred.

---

## References

Platform and standards material consulted (no comparable-product sources are cited, per
project constraints):

- MDN — `IntersectionObserver`, Page Visibility API, `prefers-reduced-motion`,
  `OffscreenCanvas`, `requestAnimationFrame`
- Khronos WebGL specification and conformance suite — point size limits, instancing
- WAI-ARIA authoring practices — `role="status"`, `aria-live`, `aria-busy`
