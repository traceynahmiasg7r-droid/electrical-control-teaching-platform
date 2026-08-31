(function installCh01ReverseCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.chapterCircuitData = platform.chapterCircuitData || {};

  const ns = "ch01_reverse_control";
  const id = (type, localId) => `${ns}__${type}__${localId}`;
  const components = Object.freeze([
    { componentId: id("cmp", "qf1"), deviceId: id("dev", "qf1"), type: "breaker", partType: "three_pole", label: "QF1", circuitDomain: "main" },
    { componentId: id("cmp", "sb3_nc"), deviceId: id("dev", "sb3"), type: "push_button", partType: "nc", label: "SB3", circuitDomain: "control" },
    { componentId: id("cmp", "sb1_no"), deviceId: id("dev", "sb1"), type: "push_button", partType: "no", label: "SB1", circuitDomain: "control" },
    { componentId: id("cmp", "sb2_no"), deviceId: id("dev", "sb2"), type: "push_button", partType: "no", label: "SB2", circuitDomain: "control" },
    { componentId: id("cmp", "km1_coil"), deviceId: id("dev", "km1"), type: "contactor", partType: "coil", label: "KM1", circuitDomain: "control" },
    { componentId: id("cmp", "km2_coil"), deviceId: id("dev", "km2"), type: "contactor", partType: "coil", label: "KM2", circuitDomain: "control" },
    { componentId: id("cmp", "m1"), deviceId: id("dev", "m1"), type: "motor", partType: "three_phase", label: "M", circuitDomain: "main" }
  ]);
  const wires = Object.freeze([
    "main_l1", "main_l2", "main_l3", "main_km1_u", "main_km1_v", "main_km1_w",
    "main_km2_u", "main_km2_v", "main_km2_w", "control_supply", "control_stop",
    "control_forward", "control_reverse", "control_km1_hold", "control_km2_hold", "control_neutral"
  ].map((localId) => Object.freeze({ wireId: id("wire", localId), circuitDomain: localId.startsWith("main") ? "main" : "control" })));

  platform.chapterCircuitData.ch01ReverseControl = Object.freeze({
    schemaVersion: "1.0",
    moduleId: ns,
    reference: "第一章第61页：正反转电路",
    geometryLockId: "ch01_reverse_control_geometry_v1_locked",
    components,
    wires,
    ids: Object.freeze({ ns, id })
  });
})(globalThis);
