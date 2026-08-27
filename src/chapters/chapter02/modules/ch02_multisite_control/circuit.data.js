(function installMultisiteControlCircuitData(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleData = platform.moduleData || {};
  const MODULE_ID = "ch02_multisite_control";
  const id = (kind, localId) => `${MODULE_ID}__${kind}__${localId}`;

  function wire(localId, circuitDomain, fromPort, toPort, routePoints, phase = "", electricalRole = "supply") {
    return Object.freeze({
      wireId: id("wire", localId), circuitDomain, electricalRole,
      fromPort: id("port", fromPort), toPort: id("port", toPort),
      routePoints: Object.freeze(routePoints.map(([x, y]) => Object.freeze({ x, y }))), phase
    });
  }

  function component(localId, deviceId, type, partType, label, geometry, circuitDomain = "control", behavior = "") {
    return Object.freeze({
      schemaVersion: "1.0",
      componentId: id("cmp", localId), deviceId: id("dev", deviceId), type, partType,
      label: Object.freeze({ text: label, anchor: "top", offset: Object.freeze({ x: 0, y: -8 }) }),
      geometry: Object.freeze({ ...geometry, orientation: geometry.orientation || 0 }),
      ports: Object.freeze([
        Object.freeze({ portId: id("port", `${localId}_in`), terminal: "IN" }),
        Object.freeze({ portId: id("port", `${localId}_out`), terminal: "OUT" })
      ]),
      state: Object.freeze({}), circuitDomain, behavior
    });
  }

  const mainComponents = Object.freeze([
    component("qf1", "qf1", "breaker", "main_contact", "QF1", { x: 112, y: 84, width: 132, height: 46 }, "main", "3P_LINKED"),
    component("fu1", "fu1", "fuse", "fuse_set", "FU1", { x: 112, y: 154, width: 132, height: 44 }, "main", "conductive"),
    component("km1_main", "km1", "contactor", "main_contact", "KM1", { x: 112, y: 242, width: 132, height: 50 }, "main", "NO_3P"),
    component("fr1_main", "fr1", "thermal_relay", "thermal_element", "FR1", { x: 112, y: 324, width: 132, height: 42 }, "main", "conductive"),
    component("m1", "m1", "motor", "three_phase_motor", "M", { x: 112, y: 426, width: 96, height: 96 }, "main", "three_phase")
  ]);

  const mainWires = Object.freeze([
    wire("main_l1_01", "main", "l1_supply", "qf1_l1_in", [[68, 44], [68, 61]], "L1"),
    wire("main_l2_01", "main", "l2_supply", "qf1_l2_in", [[112, 44], [112, 61]], "L2"),
    wire("main_l3_01", "main", "l3_supply", "qf1_l3_in", [[156, 44], [156, 61]], "L3"),
    wire("main_l1_02", "main", "qf1_l1_out", "fu1_l1_in", [[68, 107], [68, 132]], "L1"),
    wire("main_l2_02", "main", "qf1_l2_out", "fu1_l2_in", [[112, 107], [112, 132]], "L2"),
    wire("main_l3_02", "main", "qf1_l3_out", "fu1_l3_in", [[156, 107], [156, 132]], "L3"),
    wire("main_l1_03", "main", "fu1_l1_out", "km1_l1_in", [[68, 176], [68, 217]], "L1"),
    wire("main_l2_03", "main", "fu1_l2_out", "km1_l2_in", [[112, 176], [112, 217]], "L2"),
    wire("main_l3_03", "main", "fu1_l3_out", "km1_l3_in", [[156, 176], [156, 217]], "L3"),
    wire("main_l1_04", "main", "km1_l1_out", "fr1_l1_in", [[68, 267], [68, 304]], "L1"),
    wire("main_l2_04", "main", "km1_l2_out", "fr1_l2_in", [[112, 267], [112, 304]], "L2"),
    wire("main_l3_04", "main", "km1_l3_out", "fr1_l3_in", [[156, 267], [156, 304]], "L3"),
    wire("main_l1_05", "main", "fr1_l1_out", "m1_u", [[68, 345], [68, 387], [91, 404]], "L1"),
    wire("main_l2_05", "main", "fr1_l2_out", "m1_v", [[112, 345], [112, 387]], "L2"),
    wire("main_l3_05", "main", "fr1_l3_out", "m1_w", [[156, 345], [156, 387], [133, 404]], "L3")
  ]);

  const controlComponents = Object.freeze([
    component("fu2", "fu2", "fuse", "control_fuse", "FU2", { x: 344, y: 84, width: 22, height: 42 }, "control", "conductive"),
    component("1sb2", "1sb2", "push_button", "nc", "1SB2 停止", { x: 414, y: 145, width: 64, height: 34 }, "control", "NC"),
    component("2sb2", "2sb2", "push_button", "nc", "2SB2 停止", { x: 522, y: 145, width: 64, height: 34 }, "control", "NC"),
    component("1sb1", "1sb1", "push_button", "no", "1SB1 启动", { x: 642, y: 92, width: 68, height: 34 }, "control", "NO"),
    component("2sb1", "2sb1", "push_button", "no", "2SB1 启动", { x: 642, y: 145, width: 68, height: 34 }, "control", "NO"),
    component("km1_hold", "km1", "contactor", "aux_no", "KM1 自锁", { x: 642, y: 202, width: 68, height: 34 }, "control", "NO"),
    component("km1_coil", "km1", "contactor", "coil", "KM1", { x: 770, y: 145, width: 64, height: 44 }, "control", "coil"),
    component("fr1_nc", "fr1", "thermal_relay", "protection_nc", "FR1", { x: 844, y: 145, width: 50, height: 34 }, "control", "NC"),
    component("km1_signal", "km1", "contactor", "aux_no", "KM1", { x: 470, y: 334, width: 62, height: 34 }, "control", "NO"),
    component("hl1", "hl1", "indicator", "pilot_lamp", "HL1", { x: 700, y: 300, width: 42, height: 42 }, "control", "PROTOTYPE_DERIVED"),
    component("hl2", "hl2", "indicator", "pilot_lamp", "HL2", { x: 700, y: 370, width: 42, height: 42 }, "control", "PROTOTYPE_DERIVED")
  ]);

  const controlWires = Object.freeze([
    wire("ctl_left_rail", "control", "ctl_l", "ctl_l_bottom", [[344, 54], [344, 430]]),
    wire("ctl_right_rail", "control", "ctl_n", "ctl_n_bottom", [[890, 54], [890, 430]]),
    wire("ctl_01", "control", "fu2_out", "1sb2_in", [[344, 108], [374, 108], [374, 145], [382, 145]]),
    wire("ctl_02", "control", "1sb2_out", "2sb2_in", [[446, 145], [490, 145]]),
    wire("ctl_03", "control", "2sb2_out", "start_branch", [[554, 145], [590, 145]]),
    wire("start_1_in", "control", "start_branch", "1sb1_in", [[590, 145], [590, 92], [608, 92]]),
    wire("start_1_out", "control", "1sb1_out", "start_join", [[676, 92], [716, 92], [716, 145]]),
    wire("start_2_in", "control", "start_branch", "2sb1_in", [[590, 145], [608, 145]]),
    wire("start_2_out", "control", "2sb1_out", "start_join", [[676, 145], [716, 145]]),
    wire("hold_in", "control", "start_branch", "km1_hold_in", [[590, 145], [590, 202], [608, 202]]),
    wire("hold_out", "control", "km1_hold_out", "start_join", [[676, 202], [716, 202], [716, 145]]),
    wire("ctl_04", "control", "start_join", "km1_coil_in", [[716, 145], [738, 145]]),
    wire("ctl_05", "control", "km1_coil_out", "fr1_nc_in", [[802, 145], [819, 145]]),
    wire("ctl_06", "control", "fr1_nc_out", "ctl_n", [[869, 145], [890, 145]]),
    wire("signal_01", "control", "ctl_l", "km1_signal_in", [[344, 334], [439, 334]], "", "contact"),
    wire("signal_02", "control", "km1_signal_out", "signal_split", [[501, 334], [602, 334]], "", "contact"),
    wire("hl1_in", "control", "signal_split", "hl1_in", [[602, 334], [602, 300], [679, 300]], "", "load"),
    wire("hl1_out", "control", "hl1_out", "ctl_n", [[721, 300], [890, 300]], "", "load"),
    wire("hl2_in", "control", "signal_split", "hl2_in", [[602, 334], [602, 370], [679, 370]], "", "load"),
    wire("hl2_out", "control", "hl2_out", "ctl_n", [[721, 370], [890, 370]], "", "load")
  ]);

  const deviceEdges = Object.freeze([
    Object.freeze({ edgeId: id("edge", "qf1_3p"), deviceId: id("dev", "qf1"), circuitDomain: "main", electricalRole: "contact", behavior: "3P_LINKED" }),
    Object.freeze({ edgeId: id("edge", "stop_1_nc"), deviceId: id("dev", "1sb2"), circuitDomain: "control", electricalRole: "contact", behavior: "NC" }),
    Object.freeze({ edgeId: id("edge", "stop_2_nc"), deviceId: id("dev", "2sb2"), circuitDomain: "control", electricalRole: "contact", behavior: "NC" }),
    Object.freeze({ edgeId: id("edge", "start_1_no"), deviceId: id("dev", "1sb1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "start_2_no"), deviceId: id("dev", "2sb1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "km1_hold"), deviceId: id("dev", "km1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "km1_coil"), deviceId: id("dev", "km1"), circuitDomain: "control", electricalRole: "coil", behavior: "coil" }),
    Object.freeze({ edgeId: id("edge", "km1_main"), deviceId: id("dev", "km1"), circuitDomain: "main", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "km1_signal"), deviceId: id("dev", "km1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "fr1_nc"), deviceId: id("dev", "fr1"), circuitDomain: "control", electricalRole: "protection", behavior: "NC" })
  ]);

  platform.moduleData[MODULE_ID] = Object.freeze({
    schemaVersion: "1.0",
    moduleId: MODULE_ID,
    geometryLockId: "ch02_multisite_control_geometry_v1_locked",
    referenceImages: Object.freeze(["./assets/reference/multisite-control.png"]),
    mainComponents, mainWires, controlComponents, controlWires, deviceEdges,
    extensions: Object.freeze({ indicators: Object.freeze({ status: "prototype", source: "KM1 auxiliary signal branch", ids: Object.freeze([id("dev", "hl1"), id("dev", "hl2")]) }) })
  });
})(globalThis);
