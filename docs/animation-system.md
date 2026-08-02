# Modular-Mech Animation System

This is the approved direction as of 2026-08-02. The figure is original; it is a generic transforming machine, not a named or copied character.

## How the illusion works

The viewer must understand three things in under a second: **what the agent is doing**, **what form the machine is in**, and **that it is alive rather than frozen**.

Every sequence begins with a readable mechanical cause, then a functional result:

1. core reacts;
2. panels or limbs move toward a purpose;
3. a new silhouette locks;
4. a smaller continuous action confirms the state.

The shipped component does not serialize eight raster images. Named poses are design checkpoints. One SVG rig with nested groups smoothly passes between the checkpoints, stays crisp at any size, and can be interrupted safely during a real agent state change.

## Frame budget

For a polished hand-drawn transformation, 12–24 distinct drawings might be appropriate. For this reusable, 20–64px component, seven or eight **key poses** are the better budget: they give the eye an explicit cause/effect chain without bloating the package or making timing fragile. CSS supplies the in-betweens.

At inline size, only the following must read:

- **Thinking:** upright body + halo/core
- **Executing:** low horizontal rover + rolling wheels
- **Listening:** upright body + antenna/ripples
- **Searching:** low body + directional beam
- **Reading:** upright body + bright data plate

The large demo view exposes the extra pose detail for review.

## State sequences

### Thinking — 7 poses

`parked → ignition → rise → settle → consider → connect → held thought`

Wheel pods imply a little height change; arms open a few degrees, then remain composed. The differentiated subframes are the core’s charge, visor’s small upward tilt, and two orbit paths crossing above it. Loop rhythm: slow, asymmetric, contemplative.

### Executing — 8 poses

`ready → arms in → compress → treads out → lock → drive → correct → cruise`

This is the most important silhouette change. The torso gets shorter, arms fold inward, wheel pods widen, and the chassis becomes horizontal before the wheels begin. The drive subframes rotate wheel dashes, shift the chassis a few pixels, and pulse the core. Loop rhythm: short, direct, mechanical.

### Listening — 7 poses

`still → attention → mast up → dishes open → receive → resolve → attentive`

The mast gives an unmistakable vertical attention cue. Side arms rotate outward like shallow receiving dishes, then two expanding ripples land at the core. Loop rhythm: patient with a gentle two-beat response.

### Searching — 8 poses

`scout → deploy → calibrate → sweep left → sweep center → sweep right → acquire → continue`

The lower scout posture distinguishes it from the listening state. A directional, narrow beam moves left-to-right from a raised sensor gimbal, then a quick core flash suggests a candidate result. Loop rhythm: deliberate sweep, brief confirmation, restart from the same angle.

### Reading — 8 poses

`stand by → brace → plate out → lean in → top line → next line → review → continue`

Arms reveal a rectangular data plate. The visor leans into it, while three small lines brighten in turn and the scan marker steps down. Loop rhythm: calm, vertical, and more measured than searching.

## Transition rule

When a host changes state, base groups transition for approximately 480ms with a soft mechanical ease. Do not wait for a prior loop to finish. The current posture is the valid starting position, and the next state's attachment fades/moves into place. This is essential: AI state changes are not synchronized to animation endpoints.

## Refinement checklist

- Test each state at 24px, 44px, 64px, and 152px.
- In grayscale, distinguish all five silhouettes without reading a label.
- Trigger state changes rapidly; no group should jump to an unrelated position.
- Enable reduced motion; each state must still retain its identifying attachment.
- Keep any future visual ornament subordinate to the primary functional silhouette.
