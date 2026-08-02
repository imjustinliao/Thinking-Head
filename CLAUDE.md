# Thinking Head — Project Context

This document preserves the current product decision for future sessions. Read `AGENTS.md` and `PROGRESS.md` first; they are the operating instructions and current checkpoint.

## Current direction

The particle-head experiment was retired on 2026-08-02. Its commits remain in Git history for reference, but no old renderer, bake script, demo page, asset, or package export belongs in the active product.

The active component is an original modular-mech activity indicator. It uses a small inline SVG with CSS animations, designed to read at 20–64px yet scale to a large local inspection view. It represents five AI agent states:

| State | Primary form | Readable action |
| --- | --- | --- |
| Thinking | upright mech | core/halo contemplation cycle |
| Executing | compact rover | body folds, wheels drive |
| Listening | upright receiver | mast raises, signal ripples arrive |
| Searching | low scout | gimbal scans with a narrow beam |
| Reading | upright mech | data plate opens, scan marker advances |

## Technical decision

Inline SVG + CSS animations is the right first implementation for this size of component:

- It is crisp at every device pixel ratio and naturally themeable with `currentColor`.
- It needs no downloaded sprite sheet or raster frame pack, eliminating consistency, loading, and licensing issues.
- It has no JavaScript frame loop. CSS handles compositor-friendly transforms and opacity, and the browser can stop painting hidden/background content.
- It can transition from state to state because each state’s base pose uses normal CSS transitions while its detail loops use independent continuous cycles.

The tradeoff is intentional: this is a focused 2D status language, not a physically simulated 3D character. If later work needs 3D, it must preserve the present five-state contract and re-evaluate performance on low-end phones first.

## Frame principle

The component is not a collection of image frames. It is a reusable pose rig. A state has 7–8 named key poses for visual design and QA, but its shipped animation uses a small number of nested SVG groups: frame, arms, rover chassis, sensor, halo, beam, and data plate. Combining those groups gives a transforming illusion with much less payload and clean interruption semantics.

The full pose sequences are in `docs/animation-system.md` and the public data mirror is `src/core/states.ts`.
