# Progress

Read `AGENTS.md` first, then this file. Update it at each meaningful checkpoint.

## Current checkpoint — 2026-08-02

| Item | Status |
| --- | --- |
| Product direction | Replaced the particle-head experiment with an original modular-mech activity indicator |
| States | First implementation: thinking, executing, listening, searching, reading |
| Animation language | SVG/CSS pose rig with no JavaScript frame loop |
| Frame plans | Written for every state in `docs/animation-system.md` and exported as data |
| Local showcase | Compact editorial marketing pass in progress at `http://localhost:5173` |
| Next review | Justin to judge the single-screen hero, smaller state studies, and shared grid |

## What was deliberately removed

The prior source tree implemented a particle-based human head, its geometry baking scripts, WebGL/Canvas renderer, and a dedicated demo. Justin asked for a clean directional reset. Those files were removed from the working tree; their historical commits remain recoverable in Git. `README.md` and `LICENSE` were retained and rewritten/kept for the new scope.

## Decisions retained

- This remains a client-only package with no network requirement.
- The React wrapper is optional; the state-plan data is framework-free.
- Reduced motion must leave an understandable static status symbol.
- The project stays deliberately small, high-performance, and easy to inspect locally.

## Marketing prototype direction — 2026-08-02

Justin explicitly brought a local marketing prototype into scope. The space composition was rejected and deleted on 2026-08-02. The active direction is a sparse black-and-white editorial page: one fixed-width editorial frame across navigation, hero, state studies, guide, and footer; Space Grotesk display type; DM Sans body type; a randomized one-time glitch reveal that deterministically resolves to the exact tagline; five compact state studies within the first screen; a compact installation/usage guide; and a single glass nav. The nav uses the locally installed MIT `liquid-gl` package with a CSS fallback; no CDN request is made. The WebGL lens is intentionally desktop-only because the library's own guidance cautions against large mobile panes; narrow screens use the same visual material without the lens. The product still uses an original TF monogram, not a third-party character mark. This local page is not approved for public deployment yet.
