# Progress

Read `AGENTS.md` first, then this file. Update it at each meaningful checkpoint.

## Current checkpoint — 2026-08-02

| Item | Status |
| --- | --- |
| Product direction | Renamed the demo product to Thinking TF and reset all visual design |
| States | Thinking, executing, listening, searching, and reading are semantic placeholders only |
| Animation language | Rig part list and two canonical forms defined; motion still to be designed |
| Frame plans | Cleared; the next implementation brief is local-only and never committed |
| Local showcase | Milestone 1 composition at `http://localhost:5173` |
| Next review | Milestone 1 sign-off, then library-backed glass |

## Milestone 1 — page composition and controls, 2026-08-02

Built the structural pass of the new direction before any material work:

- One design-token layer: 12-column grid rails, a single spacing scale, one radius family,
  and one cool key light from the upper left with a faint reflected fill.
- Navigation: three circular controls centred at the top. The middle control expands from
  the centre on hover and keyboard focus to reveal **Thinking TF** with its mark pinned
  left, which pushes the outer circles outward by the same distance. Touch devices get the
  control already open rather than a state they cannot reach.
- A single state stage as the focal object, with a five-option segmented selector built on
  native radios so arrow-key roving and single-selection semantics are not re-implemented.
- Temporary rig outlines establishing the part list and both canonical silhouettes.
- Original brand mark: an open block with a solid core beyond its edge.

Deliberately not done yet: liquid glass, ambient state motion, and the staged
vehicle/upright transition.

### Verified

`lint`, `typecheck`, `test`, and `build` all pass. State switching was exercised in the
running page: each option repositions every rig part to the correct canonical form and
updates the caption.

### Verified after review

Keyboard-focus expansion of the navigation measured in the running page: the brand control
grows 52px to 184px and both outer circles move outward by exactly 66px each, with the mark
pinned at a constant 15px inset. Hover uses the same declaration as focus.

## Reference reading — 2026-08-02

Justin supplied nine references (two architecture, three abstract, three Rams/industrial,
one glass). They are not in the repository, so the decisions taken from them are recorded
here:

| Source | What was taken |
| --- | --- |
| Swept-surface architecture | Seam lines that follow curvature rather than cut across it; one strong silhouette in large quiet space |
| Finned facade | Repeated structural ribs with progressive rhythm, sweeping into a curve |
| Sphere over a perforated plane | The stage: a receding dot floor converging to a horizon, with the light source behind the object |
| Rim-lit ring | Bright edge only where the surface faces the light, dark core |
| Lensed disc | Bloom falloff and arc behaviour only — its warm hue is rejected, the field stays cool per the brief |
| Braun products | Rows of identical circular controls, flat off-white field, tight alignment, one accent |
| Device concept | A plate with a single primary control |
| Frosted system panel | Glass belongs on controls, not the page; selected segment is a lighter raised plate |

## Milestone 2 — stage light and space, 2026-08-02

- Rebuilt the stage as a lit space: a perforated floor in perspective whose dots compress
  toward a horizon, plus a rim light behind the object with bloom falloff.
- The scene box now matches the rig's viewBox aspect exactly, so the horizon, the floor,
  and the object's feet are placed from one number (`--ground: 88.69%`) rather than being
  eyeballed across two coordinate systems. Both canonical forms sit on it correctly.
- The rim light is biased left so it agrees with the upper-left key instead of reading as a
  competing source; the key stays dominant.
- Removed the duplicated ground line, and moved the ground out of the rig entirely — the
  environment belongs to the page, not the shipped component.
- Selector pulled onto the caption's rails (8 of 12 columns) so it reads as subordinate.
- Tightened the spacing scale on narrow viewports so the stage and its controls stay in one
  view on a phone.

### Verified

`lint`, `typecheck`, `test`, and `build` pass. Checked in the running page at 1280x800 and
375x812: no horizontal scroll at either size, 44px tap targets, selector wraps to two
columns on mobile. Arrow-key selection moves through the radio group natively and
repositions every rig part to the correct form.

### Not yet done

Rig material and all state motion.

## Milestone 3 — library-backed liquid glass, 2026-08-02

`liquid-glass-react@1.1.1` (MIT, peer React >=19) is installed in the **demo workspace
only**. The published `thinking-head` bundle is unchanged and does not reference it.

### What the library actually does

Auditing it before wiring changed the integration:

- It renders **three siblings** and centres itself with `top`/`left: 50%` plus a `-50%`
  translate. It is built for floating panels; dropped into an in-flow flex row it breaks
  the layout.
- It ships **Tailwind class names** (`bg-black`, `text-white`) that are inert here, and its
  inner element uses the class `glass`, so our wrapper is namespaced `surface`.
- `blurAmount` is multiplied by 32 internally, so the documented default of `12` is a
  388px blur. We pass `0.09` for roughly a 7px frost.
- It handles mouse enter/leave/down/up only — **no focus, no touch**.
- It re-measures itself only on mount and on `window.resize`, so a control that reflows
  leaves the SVG filter region stale and the frosted layer gets clipped to the old box.
- There is **no `requestAnimationFrame` loop**, which the brief required us to avoid.

### How it is used

- The glass is a material layer sized to each control and sitting **behind** the real
  semantic markup, so focus, press, and touch keep working on our own elements.
- One shared pointer listener per region (`GlassRegion`) feeds every surface inside it, so
  a group of controls refracts against the same pointer. Passing both `globalMousePos` and
  `mouseOffset` also stops the library attaching its own listener per instance.
- Stale filter regions are fixed by committing the settled size and remounting on it. The
  settle window is per-surface: 16ms for the nav, whose brand control animates its own
  width, and 160ms for the selector, where resizes only come from the viewport.
