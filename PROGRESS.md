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
| **Step** | Project scaffolding and demo server setup (first actions §3) |
| **Last commit** | `065e282` — v0.4 - Add CLAUDE.md as single source of truth for vision constraints and architecture |
| **Dev server** | Not yet running |
| **Blocked on** | Nothing |

---

## Just completed

- **Research (first actions §1).** Rendering substrate, particle primitive, GPU-driven
  morphing, continuous-motion technique, head geometry sourcing, modality accents,
  accessibility, power behaviour, packaging. Written up in `docs/research-notes.md`,
  following the citation/naming rules — no comparable-product names in any tracked file
  (verified by scan). Notes that do name them live in gitignored `research-local/`.
- **Tech stack and geometry route proposed and approved by Justin (first actions §2).**
  See `CLAUDE.md` §5 for the full decision table and reasoning.
- **`CLAUDE.md` written (first actions §3).**

### Decisions locked in this session

1. Geometry: **procedural, generated in code** (SDF sampled to a blue-noise point set at
   build time) — chosen over a licensed base mesh and over a published parametric head
   model, because the rig comes free as parameters of the same generator and there is
   zero licence surface.
2. Renderer: **purpose-built WebGL2, zero runtime dependencies** — chosen over a
   general-purpose 3D engine on bundle size (~10–15 KB vs ~155 KB gzipped) and because
   the required shared-context architecture isn't provided by such an engine anyway.
3. npm package name: **`thinking-head`** (verified available on the registry).

---

## Next

1. Scaffold the package: `package.json` with subpath exports, TypeScript strict config,
   tsdown build, Biome, Vitest.
2. Stand up the Vite demo app and get the dev server running on `localhost:5173` — this
   must happen **before** building out states, and stay running for the whole project.
3. Plan mode → Justin's go-ahead → first Phase 1 milestone: one static head rendering.
4. Then `idle` state, then the remaining nine states one at a time, with a check-in
   after each.
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
