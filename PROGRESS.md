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
| **Step** | Scaffolding complete. Next up: plan mode for the first renderer milestone |
| **Last commit** | `1b64ce5` — v0.9 - Restyle demo as high-contrast liquid glass observatory with animated lighting |
| **Dev server** | Running at **http://localhost:5173** (`npm run dev` from repo root) |
| **Blocked on** | Justin's go-ahead on the static-head plan |

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

1. **Plan mode → Justin's go-ahead → first renderer milestone: one static head
   rendering.** Scope: the SDF head generator, blue-noise feature-weighted sampling into
   the tagged point set, the WebGL2 instanced-quad renderer, and the shared-context
   manager. No animation yet.
2. Then `idle` state (first continuous motion + the noise/sinusoid motion system).
3. Then the remaining nine states one at a time, with a check-in after each.
4. The React wrapper and the `./react` subpath export — currently `package.json` exports
   only `.`; add the subpath when the wrapper lands.
5. Phase 2 architecture doc (`ROADMAP.md`) once the Phase 1 data format is stable — flag
   Justin when we reach that point.
6. README and LICENSE last, only after Justin confirms Phase 1 is correct.

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
