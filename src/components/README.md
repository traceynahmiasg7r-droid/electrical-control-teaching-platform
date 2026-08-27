# Electrical simulation primitives

This directory contains the shared visual adapter used only by the five extension modules in this delivery.

## Source baseline

- Upstream repository: `traceynahmiasg7r-droid/electrical-control-teaching-platform`
- Audited upstream commit: `681878e1dfbbfd24eaf2a5927f15e22296fb1c7a`
- Authoritative legacy implementations: `index.html`
  - `createPushButton`
  - `createCoil`
  - `createQf1Component`
  - `createFuseComponent`
  - `createFrMain`
  - `createMotorComponent`

The adapter preserves the repository's terminal, contact bridge, fuse, coil, thermal relay, motor and formal QF geometry. The default QF rendering follows the repository's Solver teaching mode: schematic poles and contact bridges are shown without the preview-only device housing.

`selectorSwitch` and the timer additions remain explicitly marked Prototype because the upstream repository does not currently expose frozen public implementations for SA or KT.

## Load order

Load `electrical-simulation-primitives.css` with the extension module styles, then load `electrical-simulation-primitives.js` before the five extension `renderer.js` files.

The adapter is additive. It does not replace or mutate the four mature second-chapter renderers.
