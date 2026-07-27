# Research Notes

Background research carried out before any architecture decision was made, covering
rendering substrate, GPU-driven particle animation, expression rigging, head geometry
sourcing, accessibility, power behaviour, and packaging.

**Scope note.** Comparable commercial and open source "AI is working" indicators were
reviewed as background on *concepts only* — rendering strategy, motion vocabulary,
accessibility affordances, sizing behaviour. No implementation, structure, naming, or
asset from any of them is used, referenced, or reproduced in this project, and none is
named here. Only techniques and platform-level standards are recorded. Academic papers
are cited normally in §10, which concerns the Phase 2 roadmap.

Figures verified July 2026.

---

## 1. Rendering substrate: Canvas 2D vs WebGL2 vs WebGPU

|  | Canvas 2D | WebGL2 | WebGPU |
|---|---|---|---|
| Availability | Universal | Effectively universal | ~82% global; Safari only since 26 / iOS 26 |
| Per-particle CPU cost | One draw call per particle | Zero (vertex shader) | Zero (vertex/compute) |
| Practical ceiling | ~1k sprites before jank | ~100k+ | ~1M+ |
| Fallback burden | None | Needs a no-GL path | Needs a WebGL2 path *and* a no-GL path |

Our working set is small by particle-system standards: roughly 60–200 particles at
inline sizes, low thousands in the large orbit view. That is one to three orders of
magnitude below where WebGPU's compute advantage begins to pay. WebGPU's win is
concentrated in simulation-heavy systems doing per-frame physics on 10⁵–10⁶ particles;
our motion is analytic and evaluated per-vertex.

**Conclusion.** WebGL2 is the primary target — it reaches effectively every device with
none of WebGPU's dual-path maintenance cost, and it is nowhere near the bottleneck at
our counts. A WebGPU backend stays a clean future addition behind the same renderer
interface. A non-GL fallback is still required, both for locked-down or headless
environments and as the natural reduced-motion rendering path.

## 2. Particle primitive: point sprites vs instanced billboard quads

Point sprites are the cheapest way to draw many particles, but they carry two platform
hazards that bite us specifically:

- **Size caps are inconsistent and low on a very common device class.** The spec only
  requires `ALIASED_POINT_SIZE_RANGE` to reach 1.0. Most desktop GPUs report 512–2048,
  but Apple silicon reports a maximum of **64**. A head rendered large, or on a
  high-DPR display where point size is multiplied by device pixel ratio, would silently
  clamp and visually break on a large share of our users' machines.
- **Whole-point clipping.** A point sprite is culled when its *centre* leaves the
  frustum, so particles vanish abruptly at the canvas edge instead of sliding off —
  visible during orbit and during outward "generating" motion.

Instanced quads (4 vertices plus per-instance attributes, one instanced draw call) avoid
both, and additionally allow per-particle rotation, non-uniform scale, and soft round
alpha falloff computed in the fragment shader. Instancing costs 4× the vertex shader
invocations, which at our counts is negligible — hundreds of instances is low thousands
of vertices against a 60fps budget measured in hundreds of thousands.

**Conclusion.** Instanced billboard quads, one draw call. The cost is theoretical; the
correctness win is not.

## 3. GPU-driven animation and expression morphing

The standard browser technique for morphing a particle cloud between shapes is to supply
two position attributes and `mix()` them in the vertex shader against a progress
uniform, with a time uniform driving continuous motion — no per-particle JavaScript per
frame. This is proven and cheap.

The **baked-target** form of it scales badly against our requirements, though. Ten states
each with a distinct expression means ten position buffers per head; blending arbitrary
state pairs at arbitrary moments means keeping several resident; and a developer-defined
custom state would be impossible without shipping a mesh baker to the client.

The alternative from rigging practice is **parametric deformation**: express expression
as a small set of named scalar controls — the blendshape/morph-target model formalised
by facial rig conventions such as the widely used 52-shape ARKit set, whose naming
discipline (`brow_`, `eye_`, `mouth_`, `jaw_` prefixes) is a useful reference for our own
much smaller control set — and evaluate the deformation *analytically* in the vertex
shader from uniforms.

