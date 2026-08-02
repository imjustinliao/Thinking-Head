# State Appearance Reset

All prior state artwork, key poses, CSS animation, SVG geometry, colour treatment, and
motion plans were deliberately removed on 2026-08-02.

The five public states remain available as semantic placeholders:

- Thinking
- Executing
- Listening
- Searching
- Reading

The next visual direction and implementation brief are held locally and are deliberately
not tracked in this repository. No earlier visual frame or animation plan is approved for
reuse.

## Rig skeleton — outline pass

The showcase now carries the part list the state rig will animate. Each part is authored
once at the origin and placed by a group transform, so a form change interpolates rather
than swapping shapes:

`chassis`, `roofPanel`, `cabin`, `wheelRear`, `wheelFront`, `sensor`, `accessory`,
`armLeft`, `armRight`, `legLeft`, `legRight`, plus a contact `shadow`.

Two canonical forms are defined — low vehicle and upright machine. Thinking, Listening,
and Reading are upright; Executing and Searching are the vehicle. Ambient loops, the
staged vehicle/upright transition, and material are still to be designed.
