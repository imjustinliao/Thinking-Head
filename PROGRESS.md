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

Liquid glass, rig material, and all state motion. The pane's synthetic pointer events do
not reach the page, so click and hover were confirmed through the keyboard path and direct
measurement instead.

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