**Conclusion.** Each particle carries static attributes (rest position, surface normal,
region id, per-region influence weights). Each state is a vector of ~15–20 scalar
controls. Blending two states is `mix()` over that scalar vector rather than over
position buffers, which makes arbitrary-time transitions, three-way blends, and
runtime-defined custom states all fall out of one mechanism. Per-frame CPU work reduces
to writing a handful of uniforms.

This also makes **developer-defined custom states genuinely feasible** rather than
aspirational, since a custom state is just a JSON-shaped object of the same scalars.
Recorded for the roadmap; not in Phase 1 scope.

## 4. Continuous motion, not one-shot animation

A state must look alive for 30+ seconds with no visible repeat, which rules out
fixed-length keyframe loops — they telegraph their period. Two techniques compose well
under the parametric model above:

- **Gradient/simplex noise sampled per particle**, using the particle's rest position as
  spatial seed and time as a fourth dimension: non-repeating, smooth, and evaluable
  entirely in the vertex shader. Per-state control of amplitude, frequency and
  anisotropy gives each state a distinct motion *texture* — slow isotropic drift for
  idle, sharp axis-aligned steps for executing, outward radial bias for generating.
- **Incommensurate sinusoids** (periods at irrational ratios) for the deliberate
  rhythms — breathing, head sway, gaze saccades. Their combined period is effectively
  infinite, so there is no perceptible loop point.

Neither has a start or an end, so entering or leaving a state at an unpredictable moment
is always phase-safe. This directly satisfies the spec's requirement that transitions
survive being triggered at random times.

## 5. Head geometry sourcing (no 3D artist on the project)

Four routes were evaluated. Full tradeoff comparison is in the architecture proposal;
the research findings are:

**A. Free/CC0 base mesh from an asset aggregator.** Widely available. Against:
provenance on aggregators is frequently unverifiable — re-uploads and model-generated
assets are common — which is a genuine liability for a public MIT repo. Many assets
advertised as free are CC-BY, not CC0. It also ships a binary asset, gives no control
over stylisation, and decisively provides **no expression rig**: authoring ten
expressions on a downloaded mesh is exactly the artist-hours we do not have.

**B. Procedural parametric head generated in code.** Build the head as an analytic
surface — a smooth-minimum union of quadric primitives (cranium, brow ridge, nose, jaw,
cheeks) evaluated as a signed distance field — then sample it to a point set at build
time. For: zero licence surface (100% original work), no binary assets, complete control
over stylisation, deterministic and seedable, every dimension live-tunable in the demo.
Critically, expression deformations are authored as *parameters of the same generator*,
so the rig comes for free. Against: reaching a *charming* result is an iteration
problem — pure implicit surfaces trend blobby, and legibility at 20–24px is not
automatic.

**C. A published parametric head model.** The best-known research head model is
available in a 2023 revision under CC-BY-4.0 (earlier revisions are non-commercial
research licences only, so the version distinction matters). It ships a real identity
and expression basis with jaw articulation, which is exactly the rig that route A
lacks. Against: registration and licence acceptance to obtain, attribution obligations
carried into an MIT repo, a binary/derived asset in the package, and — most relevant —
anatomically realistic proportions and a realism-trained expression basis, which pulls
against the spec's explicit "charming, not uncanny" goal.

**D. Text-to-3D generated mesh.** Rejected: unclear licence provenance for a public
repo, and the same missing-rig problem as A.

**The finding that reframes the choice: we do not need a mesh.** A particle head needs a
point set with per-point normals and region tags. Topology, UVs and edge flow are
irrelevant to us. Dropping the mesh requirement removes the artist bottleneck and
substantially strengthens route B.

**Decision revision after visual testing (2026-07-26).** Five procedural checkpoints were
rejected against dense human particle-head references. The result established a stronger
finding: recognisable anatomy is a data problem before it is a sampling problem. An official
upstream neutral-human asset explicitly released under CC0 resolves the provenance concern in
route A without an aggregator or attribution obligation. It is used only as offline bake input.
The repository and package ship no mesh or topology — only a compact quantised point set derived
from the head/neck surface, plus a deterministic baker that refuses input without an explicit
CC0 declaration. Expression regions and weights remain project-authored runtime metadata.

