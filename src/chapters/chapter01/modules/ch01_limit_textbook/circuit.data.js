(function installCh01LimitTextbookData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};

  const ports = [];
  const wires = [];
  const deviceEdges = [];
  const components = [];
  const junctions = [];
  const crossings = [];
  const byId = new Map();
  const point = (x, y) => ({ x, y });
  function port(portId, x, y, extra = {}) {
    const value = { portId, x, y, ...extra };
    ports.push(value);
    byId.set(portId, value);
    return portId;
  }
  function wire(wireId, from, to, via = [], domain = "control") {
    wires.push({
      wireId,
      from,
      to,
      domain,
      points: [byId.get(from), ...via.map(([x, y]) => point(x, y)), byId.get(to)]
    });
  }

  // Traced directly from the source slide. Wrapper text, yellow selection
  // backgrounds, the blue frame and the bottom-right arrow are excluded.
  const phaseX = [520, 596, 671];
  const phaseNames = ["a", "b", "c"];
  const terminalNames = ["u", "v", "w"];
  const motor = { x: 596, y: 1079, rx: 57, ry: 42, phasePorts: [] };
  const poles = [];
  phaseX.forEach((x, index) => {
    const phase = phaseNames[index];
    port(`src_${phase}`, x, 552, { electricalNodeId: `phase:${phase.toUpperCase()}`, phase });
    port(`km_main_${phase}_a`, x, 866);
    port(`km_main_${phase}_b`, x, 900);
    port(`fr1_${phase}_a`, x, 951);
    port(`fr1_${phase}_b`, x, 981);
    const terminalX = [547, 596, 645][index];
    const terminalY = motor.y - motor.ry * Math.sqrt(1 - ((terminalX - motor.x) / motor.rx) ** 2);
    const terminal = port(`m_${terminalNames[index]}`, terminalX, terminalY);
    motor.phasePorts.push(terminal);
    poles.push({
      a: `km_main_${phase}_a`, b: `km_main_${phase}_b`, edgeId: `km_main_${phase}`,
      openTip: point(x - 18, 879), circle: { x, y: 866, r: 5 },
      closedConductivePath: [point(x, 900), point(x, 866)]
    });
    deviceEdges.push(
      { edgeId: `km_main_${phase}`, componentId: "km_main", from: `km_main_${phase}_a`, to: `km_main_${phase}_b`, domain: "main", kind: "contact", condition: "KM" },
      { edgeId: `fr1_main_${phase}`, componentId: "fr1_main", from: `fr1_${phase}_a`, to: `fr1_${phase}_b`, domain: "main", kind: "heater", condition: "always" }
    );
  });

  // The source uses phase C for control supply and phase B for return.
  port("control_a", 671, 706, { electricalNodeId: "phase:C", phase: "C", role: "control-source-tap" });
  port("control_n", 596, 814, { electricalNodeId: "phase:B", phase: "B", role: "control-return-tap" });
  wire("phase-a-feed", "src_a", "km_main_a_a", [], "main");
  wire("phase-b-source-to-return", "src_b", "control_n", [], "main");
  wire("phase-b-return-to-contact", "control_n", "km_main_b_a", [], "main");
  wire("phase-c-source-to-control", "src_c", "control_a", [], "main");
  wire("phase-c-control-to-contact", "control_a", "km_main_c_a", [], "main");
  phaseNames.forEach((phase, index) => {
    wire(`phase-${phase}-to-fr1`, `km_main_${phase}_b`, `fr1_${phase}_a`, [], "main");
    wire(`phase-${phase}-fr1-to-motor`, `fr1_${phase}_b`, `m_${terminalNames[index]}`, index === 1 ? [] : [[phaseX[index], 1036]], "main");
  });

  components.push(
    { componentId: "km_main", type: "bank", label: "KM1", geometry: { poles, labelX: 466, labelY: 895, labelSize: 24, labelWidth: 56 }, electricalEdgeIds: poles.map((item) => item.edgeId) },
    {
      componentId: "fr1_main", type: "heater", label: "FR1",
      geometry: {
        outline: [point(502, 951), point(688, 951), point(688, 981), point(502, 981), point(502, 951)],
        notch: [point(577, 951), point(577, 970), point(625, 970), point(625, 981)],
        conductivePaths: {
          fr1_main_a: [point(520, 951), point(520, 981)],
          fr1_main_b: [point(596, 951), point(596, 970), point(625, 970), point(625, 981), point(596, 981)],
          fr1_main_c: [point(671, 951), point(671, 981)]
        },
        labelX: 468, labelY: 979, labelSize: 23, labelWidth: 52
      },
      electricalEdgeIds: ["fr1_main_a", "fr1_main_b", "fr1_main_c"]
    },
    { componentId: "motor", type: "motor", label: "M", geometry: { ...motor, labelSize: 22 }, electricalEdgeIds: [] }
  );

  port("control_start_branch", 838, 706, { role: "branch" });
  port("sb1_a", 928, 706); port("sb1_b", 1000, 706);
  port("km_self_a", 913, 781); port("km_self_b", 986, 781);
  port("control_hold_join", 1063, 706, { role: "branch" });
  port("sb2_a", 1144, 706); port("sb2_b", 1217, 706);
  port("km_coil_a", 1329, 706); port("km_coil_b", 1406, 706);
  port("control_return_right", 1446, 706); port("control_return_corner", 1446, 814);
  port("sq_b", 1250, 814); port("sq_a", 1190, 814);
  port("fr1_nc_b", 862, 814); port("fr1_nc_a", 787, 814);

  wire("control-source-to-branch", "control_a", "control_start_branch");
  wire("control-branch-to-sb1", "control_start_branch", "sb1_a");
  wire("control-self-feed", "control_start_branch", "km_self_a", [[838, 781]]);
  wire("control-sb1-to-join", "sb1_b", "control_hold_join");
  wire("control-self-to-join", "km_self_b", "control_hold_join", [[1063, 781]]);
  wire("control-join-to-sb2", "control_hold_join", "sb2_a");
  wire("control-sb2-to-coil", "sb2_b", "km_coil_a");
  wire("control-coil-to-return", "km_coil_b", "control_return_right");
  wire("control-return-drop", "control_return_right", "control_return_corner");
  wire("control-return-to-sq", "control_return_corner", "sq_b");
  wire("control-sq-to-fr1", "sq_a", "fr1_nc_b");
  wire("control-fr1-to-n", "fr1_nc_a", "control_n");

  deviceEdges.push(
    { edgeId: "sb1_no", componentId: "sb1", from: "sb1_a", to: "sb1_b", domain: "control", kind: "contact", condition: "SB1" },
    { edgeId: "km_self_no", componentId: "km_self", from: "km_self_a", to: "km_self_b", domain: "control", kind: "contact", condition: "KM" },
    { edgeId: "sb2_nc", componentId: "sb2", from: "sb2_a", to: "sb2_b", domain: "control", kind: "contact", condition: "!SB2" },
    { edgeId: "km_coil", componentId: "km_coil", from: "km_coil_a", to: "km_coil_b", domain: "control", kind: "load", condition: "always" },
    { edgeId: "sq_nc", componentId: "sq", from: "sq_a", to: "sq_b", domain: "control", kind: "contact", condition: "!SQ" },
    { edgeId: "fr1_nc", componentId: "fr1_nc", from: "fr1_nc_a", to: "fr1_nc_b", domain: "control", kind: "contact", condition: "!FR1" }
  );

  const noContact = (a, b, openTip, extra = {}) => ({
    a, b, bladePivot: point(byId.get(a).x, byId.get(a).y), openTip,
    closedTip: point(byId.get(b).x, byId.get(b).y), contactPoint: point(byId.get(b).x, byId.get(b).y),
    fixedPath: [], closedConductivePath: [point(byId.get(a).x, byId.get(a).y), point(byId.get(b).x, byId.get(b).y)], ...extra
  });
  const ncContact = (a, b, contactY, openY, extra = {}) => ({
    a, b, bladePivot: point(byId.get(a).x, byId.get(a).y), openTip: point(byId.get(b).x, openY),
    closedTip: point(byId.get(b).x + 11, contactY + 5), contactPoint: point(byId.get(b).x, contactY),
    fixedPath: [point(byId.get(b).x, byId.get(b).y), point(byId.get(b).x, contactY)],
    closedConductivePath: [point(byId.get(a).x, byId.get(a).y), point(byId.get(b).x, contactY), point(byId.get(b).x, byId.get(b).y)], ...extra
  });
  components.push(
    {
      componentId: "sb1", type: "button", label: "SB1", contactType: "NO",
      geometry: noContact("sb1_a", "sb1_b", point(1008, 678), {
        capLeft: 933, capRight: 990, capY: 650, capLeg: 20, actuatorX: 962, actuatorTop: 670, actuatorBottom: 693,
        labelX: 901, labelY: 642, labelSize: 24, labelWidth: 49, hitbox: { x: 884, y: 620, width: 150, height: 125 }
      }), electricalEdgeIds: ["sb1_no"]
    },
    {
      componentId: "km_self", type: "auxiliary", label: "KM1", contactType: "NO",
      geometry: noContact("km_self_a", "km_self_b", point(996, 752), { labelX: 948, labelY: 754, labelSize: 23, labelWidth: 54 }), electricalEdgeIds: ["km_self_no"]
    },
    {
      componentId: "sb2", type: "button", label: "SB2", contactType: "NC",
      geometry: ncContact("sb2_a", "sb2_b", 739, 674, {
        capLeft: 1150, capRight: 1208, capY: 650, capLeg: 20, actuatorX: 1179, actuatorTop: 670, actuatorBottom: 694,
        labelX: 1118, labelY: 642, labelSize: 24, labelWidth: 49, hitbox: { x: 1100, y: 620, width: 145, height: 145 }
      }), electricalEdgeIds: ["sb2_nc"]
    },
    {
      componentId: "km_coil", type: "coil", label: "KM1",
      geometry: { a: "km_coil_a", b: "km_coil_b", top: 665, bottom: 747, labelX: 1287, labelY: 654, labelSize: 23, labelWidth: 54 }, electricalEdgeIds: ["km_coil"]
    },
    {
      componentId: "fr1_nc", type: "auxiliary", label: "FR1", contactType: "NC",
      geometry: ncContact("fr1_nc_a", "fr1_nc_b", 845, 785, {
        labelX: 745, labelY: 852, labelSize: 23, labelWidth: 51,
        thermalSign: [point(786, 879), point(805, 879), point(805, 863), point(843, 863), point(843, 879), point(863, 879)],
        linkage: [point(825, 830), point(825, 856)]
      }), electricalEdgeIds: ["fr1_nc"]
    },
    {
      componentId: "sq", type: "limit", label: "SQ", contactType: "NC",
      geometry: ncContact("sq_a", "sq_b", 855, 785, {
        labelX: 1233, labelY: 875, labelSize: 26, labelWidth: 45,
        striker: [point(1250, 814), point(1250, 854), point(1270, 854)], hitbox: { x: 1160, y: 785, width: 135, height: 105 }
      }), electricalEdgeIds: ["sq_nc"]
    }
  );

  const labels = [{ labelId: "control-title", text: "控制电路", x: 310, y: 487, size: 43, width: 228, kind: "title" }];
  const sourceSymbols = phaseX.map((x, index) => ({
    id: `source-${phaseNames[index]}`, portId: `src_${phaseNames[index]}`, center: point(x, 540), rx: 15, ry: 10,
    slash: [point(x - 16, 552), point(x + 16, 527)], points: [point(x, 550), point(x, 552)]
  }));
  junctions.push(
    { junctionId: "control-c-tap", portId: "control_a", x: 671, y: 706, visible: false },
    { junctionId: "control-b-return", portId: "control_n", x: 596, y: 814, visible: false },
    { junctionId: "start-self-branch", portId: "control_start_branch", x: 838, y: 706, visible: false },
    { junctionId: "start-self-join", portId: "control_hold_join", x: 1063, y: 706, visible: false }
  );
  crossings.push({ crossingId: "phase-c-over-control-return", x: 671, y: 814, wireIds: ["phase-c-control-to-contact", "control-fr1-to-n"], connected: false, visibleBridge: false });

  function validateGeometry() {
    const errors = [];
    const ids = new Set();
    [...wires, ...deviceEdges].forEach((item) => {
      const id = item.wireId || item.edgeId;
      if (ids.has(id)) errors.push(`Duplicate edge ${id}`);
      ids.add(id);
      if (!byId.has(item.from) || !byId.has(item.to)) errors.push(`Unknown endpoint ${id}`);
    });
    wires.forEach((item) => {
      if (item.points.length < 2 || item.points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push(`Invalid wire ${item.wireId}`);
      if (item.points[0] !== byId.get(item.from) || item.points.at(-1) !== byId.get(item.to)) errors.push(`Disconnected wire ${item.wireId}`);
    });
    motor.phasePorts.forEach((id) => {
      const p = byId.get(id);
      const ellipse = ((p.x - motor.x) / motor.rx) ** 2 + ((p.y - motor.y) / motor.ry) ** 2;
      if (Math.abs(ellipse - 1) > 1e-9) errors.push(`Motor lead misses ellipse ${id}`);
    });
    const edgeIds = new Set(deviceEdges.map((item) => item.edgeId));
    ["km_main_a", "km_main_b", "km_main_c", "fr1_main_a", "fr1_main_b", "fr1_main_c", "sb1_no", "km_self_no", "sb2_nc", "km_coil", "sq_nc", "fr1_nc"].forEach((id) => { if (!edgeIds.has(id)) errors.push(`Missing device edge ${id}`); });
    if (byId.get("control_a")?.electricalNodeId !== "phase:C") errors.push("Control source must tap phase C");
    if (byId.get("control_n")?.electricalNodeId !== "phase:B") errors.push("Control return must tap phase B");
    if (!crossings.some((item) => !item.connected && item.x === 671 && item.y === 814)) errors.push("Missing unconnected C/return crossing");
    return { valid: errors.length === 0, errors, counts: { wires: wires.length, deviceEdges: deviceEdges.length, ports: ports.length, components: components.length, junctions: junctions.length, visibleJunctions: junctions.filter((item) => item.visible).length, crossings: crossings.length } };
  }

  platform.moduleCircuitData.ch01LimitTextbook = Object.freeze({
    moduleId: "ch01_limit", geometryLockId: "ch01_limit_source_native_20260920_v2",
    reference: { path: "C:/电路截图/第一章行程开关控制电路.png", sha256: "D5CB8C85112FDAFBF9A1B12F3FF4FBD0BDE34784AF305DD26E8409402259F357", width: 1713, height: 1186, sourceCrop: { left: 175, top: 420, right: 1500, bottom: 1140 } },
    viewBox: { x: 175, y: 420, width: 1325, height: 720 },
    ports, wires, deviceEdges, components, labels, sourceSymbols, junctions, crossings,
    supplies: { phases: ["src_a", "src_b", "src_c"], control: ["control_a", "control_n"], controlPhase: "C", controlReturnPhase: "B" },
    validateGeometry
  });
})(globalThis);
