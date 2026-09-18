(function installCh02ReverseCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  const ports = [], wires = [], components = [], labels = [];
  const point = (x, y) => ({ x, y });
  const port = (portId, x, y, electricalPortId = portId) => {
    ports.push({ portId, x, y, electricalPortId });
    return portId;
  };
  const getPort = (id) => ports.find((p) => p.portId === id);
  function wire(wireId, electricalWireIds, fromPort, toPort, bends = []) {
    wires.push({
      wireId, electricalWireIds, fromPort, toPort,
      points: [getPort(fromPort), ...bends.map(([x, y]) => point(x, y)), getPort(toPort)].map((p) => point(p.x, p.y))
    });
  }
  const label = (text, x, y, kind = "device", anchor = "start") => labels.push({ text, x, y, kind, anchor });
  function component(componentId, type, portIds, geometry, electricalEdgeIds = [], mappingStatus = "mapped") {
    components.push({ componentId, type, portIds, geometry, electricalEdgeIds, mappingStatus });
  }

  // Traced from the designated image with only its (40, 174) crop origin removed.
  const motor = { cx: 282, cy: 564, rx: 47, ry: 35 };
  const motorSideY = motor.cy - motor.ry * Math.sqrt(1 - (40 / motor.rx) ** 2);
  const phaseRows = [
    { phase: "l1", x: 220, reverseX: 32, branchY: 223, outputY: 388, axis: "u", letter: "a", start: 1, out: 22, loadX: 242, loadY: motorSideY },
    { phase: "l2", x: 282, reverseX: 95, branchY: 247, outputY: 412, axis: "v", letter: "b", start: 4, out: 25, loadX: 282, loadY: 529 },
    { phase: "l3", x: 346, reverseX: 157, branchY: 270, outputY: 436, axis: "w", letter: "c", start: 7, out: 28, loadX: 322, loadY: motorSideY }
  ];
  const mw = (n) => "mw_" + String(n).padStart(2, "0");
  phaseRows.forEach((p, i) => {
    const { phase, x, reverseX, branchY, outputY, axis, letter } = p;
    port("src_" + phase, x, 24);
    port("qf1_" + phase + "_in", x, 57);
    port("qf1_" + phase + "_out", x, 82);
    port("fu1_" + phase + "_in", x, 94);
    port("fu1_" + phase + "_out", x, 140);
    port("term_" + axis + "1", x, branchY);
    port("ki1_main_" + letter + "_in", x, 311);
    port("ki1_main_" + letter + "_out", x, 339);
    port("ki2_main_" + letter + "_in", reverseX, 337);
    port("ki2_main_" + letter + "_out", reverseX, 366);
    port("term_" + axis + "2", x, outputY);
    port("fr1_" + axis + "_in", x, 460);
    port("fr1_" + axis + "_out", x, 484);
    port("term_" + axis + "3", x, 510);
    port("load_" + axis + "_in_pending", p.loadX, p.loadY);
    wire("source_" + phase, [mw(p.start)], "src_" + phase, "qf1_" + phase + "_in");
    wire("qf_fu_" + phase, [mw(p.start + 1)], "qf1_" + phase + "_out", "fu1_" + phase + "_in");
    if (i === 0) {
      wire("fu_branch_" + phase, [mw(p.start + 2)], "fu1_" + phase + "_out", "term_" + axis + "1");
    } else {
      const tap = port("control_tap_" + phase, x, i === 1 ? 199 : 174, "term_" + axis + "1");
      wire("fu_tap_" + phase, [mw(p.start + 2)], "fu1_" + phase + "_out", tap);
      wire("tap_branch_" + phase, [mw(p.start + 2)], tap, "term_" + axis + "1");
    }
    wire("ki1_" + letter + "_input", [mw(10 + i)], "term_" + axis + "1", "ki1_main_" + letter + "_in");
    wire("ki2_" + letter + "_input", [mw(16 + i * 2)], "term_" + axis + "1", "ki2_main_" + letter + "_in", [[reverseX, branchY]]);
    wire("ki1_" + letter + "_output", [mw(13 + i)], "ki1_main_" + letter + "_out", "term_" + axis + "2");
    wire("fr1_" + axis + "_input", [mw(p.out)], "term_" + axis + "2", "fr1_" + axis + "_in");
    wire("fr1_" + axis + "_output", [mw(p.out + 1)], "fr1_" + axis + "_out", "term_" + axis + "3");
    wire("motor_" + axis, [mw(p.out + 2)], "term_" + axis + "3", "load_" + axis + "_in_pending", i === 1 ? [] : [[x, 528]]);
    label("L" + (i + 1), x, 10, "phase", "middle");
    label(axis.toUpperCase() + "1", x + 10, branchY - 9, "terminal");
    label(axis.toUpperCase() + "2", x + 9, 452, "terminal");
    label(axis.toUpperCase() + "3", x + 9, 515, "terminal");
  });
  wire("ki2_a_to_w2", ["mw_17"], "ki2_main_a_out", "term_w2", [[32, 436]]);
  wire("ki2_b_to_v2", ["mw_19"], "ki2_main_b_out", "term_v2", [[95, 412]]);
  wire("ki2_c_to_u2", ["mw_21"], "ki2_main_c_out", "term_u2", [[157, 388]]);

  const phasePorts = (prefix, suffix) => phaseRows.map((p) => prefix + "_" + p.phase + "_" + suffix);
  component("source", "source_bank", phaseRows.map((p) => "src_" + p.phase), {});
  component("qf1", "breaker_bank", [...phasePorts("qf1", "in"), ...phasePorts("qf1", "out")], {}, phaseRows.map((p) => "qf1_edge_" + p.phase));
  component("fu1", "fuse_bank", [...phasePorts("fu1", "in"), ...phasePorts("fu1", "out")], {}, phaseRows.map((p) => "fu1_edge_" + p.phase));
  ["ki1", "ki2"].forEach((device) => component(device + "_main", "main_contact_bank",
    [...phaseRows.map((p) => device + "_main_" + p.letter + "_in"), ...phaseRows.map((p) => device + "_main_" + p.letter + "_out")], {},
    phaseRows.map((p) => "edge_" + device + "_main_" + p.letter)));
  component("fr1_main", "thermal_relay_main", [...phaseRows.map((p) => "fr1_" + p.axis + "_in"), ...phaseRows.map((p) => "fr1_" + p.axis + "_out")],
    { x: 204, y: 460, width: 155, height: 24 }, phaseRows.map((p) => "edge_fr1_" + p.axis));
  component("motor", "motor", phaseRows.map((p) => "load_" + p.axis + "_in_pending"), motor);
  label("QF1", 160, 82);
  label("FU1", 162, 123);
  label("KI1", 226, 331);
  label("KI2", 42, 331);
  label("FR1", 163, 477);
  label("M", 282, 572, "motor", "middle");

  [
    ["fu2_supply_in", 370, 174, null], ["fu2_supply_out", 442, 174, null],
    ["fu2_return_in", 370, 199, null], ["fu2_return_out", 442, 199, null],
    ["sb1_l", 505, 174], ["sb1_r", 568, 174],
    ["node_2", 632, 174], ["node_2_hold", 632, 243, "node_2"], ["node_2_reverse", 632, 313, "node_2"], ["node_2_bottom", 632, 382, "node_2"],
    ["sb2_l", 694, 174], ["sb2_r", 754, 174], ["ki1_self_l", 694, 243], ["ki1_self_r", 754, 243],
    ["node_3", 817, 174], ["sb3_nc_l", 878, 174, null], ["sb3_nc_r", 941, 174, null],
    ["ki2_interlock_l", 998, 174], ["ki2_interlock_r", 1058, 174], ["node_5", 1086, 174],
    ["coil_ki1_l", 1115, 174], ["coil_ki1_r", 1177, 174],
    ["sb3_l", 694, 313], ["sb3_r", 754, 313], ["ki2_self_l", 694, 382], ["ki2_self_r", 754, 382],
    ["node_4", 817, 313], ["sb2_nc_l", 878, 313, null], ["sb2_nc_r", 939, 313, null],
    ["ki1_interlock_l", 996, 313], ["ki1_interlock_r", 1058, 313], ["node_6", 1086, 313],
    ["coil_ki2_l", 1117, 313], ["coil_ki2_r", 1180, 313],
    ["node_7", 1236, 244], ["fr1_nc_l", 1298, 244], ["fr1_nc_r", 1361, 244]
  ].forEach(([id, x, y, electricalPortId = id]) => port(id, x, y, electricalPortId));

  wire("fu2_feed", ["cw_01"], "control_tap_l3", "fu2_supply_in");
  wire("fu2_to_sb1", ["cw_01"], "fu2_supply_out", "sb1_l");
  wire("sb1_to_node2", ["cw_02"], "sb1_r", "node_2");
  wire("node2_upper_bus", ["cw_05", "cw_11", "cw_13"], "node_2", "node_2_hold");
  wire("node2_middle_bus", ["cw_11", "cw_13"], "node_2_hold", "node_2_reverse");
  wire("node2_lower_bus", ["cw_13"], "node_2_reverse", "node_2_bottom");
  wire("sb2_input", ["cw_03"], "node_2", "sb2_l");
  wire("sb2_output", ["cw_04"], "sb2_r", "node_3");
  wire("ki1_hold_input", ["cw_05"], "node_2_hold", "ki1_self_l");
  wire("ki1_hold_output", ["cw_06"], "ki1_self_r", "node_3", [[817, 243]]);
  wire("sb3_nc_input", ["cw_07"], "node_3", "sb3_nc_l");
  wire("sb3_nc_output", ["cw_07"], "sb3_nc_r", "ki2_interlock_l");
  wire("ki2_nc_output", ["cw_08"], "ki2_interlock_r", "node_5");
  wire("ki1_coil_input", ["cw_09"], "node_5", "coil_ki1_l");
  wire("ki1_coil_return", ["cw_10"], "coil_ki1_r", "node_7", [[1236, 174]]);
  wire("sb3_input", ["cw_11"], "node_2_reverse", "sb3_l");
  wire("sb3_output", ["cw_12"], "sb3_r", "node_4");
  wire("ki2_hold_input", ["cw_13"], "node_2_bottom", "ki2_self_l");
  wire("ki2_hold_output", ["cw_14"], "ki2_self_r", "node_4", [[817, 382]]);
  wire("sb2_nc_input", ["cw_15"], "node_4", "sb2_nc_l");
  wire("sb2_nc_output", ["cw_15"], "sb2_nc_r", "ki1_interlock_l");
  wire("ki1_nc_output", ["cw_16"], "ki1_interlock_r", "node_6");
  wire("ki2_coil_input", ["cw_17"], "node_6", "coil_ki2_l");
  wire("ki2_coil_return", ["cw_18"], "coil_ki2_r", "node_7", [[1236, 313]]);
  wire("fr1_nc_input", ["cw_19"], "node_7", "fr1_nc_l");
  wire("fr1_return", ["cw_20"], "fr1_nc_r", "fu2_return_out", [[1423, 244], [1423, 429], [464, 429], [464, 199]]);
  wire("fu2_return_supply", ["cw_20"], "fu2_return_in", "control_tap_l2");

  component("fu2", "fuse_pair", ["fu2_supply_in", "fu2_supply_out", "fu2_return_in", "fu2_return_out"], {}, [], "static-conductive-equivalent");
  [
    ["sb1", "push_button_nc", "sb1_l", "sb1_r", "edge_sb1_nc"],
    ["sb2", "push_button_no", "sb2_l", "sb2_r", "edge_sb2_no"],
    ["sb3", "push_button_no", "sb3_l", "sb3_r", "edge_sb3_no"],
    ["ki1_self", "contact_no", "ki1_self_l", "ki1_self_r", "edge_ki1_self_no"],
    ["ki2_self", "contact_no", "ki2_self_l", "ki2_self_r", "edge_ki2_self_no"],
    ["ki2_interlock", "contact_nc", "ki2_interlock_l", "ki2_interlock_r", "edge_ki2_interlock_nc"],
    ["ki1_interlock", "contact_nc", "ki1_interlock_l", "ki1_interlock_r", "edge_ki1_interlock_nc"],
    ["sb3_nc", "contact_nc", "sb3_nc_l", "sb3_nc_r", "edge_sb3_nc"],
    ["sb2_nc", "contact_nc", "sb2_nc_l", "sb2_nc_r", "edge_sb2_nc"],
    ["fr1_nc", "thermal_relay_nc", "fr1_nc_l", "fr1_nc_r", "edge_fr1_nc"]
  ].forEach(([id, type, left, right, edge]) => component(id, type, [left, right], {}, edge ? [edge] : [], edge ? "mapped" : "unmapped-dynamic"));
  component("ki1_coil", "coil", ["coil_ki1_l", "coil_ki1_r"], { height: 68 }, ["edge_coil_ki1"]);
  component("ki2_coil", "coil", ["coil_ki2_l", "coil_ki2_r"], { height: 68 }, ["edge_coil_ki2"]);
  label("FU2", 382, 157);
  label("SB1", 446, 125);
  label("SB2", 655, 140);
  label("SB3", 655, 281);
  label("KI1", 657, 219);
  label("KI2", 657, 359);
  label("KI2", 1015, 167);
  label("KI1", 1015, 307);
  label("KI1", 1078, 128);
  label("KI2", 1074, 272);
  label("FR1", 1266, 279);
  [["2", 620, 220], ["3", 828, 163], ["4", 828, 302], ["5", 1080, 164], ["6", 1080, 303], ["7", 1247, 235]]
    .forEach(([text, x, y]) => label(text, x, y, "node"));

  // Explicit T branches are connected; plain geometric intersections never imply connectivity.
  const junctions = ["term_u1", "term_v1", "term_w1", "control_tap_l2", "control_tap_l3", "term_u2", "term_v2", "term_w2", "node_2", "node_2_hold", "node_2_reverse", "node_3", "node_4", "node_7"]
    .map((portId) => ({ junctionId: "junction_" + portId, portId, ...point(getPort(portId).x, getPort(portId).y) }));
  const crossings = [
    ["source_v_over_u", 220, 247, "ki2_b_input", "ki1_a_input"],
    ["source_w_over_u", 220, 270, "ki2_c_input", "ki1_a_input"],
    ["source_w_over_v", 282, 270, "ki2_c_input", "ki1_b_input"],
    ["output_v_over_u", 220, 412, "ki2_b_to_v2", "fr1_u_input"],
    ["output_w_over_u", 220, 436, "ki2_a_to_w2", "fr1_u_input"],
    ["output_w_over_v", 282, 436, "ki2_a_to_w2", "fr1_v_input"],
    ["fu2_return_over_l3", 346, 199, "fu2_return_supply", "tap_branch_l3"]
  ].map(([crossingId, x, y, wireA, wireB]) => ({ crossingId, x, y, wireA, wireB, electricallyConnected: false, presentation: "plain-no-dot" }));

  const data = {
    schemaVersion: "1.0", moduleId: "ch02_reverse", geometryLockId: "ch02_reverse_textbook_static_v1",
    reference: {
      source: "C:\\电路截图\\屏幕截图 2026-09-14 055320.png", originalWidth: 1489, originalHeight: 808,
      crop: { x: 40, y: 174, width: 1435, height: 610 }, version: "2026-09-17-stage1",
      sha256: "A703FF1CEB6C47A18E229B27579D69DA5DDEF0B4A6072B5AC7109D7B65ABDAB9"
    },
    viewBox: { x: 0, y: 0, width: 1435, height: 610 }, ports, wires, components, labels, junctions, crossings,
    mechanicalLinks: [
      { linkId: "qf1_pole_link", points: [[210, 70], [334, 70]].map(([x, y]) => point(x, y)) },
      { linkId: "sb2_to_sb2_nc", points: [[726, 156], [726, 212], [905, 212], [905, 323]].map(([x, y]) => point(x, y)) },
      { linkId: "sb3_to_sb3_nc", points: [[726, 297], [726, 247], [921, 247], [921, 189]].map(([x, y]) => point(x, y)) }
    ],
    mappingNotes: [
      { componentId: "fu2", electricalWireIds: ["cw_01", "cw_20"], status: "FU2_VISUAL_MODEL_MISMATCH", assumption: "Both fuse poles remain conductive in current scope." },
      { componentId: "sb3_nc", electricalWireIds: ["cw_07"], electricalEdgeIds: ["edge_sb3_nc"], status: "MAPPED_DYNAMIC_CONTACT", assumption: "Shares SB3 operation state: released=closed, pressed=open." },
      { componentId: "sb2_nc", electricalWireIds: ["cw_15"], electricalEdgeIds: ["edge_sb2_nc"], status: "MAPPED_DYNAMIC_CONTACT", assumption: "Shares SB2 operation state: released=closed, pressed=open." }
    ]
  };

  function onSegment(p, a, b) {
    return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) < 0.001
      && p.x >= Math.min(a.x, b.x) - 0.001 && p.x <= Math.max(a.x, b.x) + 0.001
      && p.y >= Math.min(a.y, b.y) - 0.001 && p.y <= Math.max(a.y, b.y) + 0.001;
  }
  function onWire(p, w) { return w.points.slice(1).some((b, i) => onSegment(p, w.points[i], b)); }
  function validateGeometry(input = data) {
    const errors = [];
    const check = (test, error) => { if (!test) errors.push(error); };
    const portMap = new Map(input.ports.map((p) => [p.portId, p]));
    const wireMap = new Map(input.wires.map((w) => [w.wireId, w]));
    const legalElectricalIds = new Set([...Array.from({ length: 30 }, (_, i) => mw(i + 1)), ...Array.from({ length: 20 }, (_, i) => "cw_" + String(i + 1).padStart(2, "0"))]);
    [[input.ports, "portId"], [input.wires, "wireId"], [input.components, "componentId"], [input.junctions, "junctionId"], [input.crossings, "crossingId"]].forEach(([items, key]) => check(new Set(items.map((v) => v[key])).size === items.length, "duplicate " + key));
    const near = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < 0.001;
    input.wires.forEach((w) => {
      check(w.points.length >= 2, "empty wire " + w.wireId);
      check(near(w.points[0], portMap.get(w.fromPort)), "from endpoint " + w.wireId);
      check(near(w.points.at(-1), portMap.get(w.toPort)), "to endpoint " + w.wireId);
      check(w.electricalWireIds.length > 0 && w.electricalWireIds.every((id) => legalElectricalIds.has(id)), "electrical mapping " + w.wireId);
      w.points.forEach((p) => check(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= input.viewBox.width && p.y <= input.viewBox.height, "out-of-bounds " + w.wireId));
    });
    input.components.forEach((c) => c.portIds.forEach((id) => check(portMap.has(id), "component port " + c.componentId + "/" + id)));
    input.ports.forEach((p) => {
      const connections = input.wires.filter((w) => w.fromPort === p.portId || w.toPort === p.portId).length;
      const componentEndpoint = input.components.some((c) => c.portIds.includes(p.portId));
      check(connections >= (componentEndpoint ? 1 : 2), "dangling port " + p.portId);
    });
    input.junctions.forEach((j) => {
      check(near(j, portMap.get(j.portId)), "junction port " + j.junctionId);
      check(input.wires.filter((w) => onWire(j, w)).length >= 3, "junction incidence " + j.junctionId);
    });
    input.crossings.forEach((c) => {
      check(c.electricallyConnected === false, "conductive crossing " + c.crossingId);
      check(wireMap.has(c.wireA) && wireMap.has(c.wireB) && onWire(c, wireMap.get(c.wireA)) && onWire(c, wireMap.get(c.wireB)), "crossing incidence " + c.crossingId);
      check(!input.junctions.some((j) => near(j, c)), "crossing junction collision " + c.crossingId);
    });
    const mapped = new Set(input.wires.flatMap((w) => w.electricalWireIds));
    legalElectricalIds.forEach((id) => check(mapped.has(id), "unmapped electrical wire " + id));
    return { valid: errors.length === 0, errors };
  }
  data.validateGeometry = validateGeometry;
  function deepFreeze(value) {
    Object.values(value).forEach((item) => { if (item && typeof item === "object") deepFreeze(item); });
    return Object.freeze(value);
  }
  platform.moduleCircuitData.ch02Reverse = deepFreeze(data);
})(globalThis);
