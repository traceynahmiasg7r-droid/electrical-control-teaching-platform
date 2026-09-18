"use strict";
const assert = require("node:assert/strict");
const { assertFrozenGeometry } = require("./electrical.acceptance.cjs");
const geometryHash = assertFrozenGeometry();
require("../visual-binding.js");
const data = globalThis.ECTPPlatform.moduleCircuitData.ch02Reverse;
const bind = globalThis.ECTPPlatform.bindCh02ReverseVisualState;
let passed = 0;
const check = (value, message) => { assert.ok(value, message); passed++; };
const snapshot = { operation: { controls: { stop: "released", forward: "released", reverse: "released" } } };
const fresh = () => ({
  converged: true,
  stableDeviceStates: { KM1: true, KM2: false },
  edgeStates: Object.fromEntries(data.components.flatMap((c) => c.electricalEdgeIds).map((id) => [id, { conductive: true }])),
  motorStates: { M: { state: "forward", running: true } }, protectionStates: { FR1: { tripped: false } },
  activeMainWireIds: ["mw_01", "mw_04", "mw_07"], activeControlWireIds: [],
  extension: {
    activeMainEdgeIds: ["l1", "l2", "l3"].flatMap((p) => ["qf1_edge_" + p, "fu1_edge_" + p]),
    activeControlEdgeIds: [],
    activeMainWirePhaseMap: { mw_01: "l1", mw_04: "l2", mw_07: "l3" }
  }
});
const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
for (const phase of ["l1", "l2", "l3"]) {
  for (let mask = 0; mask < 64; mask++) {
    const s = fresh();
    const qf = "qf1_edge_" + phase, fu = "fu1_edge_" + phase;
    if (!(mask & 1)) s.extension.activeMainEdgeIds = s.extension.activeMainEdgeIds.filter((id) => id !== qf);
    if (!(mask & 2)) s.extension.activeMainEdgeIds = s.extension.activeMainEdgeIds.filter((id) => id !== fu);
    s.edgeStates[qf].conductive = Boolean(mask & 4);
    s.edgeStates[fu].conductive = Boolean(mask & 8);
    if (!(mask & 16)) Object.keys(s.extension.activeMainWirePhaseMap).forEach((id) => {
      if (s.extension.activeMainWirePhaseMap[id] === phase) delete s.extension.activeMainWirePhaseMap[id];
    });
    s.motorStates.M.running = Boolean(mask & 32);
    const before = JSON.stringify(s);
    const v = bind(data, snapshot, freeze(s));
    check(v.derivedVisualActiveWireIds.includes("qf_fu_" + phase) === (mask === 63), phase + " AND gate " + mask);
    check(JSON.stringify(s) === before, "binding cannot mutate frozen Raw Solver");
    for (const key of ["activeMainWireIds", "activeControlWireIds"]) {
      check(JSON.stringify(v[key]) === JSON.stringify(s[key]), key + " remains raw");
    }
    check(v.derivedVisualActiveWireIds.every((id) => ["qf_fu_l1", "qf_fu_l2", "qf_fu_l3"].includes(id)), "strict exception allowlist");
  }
}
const raw = fresh();
raw.activeMainWireIds = []; // A phase-map entry without active main membership is insufficient.
check(bind(data, snapshot, raw).derivedVisualActiveWireIds.length === 0, "stale phase map is insufficient");
console.log(JSON.stringify({ passed, geometryHash }));
module.exports = { passed, geometryHash };
