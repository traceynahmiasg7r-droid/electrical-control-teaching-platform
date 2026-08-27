(function installMixedControlCircuitData(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleData = platform.moduleData || {};
  const MODULE_ID = "ch02_mixed_control";
  const id = (kind, localId) => `${MODULE_ID}__${kind}__${localId}`;

  function wire(localId, circuitDomain, fromPort, toPort, routePoints, phase = "") {
    return Object.freeze({
      wireId: id("wire", localId),
      circuitDomain,
      electricalRole: "supply",
      fromPort: id("port", fromPort),
      toPort: id("port", toPort),
      routePoints: Object.freeze(routePoints.map(([x, y]) => Object.freeze({ x, y }))),
      phase
    });
  }

  function component(localId, deviceId, type, partType, label, geometry, circuitDomain = "control", behavior = "") {
    return Object.freeze({
      schemaVersion: "1.0",
      componentId: id("cmp", localId),
      deviceId: id("dev", deviceId),
      type,
      partType,
      label: Object.freeze({ text: label, anchor: "top", offset: Object.freeze({ x: 0, y: -8 }) }),
      geometry: Object.freeze({ ...geometry, orientation: geometry.orientation || 0 }),
      ports: Object.freeze([
        Object.freeze({ portId: id("port", `${localId}_in`), terminal: "IN" }),
        Object.freeze({ portId: id("port", `${localId}_out`), terminal: "OUT" })
      ]),
      state: Object.freeze({}),
      circuitDomain,
      behavior
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

  function commonControlComponents(prefix) {
    return [
      component(`${prefix}_fu2`, "fu2", "fuse", "control_fuse", "FU2", { x: 344, y: 84, width: 22, height: 42 }, "control", "conductive"),
      component(`${prefix}_fr1_nc`, "fr1", "thermal_relay", "protection_nc", "FR1", { x: 818, y: 132, width: 52, height: 36 }, "control", "NC"),
      component(`${prefix}_km1_coil`, "km1", "contactor", "coil", "KM1", { x: 730, y: 132, width: 64, height: 44 }, "control", "coil")
    ];
  }

  const variants = Object.freeze({
    one: Object.freeze({
      title: "方式一｜SA 转换开关选择点动/长动",
      components: Object.freeze([
        ...commonControlComponents("one"),
        component("one_sb2", "sb2", "push_button", "nc", "SB2 停止", { x: 408, y: 132, width: 58, height: 34 }, "control", "NC"),
        component("one_sb1", "sb1", "push_button", "no", "SB1 启动", { x: 512, y: 132, width: 58, height: 34 }, "control", "NO"),
        component("one_sa", "sa", "selector_switch", "mode_selector", "SA", { x: 515, y: 211, width: 56, height: 34 }, "control", "JOG_OR_CONTINUOUS"),
        component("one_km1_aux", "km1", "contactor", "aux_no", "KM1 自锁", { x: 626, y: 211, width: 66, height: 34 }, "control", "NO")
      ]),
      wires: Object.freeze([
        wire("one_left_rail", "control", "ctl_l", "ctl_l_bottom", [[344, 54], [344, 374]]),
        wire("one_right_rail", "control", "ctl_n", "ctl_n_bottom", [[890, 54], [890, 374]]),
        wire("one_01", "control", "fu2_out", "one_sb2_in", [[344, 108], [382, 108], [382, 132], [408, 132]]),
        wire("one_02", "control", "one_sb2_out", "one_sb1_in", [[466, 132], [512, 132]]),
        wire("one_03", "control", "one_sb1_out", "km1_coil_in", [[570, 132], [730, 132]]),
        wire("one_04", "control", "km1_coil_out", "fr1_nc_in", [[794, 132], [818, 132]]),
        wire("one_05", "control", "fr1_nc_out", "ctl_n", [[870, 132], [890, 132]]),
        wire("one_hold_01", "control", "one_sb2_out", "one_sa_in", [[486, 132], [486, 211], [515, 211]]),
        wire("one_hold_02", "control", "one_sa_out", "one_km1_aux_in", [[571, 211], [626, 211]]),
        wire("one_hold_03", "control", "one_km1_aux_out", "one_sb1_out", [[692, 211], [706, 211], [706, 132]])
      ])
    }),
    two: Object.freeze({
      title: "方式二｜SB1 长动，SB3 点动",
      components: Object.freeze([
        ...commonControlComponents("two"),
        component("two_sb2", "sb2", "push_button", "nc", "SB2 停止", { x: 408, y: 132, width: 58, height: 34 }, "control", "NC"),
        component("two_sb1", "sb1", "push_button", "no", "SB1 长动", { x: 512, y: 132, width: 58, height: 34 }, "control", "NO"),
        component("two_sb3_nc", "sb3", "push_button", "nc", "SB3 NC", { x: 530, y: 211, width: 60, height: 34 }, "control", "NC_LINKED"),
        component("two_sb3_no", "sb3", "push_button", "no", "SB3 点动", { x: 530, y: 274, width: 60, height: 34 }, "control", "NO_LINKED"),
        component("two_km1_aux", "km1", "contactor", "aux_no", "KM1 自锁", { x: 626, y: 211, width: 66, height: 34 }, "control", "NO")
      ]),
      wires: Object.freeze([
        wire("two_left_rail", "control", "ctl_l", "ctl_l_bottom", [[344, 54], [344, 374]]),
        wire("two_right_rail", "control", "ctl_n", "ctl_n_bottom", [[890, 54], [890, 374]]),
        wire("two_01", "control", "fu2_out", "two_sb2_in", [[344, 108], [382, 108], [382, 132], [408, 132]]),
        wire("two_02", "control", "two_sb2_out", "two_sb1_in", [[466, 132], [512, 132]]),
        wire("two_03", "control", "two_sb1_out", "km1_coil_in", [[570, 132], [730, 132]]),
        wire("two_04", "control", "km1_coil_out", "fr1_nc_in", [[794, 132], [818, 132]]),
        wire("two_05", "control", "fr1_nc_out", "ctl_n", [[870, 132], [890, 132]]),
        wire("two_hold_01", "control", "two_sb2_out", "two_sb3_nc_in", [[486, 132], [486, 211], [500, 211]]),
        wire("two_hold_02", "control", "two_sb3_nc_out", "two_km1_aux_in", [[560, 211], [626, 211]]),
        wire("two_hold_03", "control", "two_km1_aux_out", "two_sb1_out", [[692, 211], [706, 211], [706, 132]]),
        wire("two_jog_01", "control", "two_sb2_out", "two_sb3_no_in", [[486, 132], [486, 274], [500, 274]]),
        wire("two_jog_02", "control", "two_sb3_no_out", "two_sb1_out", [[560, 274], [706, 274], [706, 132]])
      ])
    }),
    three: Object.freeze({
      title: "方式三｜继电器 K 切换长动/点动路径",
      components: Object.freeze([
        component("fu4", "fu4", "fuse", "control_fuse", "FU4", { x: 344, y: 84, width: 22, height: 42 }, "control", "conductive"),
        component("three_sb1", "sb1", "push_button", "no", "SB1 长动", { x: 430, y: 122, width: 58, height: 34 }, "control", "NO"),
        component("three_sb2", "sb2", "push_button", "nc", "SB2 停止", { x: 536, y: 122, width: 58, height: 34 }, "control", "NC"),
        component("three_sb3_nc", "sb3", "push_button", "nc", "SB3 点动", { x: 632, y: 122, width: 58, height: 34 }, "control", "NC_LINKED"),
        component("three_k_coil", "k", "relay", "coil", "K", { x: 742, y: 122, width: 58, height: 42 }, "control", "coil"),
        component("three_k_hold", "k", "relay", "aux_no", "K 自锁", { x: 444, y: 190, width: 66, height: 34 }, "control", "NO"),
        component("three_sb3_no", "sb3", "push_button", "no", "SB3 点动", { x: 500, y: 246, width: 60, height: 34 }, "control", "NO_LINKED"),
        component("three_k_run", "k", "relay", "aux_no", "K", { x: 500, y: 310, width: 58, height: 34 }, "control", "NO"),
        component("three_km1_coil", "km1", "contactor", "coil", "KM1", { x: 730, y: 278, width: 64, height: 44 }, "control", "coil"),
        component("three_fr1_nc", "fr1", "thermal_relay", "protection_nc", "FR1", { x: 818, y: 278, width: 52, height: 36 }, "control", "NC")
      ]),
      wires: Object.freeze([
        wire("three_left_rail", "control", "ctl_l", "ctl_l_bottom", [[344, 54], [344, 374]]),
        wire("three_right_rail", "control", "ctl_n", "ctl_n_bottom", [[890, 54], [890, 374]]),
        wire("three_k_01", "control", "fu4_out", "three_sb1_in", [[344, 108], [402, 108], [402, 122], [430, 122]]),
        wire("three_k_02", "control", "three_sb1_out", "three_sb2_in", [[488, 122], [536, 122]]),
        wire("three_k_03", "control", "three_sb2_out", "three_sb3_nc_in", [[594, 122], [632, 122]]),
        wire("three_k_04", "control", "three_sb3_nc_out", "three_k_coil_in", [[690, 122], [742, 122]]),
        wire("three_k_05", "control", "three_k_coil_out", "ctl_n", [[800, 122], [890, 122]]),
        wire("three_hold_01", "control", "three_sb1_in", "three_k_hold_in", [[412, 122], [412, 190], [444, 190]]),
        wire("three_hold_02", "control", "three_k_hold_out", "three_sb1_out", [[510, 190], [520, 190], [520, 122]]),
        wire("three_jog_01", "control", "ctl_l", "three_sb3_no_in", [[344, 246], [470, 246]]),
        wire("three_jog_02", "control", "three_sb3_no_out", "three_run_join", [[530, 246], [650, 246], [650, 278]]),
        wire("three_hold_run_01", "control", "ctl_l", "three_k_run_in", [[344, 310], [471, 310]]),
        wire("three_hold_run_02", "control", "three_k_run_out", "three_run_join", [[529, 310], [650, 310], [650, 278]]),
        wire("three_run_03", "control", "three_run_join", "three_km1_coil_in", [[650, 278], [698, 278]]),
        wire("three_run_04", "control", "three_km1_coil_out", "three_fr1_nc_in", [[794, 278], [818, 278]]),
        wire("three_run_05", "control", "three_fr1_nc_out", "ctl_n", [[870, 278], [890, 278]])
      ])
    })
  });

  const deviceEdges = Object.freeze([
    Object.freeze({ edgeId: id("edge", "qf1_3p"), deviceId: id("dev", "qf1"), circuitDomain: "main", electricalRole: "contact", behavior: "3P_LINKED" }),
    Object.freeze({ edgeId: id("edge", "km1_main"), deviceId: id("dev", "km1"), circuitDomain: "main", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "km1_aux"), deviceId: id("dev", "km1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "km1_coil"), deviceId: id("dev", "km1"), circuitDomain: "control", electricalRole: "coil", behavior: "coil" }),
    Object.freeze({ edgeId: id("edge", "fr1_nc"), deviceId: id("dev", "fr1"), circuitDomain: "control", electricalRole: "protection", behavior: "NC" }),
    Object.freeze({ edgeId: id("edge", "sb1_no"), deviceId: id("dev", "sb1"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "sb2_nc"), deviceId: id("dev", "sb2"), circuitDomain: "control", electricalRole: "contact", behavior: "NC" }),
    Object.freeze({ edgeId: id("edge", "sb3_no"), deviceId: id("dev", "sb3"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "sb3_nc"), deviceId: id("dev", "sb3"), circuitDomain: "control", electricalRole: "contact", behavior: "NC" }),
    Object.freeze({ edgeId: id("edge", "sa_continuous"), deviceId: id("dev", "sa"), circuitDomain: "control", electricalRole: "contact", behavior: "SELECTOR" }),
    Object.freeze({ edgeId: id("edge", "k_aux"), deviceId: id("dev", "k"), circuitDomain: "control", electricalRole: "contact", behavior: "NO" }),
    Object.freeze({ edgeId: id("edge", "k_coil"), deviceId: id("dev", "k"), circuitDomain: "control", electricalRole: "coil", behavior: "coil" })
  ]);

  platform.moduleData[MODULE_ID] = Object.freeze({
    schemaVersion: "1.0",
    moduleId: MODULE_ID,
    geometryLockId: "ch02_mixed_control_geometry_v1_locked",
    referenceImages: Object.freeze([
      "./assets/reference/method-1.png",
      "./assets/reference/method-2.png",
      "./assets/reference/method-3.png"
    ]),
    mainComponents,
    mainWires,
    variants,
    deviceEdges
  });
})(globalThis);
