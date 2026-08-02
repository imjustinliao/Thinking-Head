# Progress

Read `AGENTS.md` first, then this file. Update it at each meaningful checkpoint.

## Current checkpoint — 2026-08-02

| Item | Status |
| --- | --- |
| Product direction | Replaced the particle-head experiment with an original modular-mech activity indicator |
| States | First implementation: thinking, executing, listening, searching, reading |
| Animation language | SVG/CSS pose rig with no JavaScript frame loop |
| Frame plans | Written for every state in `docs/animation-system.md` and exported as data |
| Local showcase | First space-marketing visual milestone complete at `http://localhost:5173` |
| Next review | Justin to judge the space hero, mechanical world, and five-state constellation before further visual refinement |

## What was deliberately removed

The prior source tree implemented a particle-based human head, its geometry baking scripts, WebGL/Canvas renderer, and a dedicated demo. Justin asked for a clean directional reset. Those files were removed from the working tree; their historical commits remain recoverable in Git. `README.md` and `LICENSE` were retained and rewritten/kept for the new scope.

## Decisions retained

- This remains a client-only package with no network requirement.
- The React wrapper is optional; the state-plan data is framework-free.
- Reduced motion must leave an understandable static status symbol.
- The project stays deliberately small, high-performance, and easy to inspect locally.

## Marketing prototype direction — 2026-08-02

Justin explicitly brought a local marketing prototype into scope. The prior utilitarian showcase styling is replaced rather than incrementally restyled. The new page is an original high-contrast space composition: a primary star, small distant planets, orbital guide marks, and a large partially revealed mechanical world with a bright atmospheric rim and dark plated surface. It uses CSS/SVG layers only—no third-party image, asset, character name, or network request—and respects reduced-motion, reduced-transparency, and increased-contrast settings. This local page is not approved for public deployment yet.