**Legibility at small sizes** is a sampling-density problem, not a geometry-fidelity
problem. At ~24px the head reads as a silhouette plus three or four landmark clusters
(eyes, brow line, mouth). Feature-weighted sampling — allocating disproportionate
particle budget to eyes, brows, lips and the jaw/silhouette contour while thinning
cheeks and cranium — preserves recognisability far better than uniform sampling at the
same count. Blue-noise/Poisson-disk distribution within each region avoids the clumping
and moiré that uniform random sampling produces at low counts; sphere marching makes
this tractable directly on a signed distance field without extracting an intermediate
mesh.

A further finding from reviewing how small indicators are actually built: a design that
is legible at 64px is *not* the same design at 20px, and the common answer is to tune
each size independently rather than scale one design. Since our spec requires a
continuous `size` prop rather than fixed presets, density and feature weighting must be
a **function of rendered pixel size**, evaluated at mount and on resize.

## 6. Modality accents

The requirement is a lightweight layer over the ten base states hinting at model
modality (text / audio / vision) without new sculpted expressions.

1. **Colour-only uniform** — cheapest, but colour alone is not perceivable by all users
   and is easily overridden by theming.
2. **Colour plus motion-texture modifier** — the accent contributes a small multiplier
   set over the state's own motion parameters (audio biased toward rhythmic vertical
   pulsing, vision toward horizontal scanning, text toward fine high-frequency
   shimmer), applied *after* state blending.
3. **A separate expression per state × modality** — 30 expressions; rejected as
   combinatorially unmanageable and against the spec's intent.

**Conclusion.** Option 2. Because state and accent are both parameter vectors, the accent
is a post-blend modifier on the same uniform set: a few extra uniforms, no extra shader
permutations, and it composes with any custom state added later. Carrying a motion
component as well as colour is also what keeps the accent from being colour-alone
information (§7).

## 7. Accessibility

- **`prefers-reduced-motion` should simplify, not delete, the indicator.** The status
  signal must survive the preference — the established pattern is a static frame or a
  slow opacity breath rather than an empty box. The media query can flip mid-session, so
  subscribe rather than read once.
- **`role="status"` with `aria-live="polite"`** announces state changes without
  interrupting. The canvas itself should be `aria-hidden` — a screen reader gains nothing
  from it — with meaning carried by adjacent visually hidden text. (`role="img"` plus
  `aria-label` is the alternative convention, appropriate when the indicator is treated
  as a static graphic rather than a live status; we want live status.)
- **`aria-busy="true"` belongs on the container whose content is loading**, which is the
  consuming application's element, not ours. Document it rather than set it.
- **Never rely on colour alone** to distinguish states — directly binding on the error
  state and on modality accents.
- **Throttle announcements.** A rapid state sequence must not produce a burst of screen
  reader chatter.
- Verify at 200% zoom and with reduced motion enabled.
- Spinning and pulsing animation can cause real physical discomfort for people with
  vestibular disorders; keep amplitude restrained even in the full-motion path.

## 8. Performance and power

- **Pause when not visible.** `IntersectionObserver` to stop the render loop offscreen,
  plus the Page Visibility API for background tabs. A status indicator in a long chat
  transcript is offscreen most of the time; this is the single largest power win
  available.
- **One WebGL context per page, not per instance.** Browsers hard-limit live WebGL
  contexts — commonly 16 on desktop and as few as 8 on mobile Chrome — and evict the
  oldest when exceeded. A chat transcript could easily mount a dozen indicators, so a
  shared renderer driving multiple canvases is a hard architectural requirement, not an
  optimisation. Contexts must also be explicitly released on unmount, and
  `webglcontextlost` handled with re-initialisation rather than left to fail.
- **Share one animation clock** across instances so that multiple indicators on a page
  stay in phase instead of shimmering independently.
- **Cap device pixel ratio.** Rendering at DPR 3 costs 9× the fragment work of DPR 1 for
  imperceptible gain at 24px. Cap at 2, lower on weak devices.