- `shader` mode is used on the selector as the brief asks. The nav uses `standard`: shader
  is the only mode that regenerates a displacement map on every resize, which is the wrong
  trade for a control that animates its width.
- Glass is on the three nav controls and the five-state selector, nowhere else.

### Verified

`lint`, `typecheck`, `test`, `build` pass, and the published bundle is still 0.14kB/0.45kB.
In the running page: all four surfaces report material on; the selector track and its
material agree exactly at 682x54 desktop and 331x150 mobile; a live viewport resize settles
with the material matching the control again; and the nav brand control's material tracks
its expansion from 52px to 184px. 40 synthetic pointer moves with a forced style and layout
flush after each cost 1.7ms total (0.04ms per move) at a 375px viewport. No console errors.

Two bugs were found and fixed here: the track's surface was 682px while the track itself
shrank to 484px (a flex child that would not fill, now grid), and the stale filter region
was drawing seams across the selector on mobile.

### Not verified

GPU-side filter rasterisation cost is not captured by the timing above. The pane does not
deliver synthetic hover or click to the page, so pointer-driven refraction has not been
seen moving; the geometry was confirmed by measurement and the keyboard path instead. The
Safari, Firefox, and `prefers-reduced-transparency` fallback was confirmed by forcing the
`data-surface="off"` branch, not on those engines.

## Milestone 4 — two-part page and the room, 2026-08-02

Justin asked for less height, a scroll-driven reel instead of stacked sections, a clearer
state heading, and a three-dimensional backdrop. The page is now two parts.

### Part one: the reel

A track one viewport taller than its pin, holding a sticky stage. Identity and States each
own half the pinned scroll; a progress indicator sits top-right on the same grid rails as
the content, showing `01 IDENTITY` / `02 STATES` with the active step lit.

- Slide changes cost two IntersectionObserver callbacks for the whole section — no scroll
  handler and no frame loop.
- Each mark spans the entire scroll range its slide owns rather than being a single pixel.
  A one-pixel mark is skipped by a flicked wheel or a programmatic jump, which left the
  wrong slide showing; this was found and fixed by jumping the scroll position directly.
- The progress steps are real buttons. Inactive slides are `visibility: hidden` and so are
  out of the tab order, which would strand a keyboard user — the steps are how they reach
  a slide without scrolling. Verified: the inactive slide's five radios are unreachable,
  and the step button scrolls to its slide and makes them focusable again.
- The state name is now the loudest type after the product name: large, light, uppercase,
  with an `AGENT STATE` eyebrow above and the form below.

Total height went from about 3.2 viewports to 2.65, and the whole page is two sections.

### Part two: the guide

Unchanged in content; the footer now closes it rather than standing alone.

### The room

A fixed backdrop behind everything: one overhead key, a floor receding to a horizon, and a
lit void on that horizon acting as the source the floor and the object are lit by. Moving
to the state slide brings the void forward and opens it up.

- The void sits at 68% width, where the object stands, so the left-aligned type never
  competes with it. Its mass is defined by a soft edge and its rim, not by an outline.
- The rim arc holds the upper left and only breathes seven degrees. A full rotation was
  tried first and rejected: it reads as the light source orbiting, which contradicts every
  other lit edge on the page.
- A specular glint sweeps periodically, and an inline-generated grain keeps the gradients
  reading as a photographed surface rather than banding. No downloaded asset.
- Everything that moves animates transform or opacity only.

### Verified

`lint`, `typecheck`, `test`, `build` pass; published bundle unchanged. Checked at 1360x860,
779x796, and 375x812: no horizontal scroll at any size, the active slide fits the viewport
exactly, text sits on rails 1–5 with the stage on 7–12 at desktop and stacked below 64rem,
and the progress indicator right-aligns to the rails. Two collisions were found and fixed:
the horizon cut through the hero description, and the mobile progress row overlapped the
fixed nav. No console errors.

### Not verified

The reel was driven by programmatic scrolling and direct clicks, not by a real wheel or
trackpad, so the feel of the transition under natural scrolling is unconfirmed.

## What was deliberately removed

The prior source tree implemented a particle-based human head, its geometry baking scripts, WebGL/Canvas renderer, and a dedicated demo. Justin asked for a clean directional reset. Those files were removed from the working tree; their historical commits remain recoverable in Git. `README.md` and `LICENSE` were retained and rewritten/kept for the new scope.

## Decisions retained

- This remains a client-only package with no network requirement.
- The React wrapper is optional; the state-plan data is framework-free.
- Reduced motion must leave an understandable static status symbol.
- The project stays deliberately small, high-performance, and easy to inspect locally.

## Marketing prototype reset — 2026-08-02

Justin rejected every prior marketing-page treatment, including the glass CSS, background
imagery, state SVGs, colour choices, selector, navigation, and motion. They were removed from
the working tree. The showcase now keeps only the requested content and temporary state
appearance placeholders. The local-only `research-local/claude-code-handoff.md` is the single
actionable design and implementation brief for the next agent; it must never be committed. This
local page is not approved for public deployment.

## Remaining plan

1. **Implement the new marketing design and navigation** exactly from the Claude Code handoff.
2. **Design and implement the original 2D state rig**, then check state distinction at inline and stage sizes, rapid switching, reduced motion, grayscale, keyboard interaction, and 200% zoom.
3. **Prepare publishing.** Choose and register a final npm package name, publish a versioned package, then replace the local-path guide with the verified registry command.
4. **Finish public documentation.** Replace this interim README only after the state design and package-publishing flow are signed off.
5. **Decide on public deployment.** The showcase remains local-only until Justin explicitly authorizes hosting.
