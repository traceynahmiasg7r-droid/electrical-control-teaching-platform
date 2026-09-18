# Stage 4 — FLOW_DATA_BLOCKER

Status: BLOCKED; Stage 4 is not complete. Solver, static Geometry and Stage 3 Active behavior remain unchanged. The unaccepted Stage 4 flow draft was removed. No commit, push or merge.

## Reproduction

Serve the repository at http://127.0.0.1:8765 and run:

```powershell
$env:PLAYWRIGHT_CORE_PATH='C:\Users\75953\Desktop\忆阻器pdf与参考文献包\.npm-cache\_npx\31e32ef8478fbf80\node_modules\playwright-core'
node output/playwright/audit-stage4-blocker.cjs
```

The audit operates only through the current in-browser module and reads graph definitions. It does not patch Solver, active membership or Geometry.

Affected states: QF1 closed, SB1 released, FR1 normal, with either SB2 pressed, KI1 self-hold after release, SB3 held during reversal, or KI2 self-hold after release.

| Frozen SVG wire | Electrical ID | Frozen SVG path | Solver endpoints |
|---|---|---|---|
| qf_fu_l1 | mw_02 | M220 82 L220 94 | qf1_l1_out = fu1_l1_in = 335,316 |
| qf_fu_l2 | mw_05 | M282 82 L282 94 | qf1_l2_out = fu1_l2_in = 393,316 |
| qf_fu_l3 | mw_08 | M346 82 L346 94 | qf1_l3_out = fu1_l3_in = 452,316 |

Each visible wire is 12 drawing units long. In each of the four running states:

- All three are absent from activeMainWireIds and activeControlWireIds.
- None has a phase entry in activeMainWirePhaseMap.
- The adjoining qf1_edge_l1/l2/l3 and fu1_edge_l1/l2/l3 are all active main edges.
- Stage 3 correctly follows its current ID mapping and does not draw an active overlay on these three visible wires.

The graph search represents each pair as the same node; its path membership does not traverse the zero-length self-loop. This is a model/visual subdivision issue, **not** evidence of an electrical topology mismatch.

## Exact current outputs

Forward self-hold activeMainWireIds:

```text
mw_01 mw_03 mw_10 mw_13 mw_22 mw_23 mw_24
mw_04 mw_06 mw_11 mw_14 mw_25 mw_26 mw_27
mw_07 mw_09 mw_12 mw_15 mw_28 mw_29 mw_30
```

Forward self-hold activeControlWireIds:

```text
mw_07 mw_09 cw_01 cw_02 cw_05 cw_06 cw_07 cw_08
cw_09 cw_10 cw_19 cw_20 mw_06 mw_04
```

Reverse self-hold activeMainWireIds:

```text
mw_07 mw_09 mw_20 mw_21 mw_22 mw_23 mw_24
mw_04 mw_06 mw_18 mw_19 mw_25 mw_26 mw_27
mw_01 mw_03 mw_16 mw_17 mw_28 mw_29 mw_30
```

Reverse self-hold activeControlWireIds:

```text
mw_07 mw_09 cw_01 cw_02 cw_13 cw_14 cw_15 cw_16
cw_17 cw_18 cw_19 cw_20 mw_06 mw_04
```

All operation states, active edge IDs, phase maps, legacy direction maps and per-wire evidence are saved in stage4-blocker-evidence.json.

## Why implementation pauses

Animating only the frozen Active references leaves three breaks between QF1 and FU1. Animating these currently inactive wires anyway would expand Stage 3's Active semantics and cause Flow outside an Active overlay. Adding parallel Flow geometry would violate the single-Geometry requirement.

The current Facade also does not export the legacy direction maps. The legacy snapshot helper does produce direction metadata, so missing direction export alone is not being asserted as an electrical blocker. It must be explicitly mapped to the new SVG orientation, not copied from old coordinates.

## Minimal proposed supplement — not applied

Keep graph search, contact logic, Solver states, phase-sequence decisions and all Geometry unchanged. Add an explicit, tested visualization-binding mapping for these three same-node subdivisions, gated by the corresponding pair of Solver active supply edges. Use the resulting shared membership for both Active and Flow; never animate the mechanical crossbar or component outline.

This requires approval for a narrow Stage 3 visual-membership exception. It must not silently modify raw Solver active IDs. A Solver-output expansion is a separate option requiring explicit authorization; it has not been performed.

For device interiors, reuse only existing conductive strokes. The present coil symbol is an outline rectangle, not a winding path; it must not be animated around the outline or replaced with invented internal coordinates.

## Additional frozen visual risk

The forward baseline screenshot also shows a solid red QF1 hitbox outline crossing the three source wires. In styles.css, the active-component rect stroke selector has higher specificity than the hitbox stroke:none selector. This is not an electrical connection, but can look like a three-phase short and conflicts with the user's newer visual-semantic rule. It has not been changed during this blocked audit. The minimal remedy is a narrowly scoped hitbox stroke:none override, without moving any component or wire. Never use the hitbox as a Flow reference.

## Verified baseline

- Stage 3 Active Path: 106 assertions passed.
- Electrical regression: 331 assertions passed; 96 combinations; legacy tests included.
- Geometry acceptance passed; SHA256: 248befb2c0522e4f72bb9574baa50b0cd3afd195a8a069bd40617e1b28ffb018.
- Browser page errors: 0.
- Flow nodes and Flow animations after draft removal: 0.
- Runtime scope timeouts/intervals: 0/0.
- Evidence screenshots: stage4-blocker-forward-baseline.png and stage4-blocker-reverse-baseline.png. These are Stage 3 baseline evidence, **not** Stage 4 acceptance A–N.
- Stage 4 A–N dynamic screenshots and Current Flow acceptance are pending approval and implementation.
