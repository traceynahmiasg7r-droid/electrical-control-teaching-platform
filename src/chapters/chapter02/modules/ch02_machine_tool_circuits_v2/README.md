# ch02_machine_tool_circuits_v2

This is the isolated Z3040 machine-tool integrated-circuit module for route
`machine-tool-circuits`.

The central SVG geometry is traced from the supplied textbook reference:

- Source: `C:\电路截图\屏幕截图 2026-09-19 050627.png`
- SHA-256: `EC7FA54785B237B2A9AD37F4A612C4B9D18AC92E74AD87568B1C855137A52CC0`
- Crop: `{ left: 76, top: 180, right: 2011, bottom: 1460 }`
- Geometry lock: `z3040_native_trace_20260919`

The old `ch02_machine_tool_circuits` folder is retained for historical
compatibility, but the formal registry route uses this v2 module.

The Solver owns QF, KM1-KM5, KT, YV, FR1/FR2, limits, buttons, motors,
conductive edges, active wire IDs, and lamp states. The renderer only projects
that state onto the single SVG coordinate system. Playback uses six isolated
teaching scenarios and does not mutate live operation state.

`main.geometry.js` defines the original main/lighting trace; `circuit.data.js`
defines the control/indicator trace and explicit port graph. Wires stop at
device terminals, and device edges provide the only connection across each
contact. Geometry crossings never create electrical junctions.

Textbook semantics: SB1 stops and SB2 starts the spindle; SB3–SB6 are held
buttons with mechanically linked NO/NC contacts. KT is an off-delay relay.
FR2 interrupts only the KM4/KM5 coil return. With SQ3 initially unactuated,
closing QF starts automatic clamping; simulating clamp completion opens SQ3
NC. FR2 reset can restore this automatic path if clamping is unfinished.

The off-delay duration used by the UI is a teaching simulation parameter;
the source drawing supplies no numeric time setting.

Acceptance:

```powershell
$env:PLAYWRIGHT_CORE_PATH = '...\\playwright-core'
$env:ECTP_TEST_URL = 'http://127.0.0.1:4173'
node tests/acceptance.cjs
```

Run from this module directory, or use its full repository-relative path.
The browser-free checks are `node tests/geometry.acceptance.cjs` and
`node tests/solver.acceptance.cjs`. Evidence is saved under
`output/playwright/machine-patch-*`; source audit notes are in
`output/playwright/MACHINE_PATCH_SOURCE_AUDIT.md`.
