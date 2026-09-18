# Stage 4 Current Flow

Implementation and automated verification complete; awaiting manual acceptance. No Playback, Teaching Highlight or Callout integration; no commit, push or merge.

## Stage3 Visual Membership Clarification

Only the two user-approved exceptions were applied:

1. The binding derives visual IDs qf_fu_l1/l2/l3 for the existing, frozen QF1→FU1 segments. For each phase, both corresponding QF/FU main active edges must be present AND conductive, an active main wire must carry that phase, and the Solver motor must be running. The immutable derived list is separate from Raw Solver IDs. Active and Flow both select from the same visualActiveWireIds list.
2. A QF1-specific CSS selector makes its hitbox stroke:none and fill:transparent. Other components' Stage3 overall highlight styles are unchanged.

The old STAGE4_BLOCKER.md and stage4-blocker-evidence.json remain historical evidence. The authorized binding resolves that blocker without modifying graph topology or Raw Solver output.

## Flow implementation boundaries

- Base / Active / Flow wire references share #ch02-reverse-wire-* with exactly the same path.
- Existing device conductive strokes are tagged with IDs, then referenced by use elements. Their path coordinates and accepted contact shapes are unchanged.
- QF, FU1, KI main/auxiliary contacts, SB contacts and FR1 conductive strokes animate only when their actual Solver edge is active and conductive.
- FU2 uses its already documented cw_01/cw_20 equivalent-conductive mapping. No FU2 device or edge was added to Solver.
- Coil and motor outlines, component frames, interaction rectangles, actuator stems, FR1 mechanical shapes and all mechanical dashed links are excluded.
- Coils have no winding Geometry: Flow reaches their terminals and resumes on the existing return wire, without inventing an internal line.
- All wires use their frozen visual orientation. No legacy coordinates or direction map values are copied. NC-symbol strokes and FU2 internal strokes use alternating, arrow-free dashes; no electrical instantaneous direction is asserted.
- CSS dash animation: 6/26 pitch, 1.6 seconds, uniform speed, no glow/particles/timers/rAF. Reduced motion hides Flow while retaining Active and Solver state.
- Each state render replaces old Flow use elements. Unmount clears the board; AbortController disposes root/global input listeners to prevent duplicate actions after module remount. No Action/Solver semantics changed.

## Verification

| Verification | Result |
|---|---|
| Derived membership AND gates, allowlist, frozen Raw input | 961 assertions passed |
| Current Flow acceptance | 480 assertions passed |
| Retained Stage3 Active Path checks (approved membership adjustment only) | 106 assertions passed |
| Retained electrical assertions | 331 passed |
| Electrical state combinations | 96 passed |
| Legacy electrical tests | 14/14, included in electrical checks |
| Frozen Geometry acceptance | passed |
| Wire Flow/Active/Base href and actual bounding boxes | identical |
| Real consecutive frames | pixels and dash offsets change; references do not |
| Reduced motion | Flow off, Active and electrical state preserved |
| Three module-switch cycles and real QF clicks | no stale animations or duplicate input |
| Browser page/console errors | 0 |
| Final Flow nodes / Flow animations / module timeouts / intervals | 0 / 0 / 0 / 0 |

Geometry SHA256: 248befb2c0522e4f72bb9574baa50b0cd3afd195a8a069bd40617e1b28ffb018.

The full files index.html (Solver host), facade.js, circuit.data.js and the electrical/geometry regression tests retain their pre-turn file hashes. Raw active IDs, active edges and phase maps match stage4-blocker-evidence.json across the same operating states; mw_02/mw_05/mw_08 remain absent from Raw output.

QF1 visual inspection: three independent vertical conductive strokes, original black mechanical dashed link, no solid red enclosing hitbox or transverse short-circuit appearance.

Browser tooling note: Playwright CLI daemon could not maintain a session in this Windows environment. Repository-standard Playwright Core with installed Chrome successfully ran all acceptance and screenshot captures. CLI failures are not counted as application page errors.

## Evidence and reproduction

- Open [A–N gallery](stage4-gallery.html): 24 screenshots, including 8 same-state moving pairs and K/L pressed→released branch comparisons.
- [Complete validation](stage4-validation.json): all checks, states, references, phase outputs and frame hashes.
- Capture script: capture-stage4.cjs.
- Tests: visual-membership.acceptance.cjs and current-flow.acceptance.cjs under the ch02_reverse tests directory.

Start a loopback HTTP server from repository root, then:

```powershell
$env:PLAYWRIGHT_CORE_PATH='C:\Users\75953\Desktop\忆阻器pdf与参考文献包\.npm-cache\_npx\31e32ef8478fbf80\node_modules\playwright-core'
node src/chapters/chapter02/modules/ch02_reverse/tests/visual-membership.acceptance.cjs
node src/chapters/chapter02/modules/ch02_reverse/tests/current-flow.acceptance.cjs
node output/playwright/capture-stage4.cjs
```

HEAD: b83883f99b7720dcb01f47ceec179327ea86208f, unchanged. Stop here until manual Stage4 approval; do not enter Stage5.
