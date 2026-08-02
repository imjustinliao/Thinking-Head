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

### Not yet verified

Hover and keyboard-focus expansion of the navigation, and full-page visual review, still
need a visible browser. Reference images for material and proportion have not been
supplied yet, so no final visual detail is fixed.

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