- **Device capability tiering.** Scale particle count, DPR cap and effect complexity from
  cheap signals (`hardwareConcurrency`, `deviceMemory`, GPU renderer string, coarse
  pointer), then adapt downward if measured frame time degrades.
- **Frame-rate governing.** A status indicator does not need 120fps; capping update rate
  below display refresh on low-tier devices saves meaningful battery with no perceptual
  loss.
- Avoid per-frame allocation entirely; reuse typed arrays and matrices.

## 9. Packaging and distribution

- A **zero-runtime-dependency framework-agnostic core with thin framework wrappers** is
  the established pattern for UI primitives that need to reach more than one ecosystem.
  It keeps the core testable in isolation and the wrappers trivial.
- **Bundle size is a product feature** for a drop-in indicator. A general-purpose 3D
  engine is roughly 155 KB gzipped and tree-shakes poorly, against an estimated 10–15 KB
  gzipped for a purpose-built renderer. We would use a very thin slice of such an engine
  — one draw call, one shader pair, one camera, one control scheme — so the dependency is
  nearly all dead weight for a component whose whole job is to be a small ornament beside
  a line of text. The shared-context requirement in §8 is also something a general engine
  does not provide for free.
- **Subpath exports** with generated type declarations are the current baseline
  expectation for a published component library. ESM-only is now widely viable; CJS
  output is a compatibility decision rather than a default.
- Build tooling: the long-standing default TypeScript library bundler is no longer
  actively maintained; its Rolldown-based successor is the current recommendation, with
  the older tool still the conservative choice on community size.
- **Shaders authored as tagged template literals** avoid a bundler plugin entirely,
  keeping consumer build configuration at zero.
- **Theme detection** in this component class conventionally cascades: ancestor
  `data-theme` attribute, then a `dark`/`light` class (the Tailwind/shadcn convention),
  then `prefers-color-scheme` — observed live rather than read once.

## 10. Phase 2 prior art (planning only — not built in Phase 1)

Standard academic references for single-image 3D head reconstruction, to inform the
roadmap document. Cited normally; this section is unrelated to the scope note above.

- **GaussianAvatars** — binds 3D Gaussians to an explicit parametric face mesh and
  optimises the Gaussian parameters, giving mesh-driven animation control.
- **FlashAvatar** — embeds a uniform Gaussian field in a parametric face model and learns
  spatial offsets for detail; reaches ~300 FPS rendering with minutes-scale training.
- **HeadGaS** (ECCV 2024) — attributes Gaussians with latent features weighted by a 3DMM
  expression vector, achieving real-time animatable heads.
- **Splatshot** — 3D face avatar generation from a single unconstrained photo.
- **Generalizable / feed-forward single-image and sparse-view head avatars** — recent
  work removing the per-subject optimisation requirement that makes the above
  impractical to run per user.

The common thread across all of them is a **fixed-topology parametric head model** as the
geometric prior. That is the key forward-compatibility fact for us: because the runtime
consumes a tagged point set rather than a mesh, region tagging and rig weights can be
assigned once against that fixed topology and reused for every user, server-side and
offline, exactly once per uploaded photo. **Phase 1's data format therefore does not need
to change for Phase 2**, provided we define it as a tagged point set from the start.

Note that the licence revision of any parametric head model used matters (see §5C).

## 11. Voxel-lattice rendering and level of detail — superseded history

Added after the first renders showed that scattered surface points cannot produce the
dense, grid-aligned particle-head look the project is aiming at.

This route was superseded on 2026-07-26 after the radial field feeding the lattice was rejected.
The historical findings about constant on-screen grain and lazy LOD remain useful; the claim that
world-aligned cells are required does not. The references are surface-following particles or
tiles, and coherent source anatomy matters more than alignment to a Cartesian grid.

**Lattice, not stochastic sampling.** In dense particle-head artwork the particles occupy a
regular grid and tile the surface contiguously. That alignment is doing the work: rows and
columns of cells give the eye a structure to read the form against. Blue-noise sampling
deliberately removes exactly that regularity, so no amount of tuning spacing or dot size
reproduces the look. A lattice additionally makes uniform particle size a property of the
data rather than a convention the renderer has to maintain.

