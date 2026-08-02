# Progress

Read `AGENTS.md` first, then this file. Update it at each meaningful checkpoint.

## Current checkpoint — 2026-08-02

| Item | Status |
| --- | --- |
| Product direction | Replaced the particle-head experiment with an original modular-mech activity indicator |
| States | First implementation: thinking, executing, listening, searching, reading |
| Animation language | SVG/CSS pose rig with no JavaScript frame loop |
| Frame plans | Written for every state in `docs/animation-system.md` and exported as data |
| Local showcase | Reference-led centered state-stage pass in progress at `http://localhost:5173` |
| Next review | Justin to judge the new focal hierarchy, glass selector, and continuous glitch treatment |

## What was deliberately removed

The prior source tree implemented a particle-based human head, its geometry baking scripts, WebGL/Canvas renderer, and a dedicated demo. Justin asked for a clean directional reset. Those files were removed from the working tree; their historical commits remain recoverable in Git. `README.md` and `LICENSE` were retained and rewritten/kept for the new scope.

## Decisions retained

- This remains a client-only package with no network requirement.
- The React wrapper is optional; the state-plan data is framework-free.
- Reduced motion must leave an understandable static status symbol.
- The project stays deliberately small, high-performance, and easy to inspect locally.

## Marketing prototype direction — 2026-08-02

Justin explicitly brought a local marketing prototype into scope. The space composition and state-specific image backdrops were rejected and deleted on 2026-08-02. A reference review then established the active direction: one full-screen black stage; compact navigation at the edge; a readable, left-aligned tagline aligned with the control rail; one centered state indicator as the only large object; and one five-part glass selector below it as the sole visible frame. The tagline briefly mutates only 3–5 letters at irregular intervals and immediately restores. The selector has a raised outer rim and an inset inner rim; its active segment uses a pale state tint with black text. This local page is not approved for public deployment yet.

## Remaining plan

1. **Redesign all five state frames.** The current SVG mechanism and motion paths are functional placeholders only; replace their silhouettes, components, and micro-motion after visual direction is approved.
2. **Run the state distinction pass.** Check each redesigned state at inline and stage sizes, with rapid switching, reduced motion, grayscale, keyboard interaction, and 200% zoom.
3. **Prepare publishing.** Choose and register a final npm package name, publish a versioned package, then replace the local-path guide with the verified registry command.
4. **Finish public documentation.** Write the final README/API reference only after the frame redesign and package-publishing flow are signed off.
5. **Decide on public deployment.** The showcase remains local-only until Justin explicitly authorizes hosting.
