(function installCh01JogTextbookData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  // All coordinates are native pixels of the supplied source, including the
  // unequal spacing between main and control circuits. No QF/FR is present.
  const ports = [], wires = [], deviceEdges = [], components = [];
  const byId = new Map();
  function port(portId, x, y, extra = {}) { const result = { portId, x, y, ...extra }; ports.push(result); byId.set(portId, result); return portId; }
  function wire(wireId, from, to, via = [], domain = "main") { wires.push({ wireId, from, to, domain, points: [byId.get(from), ...via.map(([x, y]) => ({ x, y })), byId.get(to)] }); }
  const motor = { x: 471, y: 1073, rx: 74, ry: 50, phasePorts: [] };
  const poles = [];
  [398, 471, 544].forEach((x, i) => {
    const phase = ["a", "b", "c"][i];
    const source = port(`src_${phase}`, x, 555, { electricalNodeId: `phase:${phase.toUpperCase()}` });
    const a = port(`km_main_${phase}_a`, x, 750), b = port(`km_main_${phase}_b`, x, 807);
    const terminalX = [429, 471, 512][i];
    const terminalY = motor.y - motor.ry * Math.sqrt(1 - ((terminalX - motor.x) / motor.rx) ** 2);
    const terminal = port(`m_${["u", "v", "w"][i]}`, terminalX, terminalY);
    wire(`phase-${phase}-feed`, source, a);
    wire(`phase-${phase}-motor`, b, terminal, i === 1 ? [] : [[x, 995]]);
    deviceEdges.push({ edgeId: `km_main_${phase}`, componentId: "km_main", from: a, to: b, domain: "main", kind: "contact", condition: "KM" });
    poles.push({ a, b, edgeId: `km_main_${phase}`, openTip: { x: x - 48, y: 750 } });
    motor.phasePorts.push(terminal);
  });
  components.push({ componentId: "km_main", type: "bank", label: "KM", geometry: { poles, labelX: 610, labelY: 792, labelWidth: 80 }, electricalEdgeIds: poles.map((p) => p.edgeId) });
  components.push({ componentId: "motor", type: "motor", label: "M", geometry: motor, electricalEdgeIds: [] });

  port("control_a", 860, 730, { electricalNodeId: "phase:A" });
  port("control_n", 1470, 730, { electricalNodeId: "neutral:N" });
  port("sb1_a", 970, 730); port("sb1_b", 1032, 730);
  port("km_coil_a", 1299, 730); port("km_coil_b", 1349, 730);
  wire("control-start-feed", "control_a", "sb1_a", [], "control");
  wire("control-coil-feed", "sb1_b", "km_coil_a", [], "control");
  wire("control-coil-return", "km_coil_b", "control_n", [], "control");
  deviceEdges.push({ edgeId: "sb1_no", componentId: "sb1", from: "sb1_a", to: "sb1_b", domain: "control", kind: "contact", condition: "SB1" });
  deviceEdges.push({ edgeId: "km_coil", componentId: "km_coil", from: "km_coil_a", to: "km_coil_b", domain: "control", kind: "load", condition: "always" });
  components.push({ componentId: "sb1", type: "button", label: "SB1", geometry: { a: "sb1_a", b: "sb1_b", openTip: { x: 1032, y: 703 }, actuatorX: 1007, capY: 666, labelX: 1009, labelY: 644, labelWidth: 96 }, electricalEdgeIds: ["sb1_no"] });
  components.push({ componentId: "km_coil", type: "coil", label: "KM", geometry: { a: "km_coil_a", b: "km_coil_b", top: 694, bottom: 767, labelX: 1324, labelY: 679, labelWidth: 80 }, electricalEdgeIds: ["km_coil"] });
  const labels = [
    { text: "~", x: 464, y: 485, size: 48 },
    { text: "A", x: 405, y: 535, size: 42, width: 37 }, { text: "B", x: 469, y: 535, size: 42, width: 34 }, { text: "C", x: 542, y: 535, size: 42, width: 38 },
    { text: "A", x: 859, y: 686, size: 42, width: 37 }, { text: "N", x: 1469, y: 686, size: 42, width: 35 },
    { text: "主电路", x: 469, y: 1180, size: 50, width: 178, kind: "caption" },
    { text: "控制电路", x: 1145, y: 909, size: 48, width: 244, kind: "caption" }
  ];
  const sourceBars = [
    { id: "control-phase-symbol", portId: "control_a", points: [{ x: 860, y: 694 }, { x: 860, y: 830 }] },
    { id: "control-neutral-symbol", portId: "control_n", points: [{ x: 1470, y: 694 }, { x: 1470, y: 839 }] }
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
      const a = byId.get(item.from), b = byId.get(item.to);
      if (item.points[0] !== a || item.points.at(-1) !== b) errors.push(`Disconnected wire ${item.wireId}`);
    });
    motor.phasePorts.forEach((id) => {
      const p = byId.get(id), equation = ((p.x - motor.x) / motor.rx) ** 2 + ((p.y - motor.y) / motor.ry) ** 2;
      if (Math.abs(equation - 1) > 1e-9) errors.push(`Motor lead misses ellipse ${id}`);
    });
    return { valid: !errors.length, errors, counts: { wires: wires.length, deviceEdges: deviceEdges.length, ports: ports.length, components: components.length, junctions: 0, crossings: 0 } };
  }
  platform.moduleCircuitData.ch01JogTextbook = Object.freeze({
    moduleId: "ch01_jog", geometryLockId: "ch01_jog_source_native_20260919",
    reference: { path: "C:/电路截图/第一章电动控制.png", sha256: "D6A967D38559FE452FB80FABB5511B98FD3F61EEAD362BF62DDA2206CA7455EB", width: 1845, height: 1297, sourceCrop: { left: 330, top: 458, right: 1503, bottom: 1194 } },
    // Extra white viewport padding keeps the source AC mark comfortably clear
    // of the board edge. None of the traced geometry is relocated.
    viewBox: { x: 330, y: 446, width: 1173, height: 748 },
    ports, wires, deviceEdges, components, labels, sourceBars, junctions: [], crossings: [],
    supplies: { phases: ["src_a", "src_b", "src_c"], control: ["control_a", "control_n"], controlPhase: "A" }, validateGeometry
  });
})(globalThis);
