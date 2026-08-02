# Research Notes — Compact Agent Motion

Updated 2026-08-02.

## Decision

The indicator uses original inline SVG geometry animated with CSS. This was chosen over raster frame sequences, canvas, and a packaged animation runtime.

| Approach | Strength | Why it is not the primary route here |
| --- | --- | --- |
| Inline SVG + CSS | Small, sharp, themeable, no animation loop | Chosen |
| Generated image frames | Can show detailed illustration | Frame continuity is hard, adds asset payload, and makes recolouring difficult |
| Canvas | Useful for hundreds of independently moving marks | Needs a render loop and offers no benefit for this small articulated figure |
| Heavy animation runtime | Rich authoring tools | Adds a dependency and runtime work disproportionate to a 20–64px indicator |

## Performance findings

- The default figure uses a small fixed number of SVG paths/circles; it does not scale work with frame count.
- Animation is limited to transforms, opacity, dash offset, and simple SVG paint changes. There is no per-frame allocation or `requestAnimationFrame` work in package code.
- A state change is a CSS transition between nested group poses. Detail loops continue independently, making an unpredictable state change feel intentional rather than resetting a video.
- The component has no external asset, font, API, analytics, or network request.

## Accessibility findings

- The SVG is hidden from assistive technology; the wrapper has an `img` role and a state-derived accessible label.
- `prefers-reduced-motion` disables all cycles and leaves the relevant attachment visible: rover for executing, mast for listening/searching, data plate for reading.
- Consumers should provide nearby textual status where the activity needs explanation beyond the short label.

Platform references: [CSS prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [SVG accessibility](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_in_HTML#accessibility_considerations), and [CSS animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate).