**Hierarchical narrow-band voxelisation.** A dense N³ scan is prohibitive at useful
resolutions. Standard practice is to refine only where the surface can be, so cost scales
with surface area rather than volume. Where the field is a true signed distance function it
is 1-Lipschitz, which makes a half-diagonal containment test conservative — a block of side
s can only contain surface if the field at its centre is within s·sqrt(3)/2 of zero — so
pruning cannot discard geometry. Refinement must address blocks in *target-lattice* indices;
chaining intermediate resolutions only works when every step is an exact integer factor.

**Detail-adaptive level of detail.** Recent GPU reconstruction work varies voxel resolution
by local detail ("resolution where it counts"), preserving fine structure while keeping
uniform regions cheap. The same principle applied to rendered size gives the LOD scheme
here: several resolutions, the renderer selecting whichever puts a cell near a fixed
on-screen size, levels built lazily and cached. This is what holds particle size constant on
screen while the head's pixel size varies over more than a decade.

**Lighting over painted brightness.** Once geometry carries the form, per-region brightness
should be read as material albedo — features darker than skin, as on a real face — with
directional light and baked occlusion doing the modelling. Painting features bright is only
necessary when there is no geometry behind them, and actively fights a sculpted surface.

**Licensed parametric head models.** Re-examined and rejected for this project: obtaining
them requires registration and licence acceptance, they carry attribution obligations into
an MIT repo, and they ship as binary assets — all three conflict with the zero-asset,
no-registration constraints. They remain rejected; the selected CC0 source has none of those
conditions and is converted to topology-free numeric data before runtime.

## 12. Baked canonical human surface

The selected architecture separates anatomy authoring from runtime rendering:

1. Parse an explicitly CC0 neutral human OBJ offline and crop to the head and neck.
2. Compute surface normals from the cropped faces and add face centroids to increase candidate
   density without retaining topology.
3. Seed crown, chin, nose, paired eyes, mouth, brows, ears, jaw and neck landmarks.
4. Build a progressive farthest-point order, weighting the front of the face so eyelid, nose and
   lip structure receives more density.
5. Bake local ambient occlusion, quantise positions to signed 16-bit, normals to signed 8-bit and
   occlusion to unsigned 8-bit, then embed the encoded bytes in TypeScript.
6. At runtime, decode once and construct each LOD from a prefix. Region tags and rig weights are
   derived after global proportion scaling, so the Phase 2 point-set contract is unchanged.

The maximum level is 4,096 particles. Lower levels preserve the same identity because they are
prefixes rather than independently resampled surfaces. The source mesh, its topology and the
baking toolchain are absent from consumer execution; rendering remains completely client-side.

## 13. Open questions carried into the architecture proposal

1. Package/scope name for npm publication.
2. Default inline size and default particle budget per device tier — tuning, resolved
   empirically in the demo.
3. Whether the large interactive orbit view ships in Phase 1 or immediately after the
   ten states.
4. Whether a Web Components wrapper is Phase 1 scope or deferred.
5. ESM-only vs dual ESM/CJS output.

---

## References

Platform and standards material consulted. No comparable-product sources are cited, per
the scope note; §10 academic references are listed inline above.

- MDN — `IntersectionObserver`, Page Visibility API, `prefers-reduced-motion`,
  `prefers-color-scheme`, `WEBGL_lose_context`, `requestAnimationFrame`
- Khronos WebGL 2 specification and conformance suite — point size limits, instanced
  drawing
- WebGL2 Fundamentals — cross-platform issues, instanced drawing, point size workarounds
- WAI-ARIA Authoring Practices — `role="status"`, `aria-live`, `aria-busy`
- caniuse / GPUWeb implementation status — WebGPU availability
- Poisson-disk and blue-noise surface sampling literature — sample elimination, sphere
  marching on implicit surfaces
- [MakeHuman Community official asset repository](https://github.com/makehumancommunity/makehuman-assets/tree/master/base/proxymeshes/female_generic)
  — the source OBJ header explicitly records the September 2020 CC0 release
- [MakeHuman Community licensing FAQ](https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html)
  — confirms exported human models and core assets are CC0
