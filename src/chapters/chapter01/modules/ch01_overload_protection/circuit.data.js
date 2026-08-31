(function installCh01OverloadCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.chapterCircuitData = platform.chapterCircuitData || {};
  const ns = "ch01_overload_protection";
  const id = (type, localId) => `${ns}__${type}__${localId}`;
  const components = [
    ["qf1", "breaker", "three_pole", "QF1", "main"], ["sb1_nc", "push_button", "nc", "SB1", "control"],
    ["sb2_no", "push_button", "no", "SB2", "control"], ["km1_coil", "contactor", "coil", "KM1", "control"],
    ["km1_main", "contactor", "main_contact", "KM1", "main"], ["km1_aux", "contactor", "aux_no", "KM1", "control"],
    ["fr1_thermal", "thermal_relay", "thermal_element", "FR1", "main"], ["fr1_nc", "thermal_relay", "protection_nc", "FR1", "control"],
    ["m1", "motor", "three_phase", "M", "main"]
  ].map(([localId, type, partType, label, circuitDomain]) => Object.freeze({ componentId: id("cmp", localId), deviceId: id("dev", localId.split("_")[0]), type, partType, label, circuitDomain }));
  const wires = ["main_l1", "main_l2", "main_l3", "main_km1_fr_u", "main_km1_fr_v", "main_km1_fr_w", "main_fr_m_u", "main_fr_m_v", "main_fr_m_w", "control_supply", "control_stop", "control_start", "control_hold", "control_fr_nc", "control_coil", "control_neutral"].map((localId) => Object.freeze({ wireId: id("wire", localId), circuitDomain: localId.startsWith("main") ? "main" : "control" }));
  platform.chapterCircuitData.ch01OverloadProtection = Object.freeze({ schemaVersion: "1.0", moduleId: ns, reference: "第一章第113页：热继电器应用举例", geometryLockId: "ch01_overload_protection_geometry_v1_locked", components: Object.freeze(components), wires: Object.freeze(wires) });
})(globalThis);
