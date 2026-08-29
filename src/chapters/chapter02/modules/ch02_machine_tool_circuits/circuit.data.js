(function installMachineToolCircuitData(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  const ns = "ch02_machine_tool_circuits";
  const id = (kind, localId) => `${ns}__${kind}__${localId}`;

  function component(localId, deviceId, type, partType, label, x, y, width, height, variant) {
    return Object.freeze({
      componentId: id("cmp", localId), deviceId: id("dev", deviceId), type, partType,
      label, geometry: Object.freeze({ x, y, width, height, orientation: 0 }), variant
    });
  }

  function freezeRoutePoints(points) {
    const segments = Array.isArray(points[0]?.[0]) ? points : [points];
    return Object.freeze(segments.map((segment) => Object.freeze(segment.map(([x, y]) => Object.freeze({ x, y })))));
  }

  function wire(localId, variant, circuitDomain, points, from, to) {
    return Object.freeze({
      wireId: id("wire", localId), variant, circuitDomain,
      fromPort: id("port", from), toPort: id("port", to),
      routePoints: freezeRoutePoints(points)
    });
  }

  const components = Object.freeze([
    component("ca_qf", "ca_qf", "breaker", "three_pole", "QF", 58, 75, 220, 48, "ca6140"),
    component("ca_fu1", "ca_fu1", "fuse", "three_phase", "FU1", 58, 132, 220, 38, "ca6140"),
    component("ca_km1_main", "ca_km1", "contactor", "main_contact", "KM1", 58, 246, 220, 48, "ca6140"),
    component("ca_km2_main", "ca_km2", "contactor", "main_contact", "KM2", 58, 308, 220, 48, "ca6140"),
    component("ca_fr", "ca_fr", "thermal_relay", "thermal_element", "FR", 58, 398, 220, 44, "ca6140"),
    component("ca_m", "ca_m", "motor", "three_phase", "M", 115, 475, 110, 110, "ca6140"),
    component("ca_km1_coil", "ca_km1", "contactor", "coil", "KM1", 820, 155, 60, 42, "ca6140"),
    component("ca_km2_coil", "ca_km2", "contactor", "coil", "KM2", 820, 395, 60, 42, "ca6140"),
    component("ca_kt_coil", "ca_kt", "timer_relay", "coil", "KT", 820, 275, 60, 42, "ca6140"),
    component("z_km1_coil", "z_km1", "contactor", "coil", "KM1", 820, 105, 60, 42, "z3040"),
    component("z_kt_coil", "z_kt", "timer_relay", "coil", "KT", 820, 220, 60, 42, "z3040"),
    component("z_km2_coil", "z_km2", "contactor", "coil", "KM2", 820, 285, 60, 42, "z3040"),
    component("z_km3_coil", "z_km3", "contactor", "coil", "KM3", 820, 350, 60, 42, "z3040"),
    component("z_km4_coil", "z_km4", "contactor", "coil", "KM4", 820, 435, 60, 42, "z3040"),
    component("z_km5_coil", "z_km5", "contactor", "coil", "KM5", 820, 505, 60, 42, "z3040"),
    component("z_yv", "z_yv", "solenoid", "coil", "YV", 660, 555, 60, 38, "z3040")
  ]);

  const caSupply = [160, 285, 410];
  const caForward = [100, 205, 310];
  const caReverse = [360, 465, 570];
  const caOut = [185, 305, 425];
  const caReverseMap = [2, 1, 0];
  const caMainWires = caSupply.flatMap((x, index) => [
    wire(`ca_main_l${index + 1}`, "ca6140", "main", [[[x, 92], [x, 122]], [[x, 218], [x, 255]], [[x, 335], [x, 370]]], `ca_l${index + 1}`, `ca_branch_${index + 1}`),
    wire(`ca_forward_in_l${index + 1}`, "ca6140", "main", [[x, 370], [caForward[index], 370], [caForward[index], 420]], `ca_branch_${index + 1}`, `ca_km1_in_${index + 1}`),
    wire(`ca_reverse_in_l${index + 1}`, "ca6140", "main", [[x, 370], [caReverse[index], 370], [caReverse[index], 420]], `ca_branch_${index + 1}`, `ca_km2_in_${index + 1}`),
    wire(`ca_forward_out_l${index + 1}`, "ca6140", "main", [[caForward[index], 510], [caForward[index], 620], [caOut[index], 620], [caOut[index], 720]], `ca_km1_out_${index + 1}`, `ca_fr_in_${index + 1}`),
    wire(`ca_reverse_out_l${index + 1}`, "ca6140", "main", [[caReverse[index], 510], [caReverse[index], 650], [caOut[caReverseMap[index]], 650], [caOut[caReverseMap[index]], 720]], `ca_km2_out_${index + 1}`, `ca_fr_reverse_${index + 1}`),
    wire(`ca_motor_l${index + 1}`, "ca6140", "main", [[caOut[index], 800], [caOut[index], 872]], `ca_fr_out_${index + 1}`, `ca_m_${index + 1}`)
  ]);
  const zMotors = [
    { localId: "spindle", center: 270 },
    { localId: "rocker", center: 745 },
    { localId: "hydraulic", center: 1210 }
  ];
  const zMainWires = zMotors.map(({ localId, center }) => wire(`z_main_${localId}`, "z3040", "main", [center - 45, center, center + 45].flatMap((x) => [[[x, 92], [x, 128]], [[x, 198], [x, 232]], [[x, 292], [x, 332]]]), `z_${localId}_supply`, `z_${localId}_motor`));

  const wires = Object.freeze([
    ...caMainWires,
    wire("ca_control_l_bus", "ca6140", "control", [[650, 170], [650, 790]], "ca_l", "ca_l_end"),
    wire("ca_control_n_bus", "ca6140", "control", [[1430, 170], [1430, 790]], "ca_n_start", "ca_n"),
    wire("ca_forward_rung", "ca6140", "control", [[[650, 250], [680, 250]], [[740, 250], [770, 250]], [[830, 250], [860, 250]], [[920, 250], [950, 250]], [[1010, 250], [1040, 250]], [[1100, 250], [1130, 250]], [[1242, 250], [1270, 250]], [[1330, 250], [1430, 250]]], "ca_l", "ca_n"),
    wire("ca_forward_hold", "ca6140", "control", [[[750, 250], [750, 340], [790, 340]], [[880, 340], [940, 340], [940, 250]]], "ca_forward_branch", "ca_forward_return"),
    wire("ca_timer_rung", "ca6140", "control", [[[650, 450], [830, 450]], [[890, 450], [1130, 450]], [[1242, 450], [1430, 450]]], "ca_l", "ca_n"),
    wire("ca_reverse_rung", "ca6140", "control", [[[650, 610], [680, 610]], [[740, 610], [770, 610]], [[830, 610], [860, 610]], [[920, 610], [950, 610]], [[1010, 610], [1040, 610]], [[1100, 610], [1130, 610]], [[1242, 610], [1270, 610]], [[1330, 610], [1430, 610]]], "ca_l", "ca_n"),
    wire("ca_reverse_hold", "ca6140", "control", [[[750, 610], [750, 700], [790, 700]], [[880, 700], [940, 700], [940, 610]]], "ca_reverse_branch", "ca_reverse_return"),
    ...zMainWires,
    wire("z_control_l_bus", "z3040", "control", [[110, 530], [110, 1100]], "z_l", "z_l_end"),
    wire("z_control_n_bus", "z3040", "control", [[1390, 530], [1390, 1100]], "z_n_start", "z_n"),
    wire("z_spindle_rung", "z3040", "control", [[[110, 570], [160, 570]], [[220, 570], [270, 570]], [[330, 570], [960, 570]], [[1032, 570], [1080, 570]], [[1190, 570], [1210, 570]], [[1270, 570], [1390, 570]]], "z_l", "z_n"),
    wire("z_spindle_hold", "z3040", "control", [[[250, 570], [250, 638], [285, 638]], [[375, 638], [920, 638], [920, 570]]], "z_spindle_branch", "z_spindle_return"),
    wire("z_timer_rung", "z3040", "control", [[[110, 680], [160, 680]], [[240, 680], [300, 680]], [[380, 680], [1080, 680]], [[1190, 680], [1390, 680]]], "z_l", "z_n"),
    wire("z_up_rung", "z3040", "control", [[[110, 790], [150, 790]], [[235, 790], [290, 790]], [[365, 790], [430, 790]], [[500, 790], [610, 790]], [[680, 790], [1080, 790]], [[1190, 790], [1390, 790]]], "z_l", "z_n"),
    wire("z_down_rung", "z3040", "control", [[[110, 900], [150, 900]], [[235, 900], [290, 900]], [[365, 900], [430, 900]], [[500, 900], [610, 900]], [[680, 900], [1080, 900]], [[1190, 900], [1390, 900]]], "z_l", "z_n"),
    wire("z_loosen_rung", "z3040", "control", [[[110, 1010], [145, 1010]], [[225, 1010], [285, 1010]], [[360, 1010], [480, 1010]], [[550, 1010], [665, 1010]], [[735, 1010], [890, 1010]], [[960, 1010], [1080, 1010]], [[1190, 1010], [1210, 1010]], [[1275, 1010], [1390, 1010]]], "z_l", "z_n"),
    wire("z_yv_rung", "z3040", "control", [[[430, 1010], [430, 1090], [505, 1090]], [[565, 1090], [820, 1090]], [[926, 1090], [1390, 1090]]], "z_yv_branch", "z_n")
  ]);

  const ports = Object.freeze([...new Set(wires.flatMap((item) => [item.fromPort, item.toPort]))]
    .map((portId) => Object.freeze({ portId, kind: "electrical", required: true })));

  const deviceEdges = Object.freeze([
    ["ca_km1_main", "ca_km1", "main", "contact", "NO"],
    ["ca_km2_main", "ca_km2", "main", "contact", "NO"],
    ["ca_fr_nc", "ca_fr", "control", "protection", "NC"],
    ["ca_sq1_nc", "ca_sq1", "control", "contact", "NC"],
    ["ca_sq2_nc", "ca_sq2", "control", "contact", "NC"],
    ["ca_kt_no", "ca_kt", "control", "contact", "TIMED_NO"],
    ["z_km1_main", "z_km1", "main", "contact", "NO"],
    ["z_sq1_upper", "z_sq1", "control", "contact", "NC"],
    ["z_sq1_lower", "z_sq1", "control", "contact", "NC"],
    ["z_sq2_nc", "z_sq2", "control", "contact", "NC"],
    ["z_sq3_nc", "z_sq3", "control", "contact", "NC"],
    ["z_kt_no", "z_kt", "control", "contact", "TIMED_NO"]
  ].map(([localId, device, circuitDomain, electricalRole, behavior]) => Object.freeze({
    edgeId: id("edge", localId), deviceId: id("dev", device), circuitDomain, electricalRole, behavior
  })));

  platform.moduleCircuitData.ch02MachineToolCircuits = Object.freeze({
    schemaVersion: "1.0",
    moduleId: ns,
    namespace: ns,
    geometryLockId: "ch02_machine_tool_circuits_geometry_v1_locked",
    sourceImages: Object.freeze(["原图27 · 第二章第90页", "原图28 · 第二章第104页"]),
    variants: Object.freeze({
      ca6140: Object.freeze({ title: "CA6140卧式车床电气控制线路", shortTitle: "CA6140车床", source: "第二章第90页" }),
      z3040: Object.freeze({ title: "Z3040摇臂钻床电气控制线路", shortTitle: "Z3040钻床", source: "第二章第104页" })
    }),
    components, ports, wires, deviceEdges,
    junctions: Object.freeze([
      { junctionId: id("junction", "ca_stop_branch"), circuitDomain: "control" },
      { junctionId: id("junction", "z_lift_branch"), circuitDomain: "control" },
      { junctionId: id("junction", "z_hydraulic_branch"), circuitDomain: "control" }
    ])
  });
})(globalThis);
