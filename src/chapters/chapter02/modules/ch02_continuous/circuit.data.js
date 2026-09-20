(function installContinuousCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  const p = (x, y) => ({ x, y });
  function createContinuousCircuitData(legacy) {
    const ports = {};
    const wires = [];
    const motor = { cx: 251, cy: 751, rx: 56, ry: 42 };
    const wire = (wireId, kind, fromPort, toPort, electricalWireIds, via = []) => {
      wires.push({ wireId, kind, fromPort, toPort, electricalWireIds, points: [ports[fromPort], ...via, ports[toPort]] });
    };
    ["a", "b", "c"].forEach((phase, i) => {
      const x = [176, 251, 326][i], terminal = ["u", "v", "w"][i];
      ports["src_" + phase] = p(x, 174);
      ports["qf1_" + phase + "_in"] = p(x, 230);
      ports["qf1_" + phase + "_out"] = p(x, 260);
      ports["fu1_" + phase + "_in"] = p(x, 276);
      ports["fu1_" + phase + "_out"] = p(x, 331);
      ports["km1_main_" + phase + "_in"] = p(x, 541);
      ports["km1_main_" + phase + "_out"] = p(x, 627);
      ports["fr1_" + terminal + "_in"] = p(x, 627);
      ports["fr1_" + terminal + "_out"] = p(x, 656);
      ports["motor_" + terminal + "_in"] = p(i === 1 ? x : i === 0 ? 202 : 300, i === 1 ? 709 : 731);
      wire("ccmw_0" + (i + 1), "main", "src_" + phase, "qf1_" + phase + "_in", ["ccmw_0" + (i + 1)]);
      wire("ccmw_0" + (i + 4), "main", "qf1_" + phase + "_out", "fu1_" + phase + "_in", ["ccmw_0" + (i + 4)]);
      wire("ccmw_0" + (i + 7), "main", "fu1_" + phase + "_out", "km1_main_" + phase + "_in", ["ccmw_0" + (i + 7)]);
      wire("ccmw_" + (i + 10), "main", "km1_main_" + phase + "_out", "fr1_" + terminal + "_in", ["ccmw_" + (i + 10)]);
      wire("ccmw_" + (i + 13), "main", "fr1_" + terminal + "_out", "motor_" + terminal + "_in", ["ccmw_" + (i + 13)], i === 0 ? [p(176, 710)] : i === 2 ? [p(326, 710)] : []);
    });
    Object.assign(ports, {
      control_feed: p(511, 174), fu2_l: p(511, 194), fu2_r: p(511, 251),
      control_left_junction: p(511, 278), control_left_bottom: p(511, 417),
      ctrl_start_feed: p(579, 278), sb1_l: p(655, 278), sb1_r: p(737, 278), sb2_l: p(879, 278), sb2_r: p(953, 278),
      km1_self_l: p(659, 361), km1_self_r: p(737, 361),
      coil_km1_l: p(1069, 278), coil_km1_r: p(1146, 278),
      fr1_nc_l: p(1237, 278), fr1_nc_r: p(1322, 305), control_return: p(1365, 241),
      return_feed_top: p(1365, 179), return_feed_bottom: p(1365, 187), control_right_junction: p(1365, 305), control_right_bottom: p(1365, 412)
    });
    wire("cccw_01", "control", "control_feed", "fu2_l", ["cccw_01"]);
    wire("cccw_02", "control", "fu2_r", "ctrl_start_feed", ["cccw_02"], [p(511, 278)]);
    wire("cccw_03", "control", "ctrl_start_feed", "sb1_l", ["cccw_03"]);
    wire("cccw_04", "control", "sb1_r", "sb2_l", ["cccw_04"]);
    wire("cccw_05", "control", "ctrl_start_feed", "km1_self_l", ["cccw_05"], [p(579, 361)]);
    wire("cccw_06", "control", "km1_self_r", "sb2_l", ["cccw_06"], [p(805, 361), p(805, 278)]);
    wire("cccw_07", "control", "sb2_r", "coil_km1_l", ["cccw_07"]);
    wire("cccw_08", "control", "coil_km1_r", "fr1_nc_l", ["cccw_08"]);
    wire("cccw_09", "control", "fr1_nc_r", "control_return", ["cccw_09"], [p(1365, 305), p(1365, 241)]);
    wire("cccw_10", "control", "return_feed_top", "return_feed_bottom", ["cccw_09"]);
    wire("cccw_11", "control", "return_feed_bottom", "control_return", ["cccw_09"]);
    wire("cccw_12", "control", "control_left_junction", "control_left_bottom", ["cccw_02"]);
    wire("cccw_13", "control", "control_right_junction", "control_right_bottom", ["cccw_09"]);
    const bankPorts = (name, phases) => ["in", "out"].flatMap((side) => phases.map((phase) => name + "_" + phase + "_" + side));
    const components = [
      { componentId: "source", type: "source_bank", portIds: ["src_a", "src_b", "src_c"], electricalEdgeIds: [], geometry: {} },
      { componentId: "qf1", type: "breaker_bank", portIds: bankPorts("qf1", ["a", "b", "c"]), electricalEdgeIds: ["cont_qf1_a", "cont_qf1_b", "cont_qf1_c"], geometry: {} },
      { componentId: "fu1", type: "fuse_bank", portIds: bankPorts("fu1", ["a", "b", "c"]), electricalEdgeIds: ["cont_fu1_a", "cont_fu1_b", "cont_fu1_c"], geometry: {} },
      { componentId: "km1_main", type: "main_contact_bank", portIds: bankPorts("km1_main", ["a", "b", "c"]), electricalEdgeIds: ["cont_km1_main_a", "cont_km1_main_b", "cont_km1_main_c"], geometry: {} },
      { componentId: "fr1_main", type: "thermal_relay_main", portIds: bankPorts("fr1", ["u", "v", "w"]), electricalEdgeIds: ["cont_fr1_u", "cont_fr1_v", "cont_fr1_w"], geometry: { x: 157, y: 627, width: 188, height: 29 } },
      { componentId: "motor", type: "motor", portIds: ["motor_u_in", "motor_v_in", "motor_w_in"], electricalEdgeIds: [], geometry: motor },
      { componentId: "fu2", type: "fuse_control_vertical", portIds: ["fu2_l", "fu2_r"], electricalEdgeIds: ["cont_fu2"], geometry: { x: 497, y: 194, width: 28, height: 57 } },
      { componentId: "return_fuse", type: "fuse_control_return", portIds: ["return_feed_top", "return_feed_bottom"], electricalEdgeIds: [], geometry: { x: 1353, y: 187, width: 26, height: 54 } },
      { componentId: "sb1", type: "push_button_no", portIds: ["sb1_l", "sb1_r"], electricalEdgeIds: ["cont_sb1_no"], geometry: { capX: 691, capY: 221 } },
      { componentId: "sb2", type: "push_button_nc", portIds: ["sb2_l", "sb2_r"], electricalEdgeIds: ["cont_sb2_nc"], geometry: { capX: 916, capY: 221 } },
      { componentId: "km1_self", type: "aux_contact_no", portIds: ["km1_self_l", "km1_self_r"], electricalEdgeIds: ["cont_km1_self_no"], geometry: {} },
      { componentId: "coil", type: "coil", portIds: ["coil_km1_l", "coil_km1_r"], electricalEdgeIds: ["cont_coil_km1"], geometry: { x: 1069, y: 236, width: 77, height: 83 } },
      { componentId: "fr1_nc", type: "thermal_relay_nc", portIds: ["fr1_nc_l", "fr1_nc_r"], electricalEdgeIds: ["cont_fr1_nc"], geometry: {} }
    ];
    const deviceNames = { qf1: "dev_qf1", fu1: "dev_fu1", km1_main: "dev_km1", fr1_main: "dev_fr1", fu2: "dev_fu2", sb1: "dev_start_button", sb2: "dev_stop_button", km1_self: "dev_km1", coil: "dev_km1", fr1_nc: "dev_fr1" };
    const deviceEdges = components.flatMap((component) => component.electricalEdgeIds.map((edgeId, i) => {
      const pair = component.portIds.length === 6 ? [i, i + 3] : [0, 1];
      return { edgeId, fromPort: component.portIds[pair[0]], toPort: component.portIds[pair[1]], componentId: component.componentId, deviceId: deviceNames[component.componentId], domain: ["sb1", "sb2", "km1_self", "coil", "fr1_nc", "fu2"].includes(component.componentId) ? "control" : "main" };
    }));
    const junctions = [
      { junctionId: "cc_jx_start", x: 579, y: 278, wireIds: ["cccw_02", "cccw_03", "cccw_05"], connected: true },
      { junctionId: "cc_jx_self_return", x: 805, y: 278, wireIds: ["cccw_04", "cccw_06"], connected: true },
      { junctionId: "cc_jx_self_l", x: 579, y: 361, wireIds: ["cccw_05"], connected: true },
      { junctionId: "cc_jx_self_r", x: 805, y: 361, wireIds: ["cccw_06"], connected: true },
      { junctionId: "cc_jx_left_rail", x: 511, y: 278, wireIds: ["cccw_02", "cccw_12"], connected: true },
      { junctionId: "cc_jx_right_rail", x: 1365, y: 305, wireIds: ["cccw_09", "cccw_13"], connected: true }
    ];
    const crossings = [];
    const labels = [
      { text: "长动控制", x: 165, y: 147, kind: "diagram-title", fontSize: 47 },
      { text: "主电路", x: 105, y: 760, kind: "section", frame: { x: 25, y: 726, width: 160, height: 51 }, fontSize: 31 },
      { text: "控制电路", x: 830, y: 146, kind: "section", frame: { x: 733, y: 111, width: 193, height: 51 }, fontSize: 34 },
      ...[["QF1", 105, 253, 30], ["FU1", 113, 307, 28], ["KM1", 100, 557, 30], ["FR1", 117, 653, 31], ["FU2", 465, 223, 29], ["SB1", 630, 220, 27], ["SB2", 849, 220, 27], ["KM1", 1038, 225, 27], ["FR1", 1203, 320, 27]].map(([text, x, y, fontSize]) => ({ text, x, y, kind: "device", fontSize }))
    ];
    const data = {
      schemaVersion: "1.0", moduleId: "ch02_continuous", routeId: "self-lock", geometryLockId: "continuous_control_textbook_trace_v1",
      reference: { source: "C:\\电路截图\\屏幕截图 2026-09-19 025508.png", originalWidth: 1467, originalHeight: 835, sha256: "A660491181F7B7403B2E32015A3610AF68BC7FB33BB5567FA8D7824E14E90760", coordinateSpace: "source-image-pixels", excludedRegions: [{ x: 370, y: 420, width: 1097, height: 415 }], controlBoundaryMap: { control_feed: "fu1_c_out", control_return: "fu1_b_out" } },
      // Keep the full textbook section frame visible while excluding the PPT
      // title band above the drawing and the explanatory text below it.
      viewBox: { x: 20, y: 90, width: 1370, height: 725 },
      ports: Object.entries(ports).map(([portId, point]) => ({ portId, ...point, electricalPortId: portId === "control_feed" ? "fu1_c_out" : portId === "control_return" ? "fu1_b_out" : portId })),
      wires, components, deviceEdges, junctions, crossings, labels
    };
    data.validateGeometry = () => {
      const errors = [], map = new Map(data.ports.map((item) => [item.portId, item])), wireMap = new Map(wires.map((item) => [item.wireId, item]));
      const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
      wires.forEach((item) => { if (!same(item.points[0], map.get(item.fromPort)) || !same(item.points.at(-1), map.get(item.toPort))) errors.push("wire endpoint mismatch " + item.wireId); if (legacy?.wires && item.electricalWireIds.some((id) => !legacy.wires.some((old) => old.wireId === id))) errors.push("unknown legacy wire " + item.wireId); });
      deviceEdges.forEach((edge) => { if (!map.has(edge.fromPort) || !map.has(edge.toPort)) errors.push("dangling edge " + edge.edgeId); });
      junctions.forEach((item) => item.wireIds.forEach((wireId) => { if (!wireMap.has(wireId)) errors.push("unknown junction wire " + wireId); }));
      ["motor_u_in", "motor_v_in", "motor_w_in"].forEach((id) => { const q = map.get(id); if (Math.abs(((q.x - motor.cx) / motor.rx) ** 2 + ((q.y - motor.cy) / motor.ry) ** 2 - 1) > 0.02) errors.push("motor terminal mismatch " + id); });
      return { valid: errors.length === 0, errors, wires: wires.length, ports: data.ports.length, components: components.length, junctions: junctions.length, crossings: crossings.length };
    };
    return Object.freeze(data);
  }
  platform.moduleCircuitData.createContinuousCircuitData = createContinuousCircuitData;
})(globalThis);
