# AGENTS.md — Thinking Head

Read this file and `PROGRESS.md` before making changes. Keep both current at every meaningful checkpoint.

## Product direction — updated 2026-08-02

`thinking-head` is an installable UI component for AI activity. The current product direction is an original, compact **modular-mech** indicator: a machine changes posture and function to make an agent's activity understandable at a glance.

The five Phase 1 states are `thinking`, `executing`, `listening`, `searching`, and `reading`.

Each state has:

- a distinct silhouette or functional attachment;
- a continuous loop that remains coherent if interrupted at any instant;
- a written sequence of key poses in `docs/animation-system.md`;
- a static, meaningful reduced-motion pose.

Do not use character names, logos, visual assets, code, or structural imitation from third-party media or comparable components in the reusable component. The implementation and product language must remain original and generic. User-supplied images may appear only in the local marketing prototype, never in the published package.

## Non-negotiables

1. The component is 100% client-side: no server, API key, network call, telemetry, or downloaded asset is needed to render it.
2. Use inline SVG plus CSS/WAAPI-class browser animation for Phase 1. No image frame sequences, canvas render loop, or heavyweight animation runtime without an explicit new decision.
3. Performance matters. The inline default must be small and cheap: no JavaScript animation loop, no per-frame allocations, no filter stacks, no external font dependency.
4. Support `prefers-reduced-motion` with a recognisable static pose. The SVG itself is decorative; the wrapper needs an accessible state label.
5. Keep the core data (`src/core/states.ts`) framework-free. React is an optional wrapper exported from `thinking-head/react`.
6. The local Vite showcase runs on `http://localhost:5173`. It is a cinematic, local-only marketing prototype: it uses user-supplied state backdrops, locally bundled Space Grotesk and DM Sans, and compact CSS glass navigation controls. Do not publish or deploy it without Justin explicitly asking.
7. Keep code clean and small. Comments should explain non-obvious product or performance decisions only.
8. Each user-authorized change is its own commit, formatted `v#.# - Message` (1–15 words, no trailing period), then pushed to `main`. Never force-push, reset hard, or rewrite history without explicit permission.

## Current architecture

```
src/core/states.ts      public state names and animation storyboards
src/react/              optional React wrapper and scoped SVG animation styles
src/index.ts            framework-free exports
src/react.ts            React entrypoint
demo/                   local live inspection showcase
docs/animation-system.md key-pose plans and visual rules
```

The outer component supplies only CSS variables (`size`, loop duration, pause state). The browser performs animation natively, so a page with many indicators does not accumulate requestAnimationFrame work.
