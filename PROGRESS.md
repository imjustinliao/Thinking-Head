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
| **Last commit** | `980efed` — v0.7 - Add live demo showcase with state gallery size and speed controls |
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
