(function installJogCircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  const p = (x, y) => ({ x, y });
  function createJogCircuitData(legacy) {
    // Coordinates are measured directly in the supplied 1516 x 1132 image.
    // Only selected circuit objects are traced: the lower-right prose is not a crop boundary.
    const ports = {};
    const wires = [];
    const motor = { cx: 301, cy: 990, r: 89 };
    const wire = (wireId, kind, fromPort, toPort, electricalWireIds, via = []) => {
      wires.push({ wireId, kind, fromPort, toPort, electricalWireIds, points: [ports[fromPort], ...via, ports[toPort]] });
    };
    ["a", "b", "c"].forEach((phase, i) => {
      const x = 225 + i * 76, terminal = ["u", "v", "w"][i];
      Object.entries({ src: 293, qf_in: 385, qf_out: 460, fu1_in: 482, fu1_out: 529, km_main_in: 720, km_main_out: 800, fr_in: 815, fr_out: 877 }).forEach(([name, y]) => {
        const id = name === "src" ? "src_" + phase
          : name.startsWith("fr_") ? "fr_" + terminal + "_" + name.slice(3)
            : name.replace(/_(in|out)$/, "_" + phase + "_$1");
        ports[id] = p(x, y);
      });
      ports["motor_" + terminal + "_in"] = p(x, motor.cy - Math.sqrt(motor.r ** 2 - (x - motor.cx) ** 2));
      wire("jmw_0" + (i + 1), "main", "src_" + phase, "qf_" + phase + "_in", ["jmw_0" + (i + 1)]);
      wire("jmw_0" + (i + 4), "main", "qf_" + phase + "_out", "fu1_" + phase + "_in", ["jmw_0" + (i + 4)]);
      if (i === 0) wire("jmw_07", "main", "fu1_a_out", "km_main_a_in", ["jmw_07"]);
      else {
        const id = "jmw_0" + (i + 7), feed = i === 1 ? "jcw_02" : "jcw_01";
        ports["branch_" + phase] = p(x, i === 1 ? 612 : 564);
        // Shared supply segment is drawn once; either complete circuit can activate it.
        wire(id + "_supply", "main", "fu1_" + phase + "_out", "branch_" + phase, [id, feed]);
        wire(id + "_load", "main", "branch_" + phase, "km_main_" + phase + "_in", [id]);
      }
      wire("jmw_" + (i + 10), "main", "km_main_" + phase + "_out", "fr_" + terminal + "_in", ["jmw_" + (i + 10)]);
      wire("jmw_" + (i + 13), "main", "fr_" + terminal + "_out", "motor_" + terminal + "_in", ["jmw_" + (i + 13)]);
    });
    Object.assign(ports, {
      fu2_top_l: p(424, 564), fu2_top_r: p(512, 564),
      fu2_bottom_l: p(424, 612), fu2_bottom_r: p(512, 612),
      jog_ctrl_top_corner: p(576, 564), jog_ctrl_top_rail: p(576, 429),
      fr_nc_l: p(1124, 429), fr_nc_r: p(1194, 469), jog_ctrl_return_drop: p(1246, 429),
      sb_l: p(661, 612), sb_r: p(750, 612), coil_km_l: p(958, 612), coil_km_r: p(1034, 612)
    });
    wire("jcw_01", "control", "branch_c", "fu2_top_l", ["jcw_01"]);
    wire("jcw_02", "control", "branch_b", "fu2_bottom_l", ["jcw_02"]);
    wire("jcw_03", "control", "fu2_top_r", "jog_ctrl_top_corner", ["jcw_03"]);
    wire("jcw_04", "control", "jog_ctrl_top_corner", "jog_ctrl_top_rail", ["jcw_04"]);
    wire("jcw_05", "control", "jog_ctrl_top_rail", "fr_nc_l", ["jcw_05"]);
    wire("jcw_06", "control", "fr_nc_r", "jog_ctrl_return_drop", ["jcw_06"], [p(1246, 469)]);
    wire("jcw_07", "control", "jog_ctrl_return_drop", "coil_km_r", ["jcw_07"], [p(1246, 612)]);
    wire("jcw_08", "control", "fu2_bottom_r", "sb_l", ["jcw_08"]);
    wire("jcw_09", "control", "sb_r", "coil_km_l", ["jcw_09"]);
    const bankPorts = (name, phases) => ["in", "out"].flatMap((side) => phases.map((phase) => name + "_" + phase + "_" + side));
    const components = [
      { componentId: "source", type: "source_bank", portIds: ["src_a", "src_b", "src_c"], electricalEdgeIds: [], geometry: {} },
      { componentId: "qf", type: "breaker_bank", portIds: bankPorts("qf", ["a", "b", "c"]), electricalEdgeIds: ["jog_qf_a", "jog_qf_b", "jog_qf_c"], geometry: { x: 180, y: 355, width: 215, height: 118 } },
      { componentId: "fu1", type: "fuse_bank", portIds: bankPorts("fu1", ["a", "b", "c"]), electricalEdgeIds: ["jog_fu1_a", "jog_fu1_b", "jog_fu1_c"], geometry: {} },
      { componentId: "fu2", type: "fuse_control_bank", portIds: ["fu2_top_l", "fu2_top_r", "fu2_bottom_l", "fu2_bottom_r"], electricalEdgeIds: ["jog_fu2_top", "jog_fu2_bottom"], geometry: {} },
      { componentId: "km_main", type: "main_contact_bank", portIds: bankPorts("km_main", ["a", "b", "c"]), electricalEdgeIds: ["jog_km_main_a", "jog_km_main_b", "jog_km_main_c"], geometry: {} },
      { componentId: "fr_main", type: "thermal_relay_main", portIds: bankPorts("fr", ["u", "v", "w"]), electricalEdgeIds: ["jog_fr_u", "jog_fr_v", "jog_fr_w"], geometry: { x: 176, y: 815, width: 241, height: 62 } },
      { componentId: "motor", type: "motor", portIds: ["motor_u_in", "motor_v_in", "motor_w_in"], electricalEdgeIds: [], geometry: motor },
      { componentId: "sb", type: "push_button_no", portIds: ["sb_l", "sb_r"], electricalEdgeIds: ["jog_sb_no"], geometry: { x: 646, y: 536, width: 129, height: 98 } },
      { componentId: "coil", type: "coil", portIds: ["coil_km_l", "coil_km_r"], electricalEdgeIds: ["jog_coil_km"], geometry: { x: 958, y: 549, width: 76, height: 128 } },
      { componentId: "fr_nc", type: "thermal_relay_nc", portIds: ["fr_nc_l", "fr_nc_r"], electricalEdgeIds: ["jog_fr_nc"], geometry: { x: 1110, y: 407, width: 112, height: 108 } }
    ];
    const deviceNames = { source: "dev_source", qf: "dev_qf", fu1: "dev_fu1", fu2: "dev_fu2", km_main: "dev_km", fr_main: "dev_fr", motor: "dev_motor", sb: "dev_sb", coil: "dev_km", fr_nc: "dev_fr" };
    const deviceEdges = components.flatMap((component) => component.electricalEdgeIds.map((edgeId, i) => {
      const pair = component.type === "fuse_control_bank" ? [i * 2, i * 2 + 1]
        : component.portIds.length === 6 ? [i, i + 3] : [0, 1];
      return { edgeId, fromPort: component.portIds[pair[0]], toPort: component.portIds[pair[1]], componentId: component.componentId, deviceId: deviceNames[component.componentId], domain: component.type === "coil" || component.type === "push_button_no" || component.type === "thermal_relay_nc" || component.type === "fuse_control_bank" ? "control" : "main" };
    }));
    const junctions = [
      { junctionId: "jog_branch_b", ...ports.branch_b, electricalPortId: "fu1_b_out", wireIds: ["jmw_08_supply", "jmw_08_load", "jcw_02"] },
      { junctionId: "jog_branch_c", ...ports.branch_c, electricalPortId: "fu1_c_out", wireIds: ["jmw_09_supply", "jmw_09_load", "jcw_01"] }
    ];
    const crossings = [{ crossingId: "jog_b_feed_crosses_c", x: 377, y: 612, wireIds: ["jcw_02", "jmw_09_load"], connected: false }];
    const labels = [
      { text: "主电路", x: 123, y: 324, kind: "section", frame: { x: 45, y: 280, width: 157, height: 66 }, fontSize: 36 },
      { text: "控制电路", x: 833, y: 367, kind: "section", frame: { x: 737, y: 322, width: 192, height: 66 }, fontSize: 36 },
      ...["A", "B", "C"].map((text, i) => ({ text, x: 215 + i * 81, y: 276, kind: "phase", fontSize: 30 })),
      ...[["QF", 158, 414, 36], ["FU1", 165, 524, 36], ["FU2", 473, 521, 34], ["KM", 141, 764, 36], ["FR", 89, 864, 46], ["SB", 705, 524, 36], ["KM", 972, 524, 36], ["FR", 1165, 405, 36]].map(([text, x, y, fontSize]) => ({ text, x, y, kind: "device", fontSize }))
    ];
    const data = {
      schemaVersion: "1.0", moduleId: "ch02_jog", routeId: "jog-control", geometryLockId: "jog_control_textbook_trace_v1",
      reference: {
        source: "C:\\电路截图\\屏幕截图 2026-09-18 234225.png", originalWidth: 1516, originalHeight: 1132,
        sha256: "B97988AA5D4DBF38BD5B963F34C4FD439EFFC18AF0B2C6E89F8E37241D311AC9",
        coordinateSpace: "source-image-pixels",
        excludedRegions: [{ x: 419, y: 704, width: 1097, height: 428 }],
        coordinateNote: "Circuit-only trace; retain the lower-left motor, exclude lower-right prose and all PPT decoration."
      },
      viewBox: { x: 35, y: 245, width: 1245, height: 850 },
      ports: Object.entries(ports).map(([portId, point]) => ({ portId, ...point, electricalPortId: portId === "branch_b" ? "fu1_b_out" : portId === "branch_c" ? "fu1_c_out" : portId })),
      wires, components, deviceEdges, junctions, crossings, labels
    };
    data.validateGeometry = () => {
      const errors = [], portMap = new Map(data.ports.map((item) => [item.portId, item]));
      const wireMap = new Map(wires.map((item) => [item.wireId, item]));
      const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
      wires.forEach((item) => {
        if (!same(item.points[0], portMap.get(item.fromPort)) || !same(item.points.at(-1), portMap.get(item.toPort))) errors.push("Wire endpoint mismatch: " + item.wireId);
        if (item.points.some((point, i) => i && point.x !== item.points[i - 1].x && point.y !== item.points[i - 1].y)) errors.push("Non-orthogonal wire: " + item.wireId);
        if (legacy?.wires && item.electricalWireIds.some((id) => !legacy.wires.some((old) => old.wireId === id))) errors.push("Unknown electrical mapping: " + item.wireId);
      });
      deviceEdges.forEach((edge) => {
        if (!portMap.has(edge.fromPort) || !portMap.has(edge.toPort)) errors.push("Dangling edge: " + edge.edgeId);
      });
      [...junctions, ...crossings].forEach((item) => item.wireIds.forEach((id) => { if (!wireMap.has(id)) errors.push("Unknown wire: " + id); }));
      components.find((item) => item.componentId === "motor").portIds.forEach((id) => {
        const point = ports[id];
        if (Math.abs(Math.hypot(point.x - motor.cx, point.y - motor.cy) - motor.r) > 0.001) errors.push("Disconnected motor terminal: " + id);
      });
      return { valid: errors.length === 0, errors, wires: wires.length, ports: data.ports.length, components: components.length, junctions: junctions.length, crossings: crossings.length };
    };
    return Object.freeze(data);
  }
  platform.moduleCircuitData.createJogCircuitData = createJogCircuitData;
})(globalThis);
