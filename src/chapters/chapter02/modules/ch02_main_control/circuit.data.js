(function installMainControlCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const point = (value) => ({ x: Number(value.x), y: Number(value.y) });
  const edge = (id) => [id];

  // The legacy Solver already contains the accepted electrical graph. This factory
  // gives the new renderer an immutable, single-SVG view of that same graph.
  function createMainControlCircuitData(legacy) {
    if (!legacy?.ports || !legacy?.wires || !legacy?.deviceEdges) throw new Error("Main-control legacy circuit data is required");
    const ports = Object.entries(legacy.ports).map(([portId, value]) => ({ portId, ...point(value), electricalPortId: portId }));
    const visualWireIdsByElectricalId = {
      cw_04: ["cw_04_supply", "cw_04_return"],
      cw_18: ["cw_04_return"]
    };
    const wires = legacy.wires.flatMap((wire) => {
      if (wire.wireId === "cw_04") {
        return [
          {
            wireId: "cw_04_supply",
            kind: wire.kind,
            fromPort: "control_supply_right",
            toPort: "control_right_top",
            electricalWireIds: ["cw_04"],
            points: [point({ x: 1394, y: 408 }), point({ x: 1394, y: 469 })]
          },
          {
            wireId: "cw_04_return",
            kind: wire.kind,
            fromPort: "control_right_top",
            toPort: "control_right_bottom",
            electricalWireIds: ["cw_04", "cw_18"],
            points: [point({ x: 1394, y: 469 }), point({ x: 1394, y: 697 })]
          }
        ];
      }
      if (wire.wireId === "cw_18") return [];
      return [{
        wireId: wire.wireId,
        kind: wire.kind,
        fromPort: wire.fromPort,
        toPort: wire.toPort,
        electricalWireIds: [wire.wireId],
        points: wire.routePoints.map(point)
      }];
    });
    const components = [
      { componentId: "source", type: "source_bank", portIds: ["src_l1", "src_l2", "src_l3"], electricalEdgeIds: [], geometry: {} },
      { componentId: "qf1", type: "breaker_bank", portIds: ["qf1_l1_in", "qf1_l2_in", "qf1_l3_in", "qf1_l1_out", "qf1_l2_out", "qf1_l3_out"], electricalEdgeIds: ["qf1_edge_l1", "qf1_edge_l2", "qf1_edge_l3"], geometry: { x: 120, y: 142, width: 220, height: 100 } },
      { componentId: "fu1", type: "fuse_bank", portIds: ["fu1_l1_in", "fu1_l2_in", "fu1_l3_in", "fu1_l1_out", "fu1_l2_out", "fu1_l3_out"], electricalEdgeIds: ["fu1_edge_l1", "fu1_edge_l2", "fu1_edge_l3"], geometry: { x: 130, y: 252, width: 195, height: 100 } },
      { componentId: "km1_main", type: "main_contact_bank", portIds: ["km1_main_a_in", "km1_main_b_in", "km1_main_c_in", "km1_main_a_out", "km1_main_b_out", "km1_main_c_out"], electricalEdgeIds: ["edge_km1_main_a", "edge_km1_main_b", "edge_km1_main_c"], geometry: { x: 140, y: 580, width: 190, height: 170 } },
      { componentId: "km2_main", type: "main_contact_bank", portIds: ["km2_main_a_in", "km2_main_b_in", "km2_main_c_in", "km2_main_a_out", "km2_main_b_out", "km2_main_c_out"], electricalEdgeIds: ["edge_km2_main_a", "edge_km2_main_b", "edge_km2_main_c"], geometry: { x: 445, y: 580, width: 190, height: 170 } },
      { componentId: "fr1_main", type: "thermal_relay_main", portIds: ["fr1_u_in", "fr1_v_in", "fr1_w_in", "fr1_u_out", "fr1_v_out", "fr1_w_out"], electricalEdgeIds: ["edge_fr1_u", "edge_fr1_v", "edge_fr1_w"], geometry: { x: 125, y: 779, width: 197, height: 40 } },
      { componentId: "fr2_main", type: "thermal_relay_main", portIds: ["fr2_u_in", "fr2_v_in", "fr2_w_in", "fr2_u_out", "fr2_v_out", "fr2_w_out"], electricalEdgeIds: ["edge_fr2_u", "edge_fr2_v", "edge_fr2_w"], geometry: { x: 427, y: 779, width: 197, height: 40 } },
      { componentId: "motor1", type: "motor", portIds: ["motor1_u_in", "motor1_v_in", "motor1_w_in"], electricalEdgeIds: [], geometry: { cx: 228, cy: 947, rx: 60, ry: 60, label: "1M" } },
      { componentId: "motor2", type: "motor", portIds: ["motor2_u_in", "motor2_v_in", "motor2_w_in"], electricalEdgeIds: [], geometry: { cx: 530, cy: 947, rx: 60, ry: 60, label: "2M" } },
      { componentId: "sb1", type: "push_button_no", portIds: ["sb1_l", "sb1_r"], electricalEdgeIds: ["edge_sb1_no"], geometry: {} },
      { componentId: "sb2", type: "push_button_nc", portIds: ["sb2_l", "sb2_r"], electricalEdgeIds: ["edge_sb2_nc"], geometry: {} },
      { componentId: "sb3", type: "push_button_no", portIds: ["sb3_l", "sb3_r"], electricalEdgeIds: ["edge_sb3_no"], geometry: {} },
      { componentId: "sb4", type: "push_button_nc", portIds: ["sb4_l", "sb4_r"], electricalEdgeIds: ["edge_sb4_nc"], geometry: {} },
      { componentId: "km1_self", type: "contact_no", portIds: ["km1_self_l", "km1_self_r"], electricalEdgeIds: ["edge_km1_self_no"], geometry: {} },
      { componentId: "km2_self", type: "contact_no", portIds: ["km2_self_l", "km2_self_r"], electricalEdgeIds: ["edge_km2_self_no"], geometry: {} },
      { componentId: "fr1_nc", type: "thermal_relay_nc", portIds: ["fr1_nc_l", "fr1_nc_r"], electricalEdgeIds: ["edge_fr1_nc"], geometry: {} },
      { componentId: "fr2_nc", type: "thermal_relay_nc", portIds: ["fr2_nc_l", "fr2_nc_r"], electricalEdgeIds: ["edge_fr2_nc"], geometry: {} },
      { componentId: "km1_coil", type: "coil", portIds: ["coil_km1_l", "coil_km1_r"], electricalEdgeIds: ["edge_coil_km1"], geometry: { width: 80, height: 78 } },
      { componentId: "km2_coil", type: "coil", portIds: ["coil_km2_l", "coil_km2_r"], electricalEdgeIds: ["edge_coil_km2"], geometry: { width: 80, height: 78 } }
    ];
    const labels = [
      ["QF1", 70, 260, "device", "start", 28], ["FU1", 88, 343, "device", "start", 28],
      ["KM1", 80, 684, "device", "start", 28], ["KM2", 627, 673, "device", "start", 28],
      ["FR1", 98, 806, "device", "start", 28], ["FR2", 400, 806, "device", "start", 28],
      ["1M", 228, 954, "motor", "middle", 31], ["2M", 530, 954, "motor", "middle", 31],
      ["\u63a7\u5236\u7535\u8def", 1090, 900, "section", "middle", 52], ["\u4e3b\u7535\u8def", 380, 1075, "section", "middle", 52],
      ["SB1", 810, 410, "device", "start", 34], ["SB2", 963, 416, "device", "start", 34],
      ["FR1", 1120, 573, "device", "middle", 32], ["KM1", 1185, 434, "device", "start", 34],
      ["SB3", 810, 638, "device", "start", 34], ["SB4", 963, 644, "device", "start", 34],
      ["FR2", 1120, 801, "device", "middle", 32], ["KM2", 1195, 661, "device", "start", 34]
    ].map(([text, x, y, kind, anchor, fontSize]) => ({ text, x, y, kind, anchor, fontSize }));
    const junctionCorrections = {
      mc_jx_01: ["mw_07", "mw_08"],
      mc_jx_02: ["mw_10", "mw_11", "mw_12"],
      mc_jx_03: ["mw_13", "mw_14", "mw_15"],
      mc_jx_04: ["cw_01", "cw_02", "cw_05", "cw_11"],
      mc_jx_05: ["cw_02", "cw_03", "cw_19"],
      mc_jx_06: ["cw_04", "cw_10", "cw_18"],
      mc_jx_07: ["cw_04", "cw_17", "cw_18"],
      mc_jx_08: ["cw_06", "cw_07", "cw_12"],
      mc_jx_09: ["cw_13", "cw_14", "cw_20"],
      mc_jx_10: ["cw_08"],
      mc_jx_11: ["cw_16"]
    };
    const junctions = (legacy.junctions || []).filter((junction) => !["mc_jx_10", "mc_jx_11"].includes(junction.id || junction.junctionId)).map((junction) => ({
      junctionId: junction.id || junction.junctionId,
      x: junction.x,
      y: junction.y,
      wireIds: [...new Set((junctionCorrections[junction.id || junction.junctionId] || junction.wireIds || [])
        .flatMap((wireId) => visualWireIdsByElectricalId[wireId] || [wireId]))]
    }));
    const data = Object.freeze({
      schemaVersion: "1.0",
      moduleId: "ch02_main_control",
      routeId: "main-control",
      geometryLockId: "main_control_textbook_static_v2",
      reference: {
        source: "C:\\电路截图\\屏幕截图 2026-09-18 045505.png",
        originalWidth: 1485,
        originalHeight: 1122,
        sha256: "F4CDBC594C3E0DC622C8AE60B9DD0EAE7AEC149D29E6BD35BC3D07E2C2857BAC",
        crop: { x: 0, y: 0, width: 1485, height: 1122 },
        coordinateSpace: "independent-traced-svg-canvas",
        coordinateNote: "The PPT frame is removed; geometry is traced in the frozen SVG viewBox below, not pixel-scaled from the screenshot."
      },
      viewBox: { x: 0, y: 0, width: 1509, height: 1102 },
      ports, wires, components, labels, junctions,
      // These paths visually cross, but the textbook has no junction dot there.
      // Keeping that fact in circuit data prevents later visual changes from
      // treating either crossing as an electrical connection.
      crossings: [
        { crossingId: "mc_xc_01", x: 302, y: 508, wireIds: ["mw_12", "mw_14"], type: "non_electrical_crossing" },
        { crossingId: "mc_xc_02", x: 228, y: 606, wireIds: ["mw_08", "mw_11"], type: "non_electrical_crossing" },
        { crossingId: "mc_xc_03", x: 302, y: 606, wireIds: ["mw_08", "mw_14"], type: "non_electrical_crossing" }
      ],
      mechanicalLinks: [], deviceEdges: clone(legacy.deviceEdges)
    });
    return Object.freeze({ ...data, validateGeometry: () => {
      const errors = [];
      const portMap = new Map(data.ports.map((item) => [item.portId, item]));
      data.wires.forEach((wire) => {
        if (!portMap.has(wire.fromPort) || !portMap.has(wire.toPort)) errors.push("dangling wire " + wire.wireId);
        if (!wire.points.length) errors.push("empty wire " + wire.wireId);
      });
      data.components.forEach((component) => component.portIds.forEach((portId) => { if (!portMap.has(portId)) errors.push(component.componentId + " missing " + portId); }));
      const samePoint = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y);
      const wireMap = new Map(data.wires.map((wire) => [wire.wireId, wire]));
      data.wires.forEach((wire) => {
        const from = portMap.get(wire.fromPort), to = portMap.get(wire.toPort);
        if (!samePoint(wire.points[0], from) || !samePoint(wire.points[wire.points.length - 1], to)) errors.push("wire endpoint mismatch " + wire.wireId);
      });
      data.deviceEdges.forEach((deviceEdge) => {
        if (!portMap.has(deviceEdge.fromPort) || !portMap.has(deviceEdge.toPort)) errors.push("device edge dangling " + deviceEdge.edgeId);
      });
      data.junctions.forEach((junction) => {
        junction.wireIds.forEach((wireId) => { if (!wireMap.has(wireId)) errors.push(junction.junctionId + " missing " + wireId); });
      });
      data.crossings.forEach((crossing) => {
        if (crossing.type !== "non_electrical_crossing") errors.push(crossing.crossingId + " must remain non-electrical");
        crossing.wireIds.forEach((wireId) => { if (!wireMap.has(wireId)) errors.push(crossing.crossingId + " missing " + wireId); });
      });
      return { valid: errors.length === 0, errors, wires: data.wires.length, ports: data.ports.length, junctions: data.junctions.length, crossings: data.crossings.length, components: data.components.length };
    } });
  }
  platform.moduleCircuitData.createMainControlCircuitData = createMainControlCircuitData;
})(globalThis);
