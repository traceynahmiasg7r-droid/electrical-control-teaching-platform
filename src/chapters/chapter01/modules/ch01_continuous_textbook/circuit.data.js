(function installCh01ContinuousTextbookData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  // Coordinates are measured in the supplied textbook image's native pixels.
  // The source includes no QF, fuse, overload relay, junction dot or crossing.
  const ports = [], wires = [], deviceEdges = [], components = [], byId = new Map();
  function port(portId, x, y, extra = {}) { const result = { portId, x, y, ...extra }; ports.push(result); byId.set(portId, result); return portId; }
  function wire(wireId, from, to, via = [], domain = "main") { wires.push({ wireId, from, to, domain, points: [byId.get(from), ...via.map(([x, y]) => ({ x, y })), byId.get(to)] }); }
  const motor = { x: 562, y: 1068, rx: 74, ry: 50, phasePorts: [] }, poles = [];
  [489, 562, 635].forEach((x, i) => {
    const phase = ["a", "b", "c"][i];
    const source = port(`src_${phase}`, x, 550, { electricalNodeId: `phase:${phase.toUpperCase()}` });
    const a = port(`km_main_${phase}_a`, x, 747), b = port(`km_main_${phase}_b`, x, 803);
    const terminalX = [521, 562, 603][i];
    const terminalY = motor.y - motor.ry * Math.sqrt(1 - ((terminalX - motor.x) / motor.rx) ** 2);
    const terminal = port(`m_${["u", "v", "w"][i]}`, terminalX, terminalY);
    wire(`phase-${phase}-feed`, source, a);
    wire(`phase-${phase}-motor`, b, terminal, i === 1 ? [] : [[x, 990]]);
    deviceEdges.push({ edgeId: `km_main_${phase}`, componentId: "km_main", from: a, to: b, domain: "main", kind: "contact", condition: "KM" });
    poles.push({ a, b, edgeId: `km_main_${phase}`, openTip: { x: x - 48, y: 743 } });
    motor.phasePorts.push(terminal);
  });
  components.push({ componentId: "km_main", type: "bank", label: "KM", geometry: { poles, labelX: 703, labelY: 786, labelWidth: 80 }, electricalEdgeIds: poles.map((p) => p.edgeId) });
  components.push({ componentId: "motor", type: "motor", label: "M", geometry: motor, electricalEdgeIds: [] });

  port("control_a", 854, 668, { electricalNodeId: "phase:A" });
  port("control_hold_split", 854, 769);
  port("control_n", 1550, 668, { electricalNodeId: "neutral:N" });
  port("sb1_a", 965, 668); port("sb1_b", 1026, 668);
  port("km_self_a", 965, 769); port("km_self_b", 1026, 769);
  port("hold_join", 1098, 668);
  port("sb2_a", 1172, 668); port("sb2_b", 1232, 668);
  port("km_coil_a", 1378, 668); port("km_coil_b", 1428, 668);
  wire("control-start-feed", "control_a", "sb1_a", [], "control");
  wire("control-start-join", "sb1_b", "hold_join", [], "control");
  wire("control-self-branch-feed", "control_a", "control_hold_split", [], "control");
  wire("control-hold-feed", "control_hold_split", "km_self_a", [], "control");
  wire("control-hold-join", "km_self_b", "hold_join", [[1098, 769]], "control");
  wire("control-stop-feed", "hold_join", "sb2_a", [], "control");
  wire("control-coil-feed", "sb2_b", "km_coil_a", [], "control");
  wire("control-coil-return", "km_coil_b", "control_n", [], "control");
  deviceEdges.push(
    { edgeId: "sb1_no", componentId: "sb1", from: "sb1_a", to: "sb1_b", domain: "control", kind: "contact", condition: "SB1" },
    { edgeId: "km_self_no", componentId: "km_self", from: "km_self_a", to: "km_self_b", domain: "control", kind: "contact", condition: "KM" },
    { edgeId: "sb2_nc", componentId: "sb2", from: "sb2_a", to: "sb2_b", domain: "control", kind: "contact", condition: "!SB2" },
    { edgeId: "km_coil", componentId: "km_coil", from: "km_coil_a", to: "km_coil_b", domain: "control", kind: "load", condition: "always" }
  );
  components.push(
    { componentId: "sb1", type: "button", label: "SB1", contactType: "NO", geometry: { a: "sb1_a", b: "sb1_b", openTip: { x: 1026, y: 641 }, actuatorX: 1001, capLeft: 965, capRight: 1038, capY: 604, capLeg: 18, stem: [[604, 619], [633, 650]], labelX: 1008, labelY: 582, labelWidth: 96, hitbox: { x: 945, y: 590, width: 110, height: 100 } }, electricalEdgeIds: ["sb1_no"] },
    { componentId: "km_self", type: "auxiliary", label: "KM", contactType: "NO", geometry: { a: "km_self_a", b: "km_self_b", openTip: { x: 1026, y: 742 }, labelX: 1018, labelY: 729, labelWidth: 80 }, electricalEdgeIds: ["km_self_no"] },
    { componentId: "sb2", type: "button", label: "SB2", contactType: "NC", geometry: { a: "sb2_a", b: "sb2_b", closedTip: { x: 1232, y: 695 }, openTip: { x: 1232, y: 641 }, stopBottom: 704, actuatorX: 1208, capLeft: 1172, capRight: 1245, capY: 604, capLeg: 18, stem: [[604, 625], [639, 656], [669, 686]], labelX: 1216, labelY: 582, labelWidth: 96, hitbox: { x: 1152, y: 590, width: 110, height: 123 } }, electricalEdgeIds: ["sb2_nc"] },
    { componentId: "km_coil", type: "coil", label: "KM", geometry: { a: "km_coil_a", b: "km_coil_b", top: 632, bottom: 705, labelX: 1403, labelY: 616, labelWidth: 80 }, electricalEdgeIds: ["km_coil"] }
  );
  const labels = [
    { text: "电路图", x: 305, y: 496, size: 50, width: 177, kind: "caption" },
    { text: "~", x: 557, y: 482, size: 48 },
    { text: "A", x: 497, y: 529, size: 42, width: 37 }, { text: "B", x: 558, y: 529, size: 42, width: 34 }, { text: "C", x: 633, y: 529, size: 42, width: 38 },
    { text: "A", x: 853, y: 625, size: 42, width: 37 }, { text: "N", x: 1547, y: 625, size: 42, width: 35 },
    { text: "主电路", x: 559, y: 1175, size: 50, width: 178, kind: "caption" },
    { text: "控制电路", x: 1193, y: 989, size: 50, width: 244, kind: "caption" },
    { text: "自锁电路", x: 1239, y: 829, size: 50, width: 236, kind: "caption" }
  ];
  // Only the free ends are source symbols. The shared A segment between the
  // parallel branches belongs to the electrical wire geometry above.
  const sourceBars = [
    { id: "control-phase-top-symbol", portId: "control_a", points: [{ x: 854, y: 632 }, { x: 854, y: 668 }] },
    { id: "control-phase-bottom-symbol", portId: "control_hold_split", points: [{ x: 854, y: 769 }, { x: 854, y: 879 }] },
    { id: "control-neutral-symbol", portId: "control_n", points: [{ x: 1550, y: 632 }, { x: 1550, y: 897 }] }
  ];
  const decorations = [
    { id: "self-hold-arrow-head", kind: "teaching-arrow", fill: "#b9dfe1", d: "M 1177 880 C 1305 884 1406 861 1417 765 L 1460 758 L 1372 735 L 1289 787 L 1332 780 C 1321 825 1295 851 1255 870 Z" },
    { id: "self-hold-arrow-tail", kind: "teaching-arrow", fill: "#95b2b5", d: "M 1030 796 L 1116 781 C 1139 828 1190 866 1255 870 C 1179 894 1058 883 1030 796 Z" }
  ];
  const junctions = [
    { junctionId: "control-start-split", portId: "control_a", x: 854, y: 668, visible: false },
    { junctionId: "control-self-merge", portId: "hold_join", x: 1098, y: 668, visible: false }
  ];
  function validateGeometry() {
    const errors = [], ids = new Set();
    [...wires, ...deviceEdges].forEach((edge) => {
      const id = edge.edgeId || edge.wireId;
      if (ids.has(id)) errors.push(`Duplicate edge ${id}`); ids.add(id);
      if (!byId.has(edge.from) || !byId.has(edge.to)) errors.push(`Unknown endpoint ${id}`);
    });
    wires.forEach((item) => {
      if (item.points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push(`Invalid wire ${item.wireId}`);
      if (item.points[0] !== byId.get(item.from) || item.points.at(-1) !== byId.get(item.to)) errors.push(`Disconnected wire ${item.wireId}`);
    });
    motor.phasePorts.forEach((id) => {
      const p = byId.get(id), equation = ((p.x - motor.x) / motor.rx) ** 2 + ((p.y - motor.y) / motor.ry) ** 2;
      if (Math.abs(equation - 1) > 1e-9) errors.push(`Motor lead misses ellipse ${id}`);
    });
    if (byId.get("control_hold_split").electricalNodeId) errors.push("Self-hold branch must retain the explicit shared A wire");
    return { valid: !errors.length, errors, counts: { wires: wires.length, deviceEdges: deviceEdges.length, ports: ports.length, components: components.length, junctions: junctions.length, visibleJunctions: 0, crossings: 0 } };
  }
  platform.moduleCircuitData.ch01ContinuousTextbook = Object.freeze({
    moduleId: "ch01_continuous", geometryLockId: "ch01_continuous_source_native_20260919",
    reference: { path: "C:/电路截图/第一章长动控制.png", sha256: "E6150D4C6C330B6C4CCB7A4B8D13DF6A31FCADE7C4986D182EED9ECDA56FA75C", width: 1798, height: 1219, sourceCrop: { left: 207, top: 450, right: 1580, bottom: 1186 } },
    // Bottom padding keeps the measured 主电路 caption inside the SVG clip;
    // traced circuit coordinates themselves remain in native source pixels.
    viewBox: { x: 207, y: 438, width: 1373, height: 790 },
    ports, wires, deviceEdges, components, labels, sourceBars, decorations, junctions, crossings: [],
    supplies: { phases: ["src_a", "src_b", "src_c"], control: ["control_a", "control_n"], controlPhase: "A" }, validateGeometry
  });
})(globalThis);
