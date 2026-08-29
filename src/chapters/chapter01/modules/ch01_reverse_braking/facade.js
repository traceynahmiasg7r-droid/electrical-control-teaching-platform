(function installCh01ReverseBrakingFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.chapterCircuitData = platform.chapterCircuitData || {};

  const MODULE_ID = "ch01_reverse_braking";
  const ROUTE_ID = "ch01-reverse-braking";
  const GEOMETRY_LOCK_ID = "ch01_reverse_braking_geometry_v2_two_file_locked";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const ns = (kind, id) => `${MODULE_ID}__${kind}__${id}`;
  const port = (id, x, y) => Object.freeze({ portId: ns("port", id), x, y });
  const wire = (id, domain, from, to, routePoints, group) => Object.freeze({
    wireId: ns("wire", id), circuitDomain: domain, fromPort: ns("port", from),
    toPort: ns("port", to), routePoints: Object.freeze(routePoints.map((point) => Object.freeze({ ...point }))), group
  });
  const component = (id, device, type, partType, label, circuitDomain, geometry) => Object.freeze({
    componentId: ns("cmp", id), deviceId: ns("dev", device), type, partType, label,
    circuitDomain, geometry: Object.freeze({ ...geometry, orientation: geometry.orientation || 0 })
  });
  const edge = (id, device, from, to, behavior, circuitDomain, electricalRole) => Object.freeze({
    edgeId: ns("edge", id), deviceId: ns("dev", device), fromPort: ns("port", from),
    toPort: ns("port", to), behavior, circuitDomain, electricalRole
  });

  /*
   * 两文件交付版：circuitData 内置在 facade.js 中。
   * 不依赖 PNG / HTML / circuit-data.js；Platform Shell 仍由主项目提供。
   */
  const ports = Object.freeze([
    port("src_a", 170, 116), port("src_b", 260, 116), port("src_c", 350, 116),
    port("qf_a_in", 170, 148), port("qf_a_out", 170, 218), port("qf_b_in", 260, 148), port("qf_b_out", 260, 218), port("qf_c_in", 350, 148), port("qf_c_out", 350, 218),
    port("km1_a_in", 145, 330), port("km1_a_out", 145, 400), port("km1_b_in", 205, 330), port("km1_b_out", 205, 400), port("km1_c_in", 265, 330), port("km1_c_out", 265, 400),
    port("km2_a_in", 330, 330), port("km2_a_out", 330, 400), port("km2_b_in", 390, 330), port("km2_b_out", 390, 400), port("km2_c_in", 450, 330), port("km2_c_out", 450, 400),
    port("fr_u_in", 190, 470), port("fr_u_out", 190, 525), port("fr_v_in", 260, 470), port("fr_v_out", 260, 525), port("fr_w_in", 330, 470), port("fr_w_out", 330, 525),
    port("motor_u", 218, 610), port("motor_v", 260, 590), port("motor_w", 302, 610),

    port("ctrl_l", 585, 140), port("fr_nc_in", 910, 140), port("fr_nc_out", 982, 140), port("ctrl_r", 1085, 140),
    port("run_src", 585, 285), port("sb2_nc_in", 630, 285), port("sb2_nc_out", 690, 285),
    port("start_split", 755, 285), port("sb1_in", 755, 285), port("sb1_out", 815, 285), port("hold_in", 755, 365), port("hold_out", 815, 365), port("start_merge", 855, 285),
    port("km2_nc_in", 885, 285), port("km2_nc_out", 945, 285), port("km1_coil_in", 985, 285), port("km1_coil_out", 1045, 285), port("run_ret", 1085, 285),
    port("brake_src", 585, 500), port("sb2_no_in", 630, 500), port("sb2_no_out", 690, 500), port("ks_in", 760, 500), port("ks_out", 820, 500),
    port("km1_nc_in", 875, 500), port("km1_nc_out", 935, 500), port("km2_coil_in", 975, 500), port("km2_coil_out", 1035, 500), port("brake_ret", 1085, 500)
  ]);

  const wires = Object.freeze([
    wire("m01", "main", "src_a", "qf_a_in", [{x:170,y:116},{x:170,y:148}], "supply"),
    wire("m02", "main", "src_b", "qf_b_in", [{x:260,y:116},{x:260,y:148}], "supply"),
    wire("m03", "main", "src_c", "qf_c_in", [{x:350,y:116},{x:350,y:148}], "supply"),
    wire("m04", "main", "qf_a_out", "km1_a_in", [{x:170,y:218},{x:170,y:285},{x:145,y:285},{x:145,y:330}], "forward"),
    wire("m05", "main", "qf_b_out", "km1_b_in", [{x:260,y:218},{x:260,y:285},{x:205,y:285},{x:205,y:330}], "forward"),
    wire("m06", "main", "qf_c_out", "km1_c_in", [{x:350,y:218},{x:350,y:285},{x:265,y:285},{x:265,y:330}], "forward"),
    wire("m07", "main", "qf_a_out", "km2_a_in", [{x:170,y:218},{x:170,y:270},{x:330,y:270},{x:330,y:330}], "brake"),
    wire("m08", "main", "qf_b_out", "km2_b_in", [{x:260,y:218},{x:260,y:260},{x:390,y:260},{x:390,y:330}], "brake"),
    wire("m09", "main", "qf_c_out", "km2_c_in", [{x:350,y:218},{x:350,y:250},{x:450,y:250},{x:450,y:330}], "brake"),
    wire("m10", "main", "km1_a_out", "fr_u_in", [{x:145,y:400},{x:145,y:440},{x:190,y:440},{x:190,y:470}], "forward"),
    wire("m11", "main", "km1_b_out", "fr_v_in", [{x:205,y:400},{x:205,y:430},{x:260,y:430},{x:260,y:470}], "forward"),
    wire("m12", "main", "km1_c_out", "fr_w_in", [{x:265,y:400},{x:265,y:420},{x:330,y:420},{x:330,y:470}], "forward"),
    wire("m13", "main", "km2_a_out", "fr_w_in", [{x:330,y:400},{x:330,y:470}], "brake"),
    wire("m14", "main", "km2_b_out", "fr_v_in", [{x:390,y:400},{x:390,y:445},{x:260,y:445},{x:260,y:470}], "brake"),
    wire("m15", "main", "km2_c_out", "fr_u_in", [{x:450,y:400},{x:450,y:455},{x:190,y:455},{x:190,y:470}], "brake"),
    wire("m16", "main", "fr_u_out", "motor_u", [{x:190,y:525},{x:190,y:565},{x:218,y:565},{x:218,y:610}], "load"),
    wire("m17", "main", "fr_v_out", "motor_v", [{x:260,y:525},{x:260,y:590}], "load"),
    wire("m18", "main", "fr_w_out", "motor_w", [{x:330,y:525},{x:330,y:565},{x:302,y:565},{x:302,y:610}], "load"),

    wire("c01", "control", "ctrl_l", "fr_nc_in", [{x:585,y:140},{x:910,y:140}], "control_supply"),
    wire("c02", "control", "fr_nc_out", "run_src", [{x:982,y:140},{x:585,y:140},{x:585,y:285}], "control_supply"),
    wire("c03", "control", "run_src", "sb2_nc_in", [{x:585,y:285},{x:630,y:285}], "run"),
    wire("c04", "control", "sb2_nc_out", "start_split", [{x:690,y:285},{x:755,y:285}], "run"),
    wire("c05", "control", "sb1_out", "start_merge", [{x:815,y:285},{x:855,y:285}], "run"),
    wire("c06", "control", "start_split", "hold_in", [{x:755,y:285},{x:720,y:285},{x:720,y:365},{x:755,y:365}], "hold"),
    wire("c07", "control", "hold_out", "start_merge", [{x:815,y:365},{x:855,y:365},{x:855,y:285}], "hold"),
    wire("c08", "control", "start_merge", "km2_nc_in", [{x:855,y:285},{x:885,y:285}], "run"),
    wire("c09", "control", "km2_nc_out", "km1_coil_in", [{x:945,y:285},{x:985,y:285}], "run"),
    wire("c10", "control", "km1_coil_out", "run_ret", [{x:1045,y:285},{x:1085,y:285}], "run"),
    wire("c11", "control", "run_ret", "ctrl_r", [{x:1085,y:285},{x:1085,y:140}], "control_return"),
    wire("c12", "control", "run_src", "brake_src", [{x:585,y:285},{x:585,y:500}], "control_supply"),
    wire("c13", "control", "brake_src", "sb2_no_in", [{x:585,y:500},{x:630,y:500}], "brake"),
    wire("c14", "control", "sb2_no_out", "ks_in", [{x:690,y:500},{x:760,y:500}], "brake"),
    wire("c15", "control", "ks_out", "km1_nc_in", [{x:820,y:500},{x:875,y:500}], "brake"),
    wire("c16", "control", "km1_nc_out", "km2_coil_in", [{x:935,y:500},{x:975,y:500}], "brake"),
    wire("c17", "control", "km2_coil_out", "brake_ret", [{x:1035,y:500},{x:1085,y:500}], "brake"),
    wire("c18", "control", "brake_ret", "ctrl_r", [{x:1085,y:500},{x:1085,y:140}], "control_return")
  ]);

  const components = Object.freeze([
    component("qf", "qf", "breaker", "three_pole", "QF", "main", {x:130,y:135,width:260,height:96}),
    component("km1_main", "km1", "contactor", "main_contact", "KM1", "main", {x:120,y:315,width:175,height:100}),
    component("km2_main", "km2", "contactor", "main_contact", "KM2", "main", {x:305,y:315,width:175,height:100}),
    component("fr_main", "fr", "thermal_relay", "thermal_element", "FR", "main", {x:165,y:455,width:190,height:80}),
    component("motor", "motor", "motor", "three_phase", "M", "main", {x:195,y:570,width:130,height:125}),
    component("ks_device", "ks", "speed_relay", "mechanical", "KS", "main", {x:390,y:600,width:90,height:70}),
    component("fr_nc", "fr", "thermal_relay", "protection_nc", "FR 热继电器", "control", {x:900,y:120,width:90,height:40}),
    component("sb2_nc", "sb2", "push_button", "nc", "SB2 制动/停止", "control", {x:620,y:265,width:80,height:40}),
    component("sb1_no", "sb1", "push_button", "no", "SB1 启动按钮", "control", {x:745,y:265,width:80,height:40}),
    component("km1_hold", "km1", "contactor", "aux_no", "KM1 自保持触点", "control", {x:745,y:345,width:80,height:40}),
    component("km2_nc", "km2", "contactor", "aux_nc", "KM2 互锁触点", "control", {x:875,y:265,width:80,height:40}),
    component("km1_coil", "km1", "contactor", "coil", "KM1 线圈", "control", {x:975,y:255,width:80,height:65}),
    component("sb2_no", "sb2", "push_button", "no", "SB2 制动触点", "control", {x:620,y:480,width:80,height:40}),
    component("ks_contact", "ks", "speed_relay", "speed_contact", "KS 速度触点", "control", {x:750,y:480,width:80,height:40}),
    component("km1_nc", "km1", "contactor", "aux_nc", "KM1 常闭触点", "control", {x:865,y:480,width:80,height:40}),
    component("km2_coil", "km2", "contactor", "coil", "KM2 线圈", "control", {x:965,y:470,width:80,height:65})
  ]);

  const deviceEdges = Object.freeze([
    edge("qf_a", "qf", "qf_a_in", "qf_a_out", "QF", "main", "contact"),
    edge("qf_b", "qf", "qf_b_in", "qf_b_out", "QF", "main", "contact"),
    edge("qf_c", "qf", "qf_c_in", "qf_c_out", "QF", "main", "contact"),
    edge("km1_a", "km1", "km1_a_in", "km1_a_out", "NO", "main", "contact"),
    edge("km1_b", "km1", "km1_b_in", "km1_b_out", "NO", "main", "contact"),
    edge("km1_c", "km1", "km1_c_in", "km1_c_out", "NO", "main", "contact"),
    edge("km2_a", "km2", "km2_a_in", "km2_a_out", "NO", "main", "contact"),
    edge("km2_b", "km2", "km2_b_in", "km2_b_out", "NO", "main", "contact"),
    edge("km2_c", "km2", "km2_c_in", "km2_c_out", "NO", "main", "contact"),
    edge("fr_u", "fr", "fr_u_in", "fr_u_out", "STATIC", "main", "protection"),
    edge("fr_v", "fr", "fr_v_in", "fr_v_out", "STATIC", "main", "protection"),
    edge("fr_w", "fr", "fr_w_in", "fr_w_out", "STATIC", "main", "protection"),
    edge("fr_nc", "fr", "fr_nc_in", "fr_nc_out", "FR_NC", "control", "protection"),
    edge("sb2_nc", "sb2", "sb2_nc_in", "sb2_nc_out", "SB2_NC", "control", "contact"),
    edge("sb1_no", "sb1", "start_split", "sb1_out", "SB1_NO", "control", "contact"),
    edge("km1_hold", "km1", "hold_in", "hold_out", "KM1_NO", "control", "contact"),
    edge("km2_nc", "km2", "km2_nc_in", "km2_nc_out", "KM2_NC", "control", "contact"),
    edge("km1_coil", "km1", "km1_coil_in", "km1_coil_out", "KM1_COIL", "control", "coil"),
    edge("sb2_no", "sb2", "sb2_no_in", "sb2_no_out", "SB2_NO", "control", "contact"),
    edge("ks_speed", "ks", "ks_in", "ks_out", "KS_SPEED", "control", "contact"),
    edge("km1_nc", "km1", "km1_nc_in", "km1_nc_out", "KM1_NC", "control", "contact"),
    edge("km2_coil", "km2", "km2_coil_in", "km2_coil_out", "KM2_COIL", "control", "coil")
  ]);

  const circuitData = Object.freeze({
    schemaVersion: "1.0", moduleId: MODULE_ID, mode: "reverse_braking", geometryLockId: GEOMETRY_LOCK_ID,
    referencePages: Object.freeze([]), ports, junctions: Object.freeze([]), wires, components, deviceEdges,
    labels: Object.freeze({ title: "反接制动控制", start: "SB1 启动", brake: "SB2 制动/停止" })
  });
  platform.chapterCircuitData.ch01ReverseBraking = circuitData;

  function appendGraphItem(adjacency, fromPort, toPort, item) {
    if (!adjacency.has(fromPort)) adjacency.set(fromPort, []);
    if (!adjacency.has(toPort)) adjacency.set(toPort, []);
    adjacency.get(fromPort).push({ to: toPort, item });
    adjacency.get(toPort).push({ to: fromPort, item });
  }
  function findPathItems(adjacency, startPort, endPort) {
    const queue = [startPort];
    const visited = new Set(queue);
    const previous = new Map();
    while (queue.length) {
      const current = queue.shift();
      if (current === endPort) break;
      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor.to)) continue;
        visited.add(neighbor.to);
        previous.set(neighbor.to, { port: current, item: neighbor.item });
        queue.push(neighbor.to);
      }
    }
    if (!visited.has(endPort)) return [];
    const path = [];
    let cursor = endPort;
    while (previous.has(cursor)) {
      const step = previous.get(cursor);
      path.unshift(step.item);
      cursor = step.port;
    }
    return path;
  }
  function collectPathMembership(paths) {
    const wireIds = new Set();
    const edgeIds = new Set();
    paths.flat().forEach((item) => {
      if (item.type === "wire") wireIds.add(item.wireId);
      if (item.type === "edge") edgeIds.add(item.edgeId);
    });
    return { wireIds, edgeIds };
  }

  function createReverseBrakingFacade() {
    const contracts = platform.contracts;
    if (!contracts) throw new Error(`${MODULE_ID} requires ECTPPlatform.contracts`);

    let context = null;
    let state = null;
    let solverResult = null;
    let feedback = null;
    let replaySteps = [];
    let replayIndex = -1;
    let replayTimer = null;
    let brakeTimer = null;
    let playbackSpeed = 1;
    let bound = false;

    function createOperationState() {
      return { qf: "open", sb1: "released", sb2: "released", fr: "normal" };
    }
    function createStableState() {
      return { km1: false, km2: false, rpm: 0 };
    }
    function edgeConductive(edgeDef, operation, assumed, rpm) {
      switch (edgeDef.behavior) {
        case "STATIC": return true;
        case "QF": return operation.qf === "closed";
        case "FR_NC": return operation.fr === "normal";
        case "SB2_NC": return operation.sb2 !== "pressed";
        case "SB2_NO": return operation.sb2 === "pressed";
        case "SB1_NO": return operation.sb1 === "pressed";
        case "KM1_NO": return Boolean(assumed.km1);
        case "KM1_NC": return !assumed.km1;
        case "KM2_NC": return !assumed.km2;
        case "KS_SPEED": return rpm > 100;
        case "KM1_COIL": return true;
        case "KM2_COIL": return true;
        case "NO": return edgeDef.deviceId.endsWith("__km1") ? Boolean(assumed.km1) : Boolean(assumed.km2);
        default: return false;
      }
    }
    function buildGraph(domain, operation, assumed, rpm, options = {}) {
      const adjacency = new Map();
      circuitData.wires.filter((item) => item.circuitDomain === domain).forEach((item) => {
        appendGraphItem(adjacency, item.fromPort, item.toPort, { type: "wire", wireId: item.wireId });
      });
      circuitData.deviceEdges
        .filter((item) => item.circuitDomain === domain)
        .filter((item) => options.includeCoils !== false || (item.behavior !== "KM1_COIL" && item.behavior !== "KM2_COIL"))
        .filter((item) => edgeConductive(item, operation, assumed, rpm))
        .forEach((item) => {
          appendGraphItem(adjacency, item.fromPort, item.toPort, { type: "edge", edgeId: item.edgeId });
        });
      return adjacency;
    }
    function solveControl(operation, previousStable, rpm) {
      let assumed = { km1: Boolean(previousStable.km1), km2: Boolean(previousStable.km2) };
      let converged = false;
      let iterationCount = 0;

      const coilContinuity = (graph, coilLocalId) => {
        const input = ns("port", `${coilLocalId}_coil_in`);
        const output = ns("port", `${coilLocalId}_coil_out`);
        const sourcePath = operation.qf === "closed" ? findPathItems(graph, ns("port", "ctrl_l"), input) : [];
        const returnPath = operation.qf === "closed" ? findPathItems(graph, output, ns("port", "ctrl_r")) : [];
        return { conductive: sourcePath.length > 0 && returnPath.length > 0, sourcePath, returnPath };
      };

      for (; iterationCount < 8; iterationCount += 1) {
        const graph = buildGraph("control", operation, assumed, rpm, { includeCoils: false });
        const run = coilContinuity(graph, "km1");
        const brake = coilContinuity(graph, "km2");
        let next = { km1: run.conductive, km2: brake.conductive };

        if (next.km1 && next.km2) {
          next = operation.sb2 === "pressed" ? { km1: false, km2: true } : { km1: true, km2: false };
        }
        if (next.km1 === assumed.km1 && next.km2 === assumed.km2) {
          assumed = next;
          converged = true;
          iterationCount += 1;
          break;
        }
        assumed = next;
      }

      const finalGraph = buildGraph("control", operation, assumed, rpm, { includeCoils: false });
      const finalRun = coilContinuity(finalGraph, "km1");
      const finalBrake = coilContinuity(finalGraph, "km2");
      const activePaths = [];
      const activeEdges = new Set();

      if (assumed.km1 && finalRun.conductive) {
        activePaths.push(finalRun.sourcePath, finalRun.returnPath);
        activeEdges.add(ns("edge", "km1_coil"));
      }
      if (assumed.km2 && finalBrake.conductive) {
        activePaths.push(finalBrake.sourcePath, finalBrake.returnPath);
        activeEdges.add(ns("edge", "km2_coil"));
      }
      if (operation.qf === "closed") {
        const supplyPath = findPathItems(finalGraph, ns("port", "ctrl_l"), ns("port", "fr_nc_out"));
        if (supplyPath.length) activePaths.push(supplyPath);
      }

      const membership = collectPathMembership(activePaths);
      activeEdges.forEach((id) => membership.edgeIds.add(id));
      return {
        km1: assumed.km1,
        km2: assumed.km2,
        converged,
        iterationCount,
        wireIds: membership.wireIds,
        edgeIds: membership.edgeIds
      };
    }
    function solveMain(operation, stable) {
      const graph = buildGraph("main", operation, stable, stable.rpm);
      const forwardPairs = [["src_a","motor_u"],["src_b","motor_v"],["src_c","motor_w"]];
      const brakePairs = [["src_a","motor_w"],["src_b","motor_v"],["src_c","motor_u"]];
      const pairs = stable.km2 ? brakePairs : forwardPairs;
      const paths = pairs.map(([from, to]) => findPathItems(graph, ns("port", from), ns("port", to)));
      const powered = paths.every((path) => path.length > 0);
      const membership = powered ? collectPathMembership(paths) : { wireIds: new Set(), edgeIds: new Set() };
      return { powered, direction: powered ? (stable.km2 ? "reverse" : "forward") : "none", wireIds: membership.wireIds, edgeIds: membership.edgeIds };
    }
    function evaluate(operation, previousStable, rpm, message) {
      const workingRpm = Math.max(0, Number(rpm) || 0);
      const control = solveControl(operation, previousStable, workingRpm);
      const stable = { km1: control.km1, km2: control.km2, rpm: workingRpm };
      if (operation.qf !== "closed" || operation.fr !== "normal") {
        stable.km1 = false; stable.km2 = false;
      }
      const main = solveMain(operation, stable);
      const result = contracts.createEmptySolverResult(MODULE_ID);
      const edgeStates = {};
      circuitData.deviceEdges.forEach((edgeDef) => {
        edgeStates[edgeDef.edgeId] = {
          conductive: edgeConductive(edgeDef, operation, stable, workingRpm),
          deviceState: edgeDef.deviceId.endsWith("__km1") ? (stable.km1 ? "energized" : "deenergized")
            : edgeDef.deviceId.endsWith("__km2") ? (stable.km2 ? "energized" : "deenergized") : undefined
        };
      });
      result.stableDeviceStates = { KM1: stable.km1, KM2: stable.km2, KS: workingRpm > 100 };
      result.edgeStates = edgeStates;
      result.activeMainWireIds = [...main.wireIds];
      result.activeControlWireIds = [...control.wireIds];
      result.partialWireIds = operation.qf === "closed" && !stable.km1 && !stable.km2
        ? [ns("wire", "c01"), ns("wire", "c02"), ns("wire", "c12")]
        : [];
      result.motorStates = {
        M: {
          running: workingRpm > 0,
          direction: main.direction,
          rpm: workingRpm,
          powered: main.powered,
          mode: stable.km2 ? "braking" : stable.km1 ? "running" : "stopped"
        }
      };
      result.protectionStates = { FR: { state: operation.fr, tripped: operation.fr === "overload" } };
      result.converged = control.converged;
      result.iterationCount = control.iterationCount;
      result.lastAction = { message: message || "solve" };
      result.extension = {
        braking: stable.km2 && workingRpm > 0,
        speedRelayConductive: workingRpm > 100,
        activeControlEdgeIds: [...control.edgeIds],
        activeMainEdgeIds: [...main.edgeIds],
        geometryLockId: GEOMETRY_LOCK_ID
      };
      return { stable, result };
    }
    function solveNow(message) {
      const evaluated = evaluate(state.operation, state.stable, state.stable.rpm, message);
      state.stable.km1 = evaluated.stable.km1;
      state.stable.km2 = evaluated.stable.km2;
      solverResult = evaluated.result;
      return solverResult;
    }
    function setFeedback(title, text, tone = "info", actionId = "idle") {
      feedback = { title, text, tone, actionId };
      context?.services?.setActionFeedback?.({ label: title, feedbackText: text, tone, actionId });
    }
    function snapshot(label = "snapshot") {
      return {
        label,
        operation: clone(state.operation),
        stable: clone(state.stable),
        solver: clone(solverResult)
      };
    }
    function replayStep(title, text, display, tone = "standard") {
      return Object.freeze({ title, text, tone, display: clone(display) });
    }
    function pauseReplay() {
      if (replayTimer !== null) {
        if (context?.scope?.clearInterval) context.scope.clearInterval(replayTimer); else global.clearInterval(replayTimer);
      }
      replayTimer = null;
    }
    function setReplay(steps) {
      pauseReplay();
      replaySteps = steps;
      replayIndex = -1;
    }
    function currentDisplay() {
      return replayIndex >= 0 && replaySteps[replayIndex]?.display ? replaySteps[replayIndex].display : snapshot("current");
    }
    function clearBrakeTimer() {
      if (brakeTimer !== null) {
        if (context?.scope?.clearInterval) context.scope.clearInterval(brakeTimer); else global.clearInterval(brakeTimer);
      }
      brakeTimer = null;
    }
    function requestShellRender() {
      render();
      context?.services?.renderShell?.();
      context?.services?.onFacadeOutput?.({ operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: buildTeachingFeedback() });
    }
    function startBrakeDecay() {
      clearBrakeTimer();
      const tick = () => {
        if (state.operation.sb2 !== "pressed" || !state.stable.km2) { clearBrakeTimer(); return; }
        state.stable.rpm = Math.max(0, state.stable.rpm - 235);
        solveNow("reverse braking speed decay");
        if (state.stable.rpm <= 100 || !state.stable.km2) {
          state.stable.rpm = 0;
          solveNow("KS zero-speed cutout");
          state.operation.sb2 = "released";
          solveNow("SB2 teaching-hold release");
          clearBrakeTimer();
          setFeedback("KS 零速切除", "转速降到接近零后，KS 速度触点断开，KM2 线圈失电，反接制动自动结束。", "success", "ks");
          setReplay([
            replayStep("转速接近零", "KS 达到切除阈值。", snapshot("near zero"), "key"),
            replayStep("KM2 释放", "KS 速度触点断开，制动接触器失电。", snapshot("km2 released"), "key"),
            replayStep("制动完成", "电动机停止，系统恢复待启动状态。", snapshot("stopped"), "final")
          ]);
        }
        requestShellRender();
      };
      brakeTimer = context?.scope?.interval ? context.scope.interval(tick, 180) : global.setInterval(tick, 180);
    }
    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      const type = action.type;

      if (type === "POWER_CLOSE") {
        state.operation.qf = "closed";
        solveNow("QF close");
        setFeedback("QF 动作反馈", "QF 已合闸，主回路与控制回路具备供电条件。", "success", "qf");
        setReplay([
          replayStep("QF 合闸", "三极断路器同步闭合。", snapshot("power closed"), "key"),
          replayStep("系统待命", "等待按下 SB1 启动。", snapshot("ready"), "final")
        ]);
      } else if (type === "POWER_OPEN") {
        clearBrakeTimer();
        state.operation = { ...state.operation, qf: "open", sb1: "released", sb2: "released" };
        state.stable.rpm = 0;
        solveNow("QF open");
        setFeedback("QF 动作反馈", "QF 已分闸，KM1、KM2 均失电，电动机停止。", "info", "qf");
        setReplay([replayStep("QF 分闸", "主回路与控制回路失去供电。", snapshot("power open"), "final")]);
      } else if (type === "START_PRIMARY_PRESS") {
        if (state.stable.rpm > 0 || state.stable.km2) {
          setFeedback("SB1 启动反馈", "电动机尚未完全停稳，当前不接受再次启动。", "warning", "sb1");
          setReplay([replayStep("启动被阻止", "需等待反接制动结束后再启动。", snapshot("blocked"), "blocked")]);
        } else {
          state.operation.sb1 = "pressed";
          solveNow("SB1 press");
          const pressed = snapshot("SB1 pressed");
          state.operation.sb1 = "released";
          solveNow("SB1 release");
          if (state.stable.km1) state.stable.rpm = 1450;
          solveNow("motor reaches teaching speed");
          const final = snapshot("running");
          if (state.stable.km1) {
            setFeedback("SB1 启动反馈", "SB1 瞬时动作后，KM1 线圈得电并由辅助常开触点自锁，电动机正常运行。", "success", "sb1");
            setReplay([
              replayStep("按下 SB1", "SB1 常开触点闭合。", pressed, "key"),
              replayStep("KM1 得电", "KM1 主触点闭合，辅助常开触点建立自锁。", pressed, "key"),
              replayStep("SB1 松开", "电流改经 KM1 自保持触点。", final, "key"),
              replayStep("电动机运行", "M 按正常相序运行，KS 检测到转速。", final, "final")
            ]);
          } else {
            const reason = state.operation.fr === "overload" ? "FR 已过载，保护常闭触点断开。" : "QF 尚未合闸。";
            setFeedback("SB1 启动反馈", reason, "warning", "sb1");
            setReplay([replayStep("启动条件不满足", reason, final, "blocked")]);
          }
        }
      } else if (type === "STOP_PRIMARY_PRESS") {
        if (state.stable.rpm <= 0) {
          setFeedback("SB2 制动反馈", "电动机当前已停止，无需投入反接制动。", "info", "sb2");
          setReplay([replayStep("无需制动", "当前转速为 0 rpm。", snapshot("already stopped"), "final")]);
        } else if (state.operation.qf !== "closed" || state.operation.fr !== "normal") {
          setFeedback("SB2 制动反馈", "当前供电或保护条件不满足，KM2 不会投入。", "warning", "sb2");
          setReplay([replayStep("制动条件不满足", "检查 QF 与 FR 状态。", snapshot("brake blocked"), "blocked")]);
        } else {
          state.operation.sb2 = "pressed";
          solveNow("SB2 brake press");
          const brake = snapshot("braking");
          if (state.stable.km2) {
            setFeedback("SB2 制动反馈", "SB2 切断 KM1 自锁并投入 KM2；KM1/KM2 电气互锁保证两接触器不会同时得电。教学层保持 SB2 动作，直到 KS 近零速切除。", "warning", "sb2");
            setReplay([
              replayStep("按下 SB2", "SB2 常闭触点断开，KM1 自锁回路被切断。", brake, "key"),
              replayStep("KM1 释放", "KM1 主触点断开，KM1 常闭互锁触点恢复。", brake, "key"),
              replayStep("KM2 得电", "SB2 制动触点、KS 速度触点和 KM1 常闭触点构成 KM2 回路。", brake, "key"),
              replayStep("反接制动", "KM2 主触点换相，形成与原转向相反的电磁转矩。", brake, "final")
            ]);
            startBrakeDecay();
          } else {
            state.operation.sb2 = "released";
            solveNow("SB2 release after blocked brake");
            setFeedback("SB2 制动反馈", "KS 未检测到有效转速或互锁条件不满足，KM2 未投入。", "info", "sb2");
          }
        }
      } else if (type === "PROTECTION_TOGGLE") {
        clearBrakeTimer();
        state.operation.fr = "overload";
        state.operation.sb1 = "released";
        state.operation.sb2 = "released";
        state.stable.rpm = 0;
        solveNow("FR overload");
        setFeedback("FR 过载反馈", "FR 过载动作，控制常闭触点断开，KM1/KM2 失电，电动机停止。", "warning", "fr_trip");
        setReplay([
          replayStep("FR 过载", "热继电器进入过载状态。", snapshot("overload"), "blocked"),
          replayStep("控制回路切断", "FR 常闭保护触点断开。", snapshot("control open"), "blocked"),
          replayStep("电动机停止", "接触器释放，主回路断开。", snapshot("stopped"), "final")
        ]);
      } else if (type === "PROTECTION_RESET") {
        state.operation.fr = "normal";
        solveNow("FR reset");
        setFeedback("FR 复位反馈", "FR 已恢复正常，但系统不会自动启动，需重新按下 SB1。", "info", "fr_reset");
        setReplay([
          replayStep("FR 复位", "保护常闭触点恢复闭合。", snapshot("FR normal"), "key"),
          replayStep("保持停机", "复位不等于启动。", snapshot("waiting"), "final")
        ]);
      } else if (type === "RESET_MODULE") {
        reset();
        return buildDispatchResult(action);
      } else {
        throw new Error(`${MODULE_ID} does not support ${type}`);
      }

      requestShellRender();
      return buildDispatchResult(action);
    }
    function buildDispatchResult(action) {
      return {
        action,
        state: getStateSnapshot(),
        solverResult: normalizeSolverResult(),
        operationViewModel: getOperationViewModel(),
        statusViewModel: getStatusViewModel(),
        feedback: buildTeachingFeedback()
      };
    }
    function getStateSnapshot() {
      const motorMode = state.stable.km2 && state.stable.rpm > 0 ? "braking" : state.stable.km1 && state.stable.rpm > 0 ? "running" : "stopped";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: state.operation.qf,
          controls: { start: state.operation.sb1, brake: state.operation.sb2 },
          protections: { overload: state.operation.fr }
        },
        devices: {
          primaryContactor: { id: "KM1", energized: state.stable.km1 },
          brakingContactor: { id: "KM2", energized: state.stable.km2 },
          speedRelay: { id: "KS", active: state.stable.rpm > 100, conductive: state.stable.rpm > 100 }
        },
        motor: {
          id: "M", state: motorMode, running: state.stable.rpm > 0,
          direction: solverResult.motorStates.M.direction, rpm: state.stable.rpm
        }
      };
    }
    function normalizeSolverResult() { return clone(solverResult); }
    function getOperationViewModel() {
      const current = getStateSnapshot();
      const powerClosed = current.operation.power === "closed";
      const overloaded = current.operation.protections.overload === "overload";
      const braking = current.motor.state === "braking";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: { deviceId: "QF", closed: powerClosed, closeLabel: "QF 合闸", openLabel: "QF 分闸", closeEnabled: !powerClosed, openEnabled: powerClosed },
        controls: [
          { slot: "primary", visible: true, label: "SB1 启动", stateText: current.motor.state === "running" ? "已运行" : braking ? "制动中" : "待命", buttonClass: "forward", action: "START_PRIMARY_PRESS", disabled: braking },
          { slot: "secondary", visible: true, label: "SB2 制动", stateText: braking ? "制动中" : current.motor.running ? "可制动" : "已停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS", disabled: braking },
          { slot: "tertiary", visible: false },
          { slot: "quaternary", visible: false },
          { slot: "module-reset", visible: true, label: "模块复位", stateText: "恢复初始状态", buttonClass: "", action: "RESET_MODULE" }
        ],
        protection: { slot: "primary", visible: true, label: "FR 过载", resetLabel: "FR 复位", tripped: overloaded, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" },
        actionStates: [
          { id: "qf", label: "QF", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: powerClosed ? "QF 当前已合闸。" : "QF 当前处于分闸状态。" },
          { id: "sb1", label: "SB1 启动", currentState: current.motor.state, availableTransitions: ["start"], onAction: "START_PRIMARY_PRESS", feedbackText: "KM1 得电并通过辅助常开触点自锁。" },
          { id: "sb2", label: "SB2 制动", currentState: current.motor.state, availableTransitions: ["brake"], onAction: "STOP_PRIMARY_PRESS", feedbackText: "切断 KM1 并投入 KM2 反接制动。" },
          { id: "fr_trip", label: "FR 过载", currentState: overloaded ? "overload" : "normal", availableTransitions: ["trip"], onAction: "PROTECTION_TOGGLE", feedbackText: "FR 过载会切断控制回路。" },
          { id: "fr_reset", label: "FR 复位", currentState: overloaded ? "overload" : "normal", availableTransitions: ["reset"], onAction: "PROTECTION_RESET", feedbackText: "复位后不会自动重启。" }
        ]
      };
    }
    function getStatusViewModel() {
      const current = getStateSnapshot();
      const motorText = current.motor.state === "running" ? "运行" : current.motor.state === "braking" ? "制动" : "停止";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "qf", label: "QF", value: current.operation.power === "closed" ? "已合闸" : "断开", tone: current.operation.power === "closed" ? "on" : "off" },
          { id: "motor", label: "M（电机）", value: motorText, tone: current.motor.state === "running" ? "forward" : current.motor.state === "braking" ? "error" : "off" },
          { id: "km1", label: "KM1", value: current.devices.primaryContactor.energized ? "得电" : "失电", tone: current.devices.primaryContactor.energized ? "forward" : "off" },
          { id: "ks", label: "KS（速度继电器）", value: current.devices.speedRelay.active ? "动作" : "待机", tone: current.devices.speedRelay.active ? "on" : "off" },
          { id: "km2", label: "KM2", value: current.devices.brakingContactor.energized ? "得电" : "失电", tone: current.devices.brakingContactor.energized ? "error" : "off" },
          { id: "rpm", label: "转速", value: `${current.motor.rpm} rpm`, tone: current.motor.rpm > 0 ? (current.motor.state === "braking" ? "error" : "forward") : "off" }
        ]
      };
    }
    function buildTeachingFeedback() { return clone(feedback); }
    function buildReplaySteps() { return clone(replaySteps); }

    function pathData(points) { return points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "); }
    function terminal(x, y) { return `<circle cx="${x}" cy="${y}" r="4.5" class="rb-terminal"/>`; }
    function contactH(x1, x2, y, closed, label, action) {
      return `<g ${action ? `data-action="${action}" class="rb-clickable"` : ""}><circle cx="${x1}" cy="${y}" r="4" class="rb-contact-dot"/><circle cx="${x2}" cy="${y}" r="4" class="rb-contact-dot"/><line x1="${x1 + 4}" y1="${y}" x2="${closed ? x2 - 4 : x2 - 13}" y2="${closed ? y : y - 16}" class="rb-contact-arm"/><text x="${(x1+x2)/2}" y="${y-23}" text-anchor="middle" class="rb-small-label">${label}</text></g>`;
    }
    function threePoleContacts(xs, top, bottom, closed, label, action) {
      return `<g ${action ? `data-action="${action}" class="rb-clickable"` : ""}>${xs.map((x, index) => `<g>${terminal(x,top)}${terminal(x,bottom)}<line x1="${x}" y1="${top+6}" x2="${closed ? x : x+18}" y2="${bottom-6}" class="rb-contact-arm"/>${index===0?`<text x="${x-34}" y="${(top+bottom)/2+5}" class="rb-device-label">${label}</text>`:""}</g>`).join("")}<rect x="${xs[0]-26}" y="${top-18}" width="${xs[xs.length-1]-xs[0]+70}" height="${bottom-top+36}" fill="transparent"/></g>`;
    }
    function coil(x, y, label, active, brake) {
      return `<g class="rb-coil ${active ? "is-active" : ""} ${brake ? "is-brake" : ""}"><rect x="${x}" y="${y}" width="70" height="58" rx="9"/><path d="M${x+10} ${y+39} q8 -31 16 0 t16 0 t16 0"/><text x="${x+35}" y="${y-13}" text-anchor="middle" class="rb-device-label">${label}</text></g>`;
    }
    function wireMarkup(display) {
      const activeMain = new Set(display.solver?.activeMainWireIds || []);
      const activeControl = new Set(display.solver?.activeControlWireIds || []);
      const partial = new Set(display.solver?.partialWireIds || []);
      return circuitData.wires.map((item) => {
        const isActive = activeMain.has(item.wireId) || activeControl.has(item.wireId);
        const isBrake = item.group === "brake" && isActive;
        const cls = `rb-wire ${isActive ? "is-active" : ""} ${isBrake ? "is-brake" : ""} ${partial.has(item.wireId) ? "is-partial" : ""}`;
        return `<path d="${pathData(item.routePoints)}" class="${cls}" data-wire-id="${item.wireId}"/>`;
      }).join("");
    }
    function renderSvg(display) {
      const operation = display.operation;
      const stable = display.stable;
      const qf = operation.qf === "closed";
      const km1 = Boolean(stable.km1);
      const km2 = Boolean(stable.km2);
      const ks = stable.rpm > 100;
      const overload = operation.fr === "overload";
      const braking = km2 && stable.rpm > 0;
      const motorClass = stable.rpm > 0 ? (braking ? "is-braking" : "is-running") : "";
      return `<div class="rb-module" data-module="${MODULE_ID}">
        <style>
          [data-module="${MODULE_ID}"]{width:100%;height:100%;min-height:540px;background:#fff;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#172033;overflow:hidden}
          [data-module="${MODULE_ID}"] svg{width:100%;height:100%;display:block;background:#fff}
          [data-module="${MODULE_ID}"] .rb-divider{stroke:#e7edf5;stroke-width:2}
          [data-module="${MODULE_ID}"] .rb-title{fill:#1268f3;font-size:22px;font-weight:800}
          [data-module="${MODULE_ID}"] .rb-label{fill:#172033;font-size:18px;font-weight:700}
          [data-module="${MODULE_ID}"] .rb-device-label{fill:#172033;font-size:15px;font-weight:700}
          [data-module="${MODULE_ID}"] .rb-small-label{fill:#172033;font-size:14px;font-weight:650}
          [data-module="${MODULE_ID}"] .rb-wire{fill:none;stroke:#71839b;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:stroke .16s,stroke-width .16s,opacity .16s}
          [data-module="${MODULE_ID}"] .rb-wire.is-active{stroke:#1685ff;stroke-width:4.4}
          [data-module="${MODULE_ID}"] .rb-wire.is-active.is-brake{stroke:#f29420}
          [data-module="${MODULE_ID}"] .rb-wire.is-partial{stroke:#76a7dd;stroke-dasharray:6 7}
          [data-module="${MODULE_ID}"] .rb-terminal,[data-module="${MODULE_ID}"] .rb-contact-dot{fill:#fff;stroke:#58708f;stroke-width:2.2}
          [data-module="${MODULE_ID}"] .rb-contact-arm{stroke:#ef4a2e;stroke-width:3.4;stroke-linecap:round;transition:all .15s}
          [data-module="${MODULE_ID}"] .rb-device-box{fill:#f7fbff;stroke:#8da2bc;stroke-width:2}
          [data-module="${MODULE_ID}"] .rb-device-box.is-active{stroke:#1685ff;stroke-width:3}
          [data-module="${MODULE_ID}"] .rb-device-box.is-brake{stroke:#f29420;stroke-width:3}
          [data-module="${MODULE_ID}"] .rb-coil rect{fill:#eef4fb;stroke:#8297b0;stroke-width:2.2}
          [data-module="${MODULE_ID}"] .rb-coil path{fill:none;stroke:#e87817;stroke-width:3}
          [data-module="${MODULE_ID}"] .rb-coil.is-active rect{stroke:#1685ff;stroke-width:3}
          [data-module="${MODULE_ID}"] .rb-coil.is-active.is-brake rect{stroke:#f29420}
          [data-module="${MODULE_ID}"] .rb-motor-shell{fill:#f7fbff;stroke:#60758f;stroke-width:3}
          [data-module="${MODULE_ID}"] .rb-motor-rotor{fill:none;stroke:#60758f;stroke-width:3;transform-origin:260px 646px}
          [data-module="${MODULE_ID}"] .rb-motor.is-running .rb-motor-rotor{stroke:#1685ff;animation:rbSpin 1s linear infinite}
          [data-module="${MODULE_ID}"] .rb-motor.is-braking .rb-motor-rotor{stroke:#f29420;animation:rbSpin .42s linear infinite reverse}
          [data-module="${MODULE_ID}"] .rb-clickable{cursor:pointer}
          [data-module="${MODULE_ID}"] .rb-clickable:hover{filter:drop-shadow(0 0 5px rgba(22,133,255,.25))}
          [data-module="${MODULE_ID}"] .rb-dash{stroke:#6c7f98;stroke-width:2;stroke-dasharray:10 9}
          [data-module="${MODULE_ID}"] .rb-status{fill:#607087;font-size:14px;font-weight:600}
          [data-module="${MODULE_ID}"] .rb-fr-trip{stroke:#e34a35!important;fill:#fff4f1!important}
          @keyframes rbSpin{to{transform:rotate(360deg)}}
          @media (prefers-reduced-motion:reduce){[data-module="${MODULE_ID}"] .rb-motor-rotor{animation:none!important}}
        </style>
        <svg viewBox="0 0 1120 720" role="img" aria-label="反接制动控制电路">
          <line x1="525" y1="18" x2="525" y2="700" class="rb-divider"/>
          <text x="28" y="40" class="rb-title">主电路（动力回路）</text>
          <text x="555" y="40" class="rb-title">控制电路（控制回路）</text>
          <g>${wireMarkup(display)}</g>

          <text x="170" y="91" text-anchor="middle" class="rb-label">A</text><text x="260" y="91" text-anchor="middle" class="rb-label">B</text><text x="350" y="91" text-anchor="middle" class="rb-label">C</text>
          ${terminal(170,116)}${terminal(260,116)}${terminal(350,116)}
          ${threePoleContacts([170,260,350],148,218,qf,"QF",qf?"POWER_OPEN":"POWER_CLOSE")}

          <text x="105" y="350" class="rb-device-label">KM1</text><rect x="120" y="315" width="175" height="100" rx="10" class="rb-device-box ${km1?"is-active":""}"/>
          ${threePoleContacts([145,205,265],330,400,km1,"","")}
          <text x="472" y="350" text-anchor="end" class="rb-device-label">KM2</text><rect x="305" y="315" width="175" height="100" rx="10" class="rb-device-box ${km2?"is-active is-brake":""}"/>
          ${threePoleContacts([330,390,450],330,400,km2,"","")}

          <text x="125" y="500" class="rb-device-label">FR</text>
          <rect x="165" y="455" width="190" height="80" rx="10" class="rb-device-box ${overload?"rb-fr-trip":""}" data-action="PROTECTION_TOGGLE"/>
          <rect x="180" y="470" width="20" height="55" rx="5" class="rb-device-box"/><rect x="250" y="470" width="20" height="55" rx="5" class="rb-device-box"/><rect x="320" y="470" width="20" height="55" rx="5" class="rb-device-box"/>

          <g class="rb-motor ${motorClass}"><circle cx="260" cy="646" r="58" class="rb-motor-shell"/><circle cx="260" cy="646" r="29" class="rb-motor-rotor"/><line x1="239" y1="646" x2="281" y2="646" class="rb-motor-rotor"/><line x1="260" y1="625" x2="260" y2="667" class="rb-motor-rotor"/><text x="260" y="642" text-anchor="middle" class="rb-label">M</text><text x="260" y="666" text-anchor="middle" class="rb-small-label">3~</text></g>
          <line x1="320" y1="646" x2="395" y2="646" class="rb-dash"/><rect x="398" y="620" width="54" height="52" rx="8" class="rb-device-box ${ks?"is-active":""}"/><text x="425" y="652" text-anchor="middle" class="rb-label">KS</text><text x="425" y="696" text-anchor="middle" class="rb-small-label">速度继电器</text>

          ${terminal(585,140)}${terminal(1085,140)}
          ${contactH(910,982,140,!overload,"FR 热继电器", "PROTECTION_TOGGLE")}
          ${contactH(630,690,285,operation.sb2!=="pressed","SB2 制动/停止", "STOP_PRIMARY_PRESS")}
          ${contactH(755,815,285,operation.sb1==="pressed","SB1 启动按钮", "START_PRIMARY_PRESS")}
          ${contactH(755,815,365,km1,"KM1 自保持触点", "")}
          ${contactH(885,945,285,!km2,"KM2 互锁触点", "")}
          ${coil(975,256,"KM1 线圈",km1,false)}
          ${contactH(630,690,500,operation.sb2==="pressed","SB2 制动触点", "STOP_PRIMARY_PRESS")}
          ${contactH(760,820,500,ks,"KS 速度触点", "")}
          ${contactH(875,935,500,!km1,"KM1 常闭触点", "")}
          ${coil(965,471,"KM2 线圈",km2,true)}

          <text x="555" y="675" class="rb-status">当前：QF ${qf?"合闸":"断开"} · KM1 ${km1?"得电":"失电"} · KM2 ${km2?"得电":"失电"} · KS ${ks?"动作":"待机"} · ${stable.rpm} rpm</text>
        </svg>
      </div>`;
    }
    function renderPlaybackDom() {
      if (!context || !global.document) return;
      const stepText = global.document.getElementById("currentStepText");
      const toggle = global.document.getElementById("playbackToggle");
      const speed05 = global.document.getElementById("playbackSpeed05");
      const speed10 = global.document.getElementById("playbackSpeed10");
      const speed15 = global.document.getElementById("playbackSpeed15");
      if (stepText) stepText.textContent = replayIndex >= 0 && replaySteps[replayIndex]
        ? `当前步骤：${replaySteps[replayIndex].title} —— ${replaySteps[replayIndex].text}`
        : "当前步骤：等待操作，点击“QF 合闸”开始实验。";
      if (toggle) toggle.textContent = replayTimer !== null ? "❚❚" : "▶";
      [speed05,speed10,speed15].forEach((button) => button?.classList.remove("active"));
      (playbackSpeed===0.5?speed05:playbackSpeed===1.5?speed15:speed10)?.classList.add("active");
    }
    function render() {
      if (!context?.mountRoot) return;
      context.mountRoot.innerHTML = renderSvg(currentDisplay());
      renderPlaybackDom();
    }
    function stepReplay(delta) {
      if (!replaySteps.length) return;
      replayIndex = Math.max(0, Math.min(replaySteps.length - 1, replayIndex + delta));
      if (replayIndex === replaySteps.length - 1) pauseReplay();
      render();
    }
    function toggleReplay() {
      if (!replaySteps.length) return;
      if (replayTimer !== null) { pauseReplay(); renderPlaybackDom(); return; }
      if (replayIndex < 0 || replayIndex >= replaySteps.length - 1) replayIndex = 0;
      const tick = () => stepReplay(1);
      replayTimer = context?.scope?.interval ? context.scope.interval(tick, 1600 / playbackSpeed) : global.setInterval(tick, 1600 / playbackSpeed);
      render();
    }
    function bindDom() {
      if (bound || !context || !global.document) return;
      bound = true;
      const signal = context.scope?.signal;
      const options = signal ? { signal } : undefined;
      context.mountRoot?.addEventListener("click", (event) => {
        const target = event.target.closest?.("[data-action]");
        if (!target) return;
        event.preventDefault();
        dispatchAction(target.dataset.action);
      }, options);
      const bindings = [
        ["showPrinciplePlayback", () => { replayIndex = replaySteps.length ? 0 : -1; render(); }],
        ["playbackPrev", () => stepReplay(-1)], ["playbackNext", () => stepReplay(1)], ["playbackToggle", toggleReplay],
        ["playbackSpeed05", () => { playbackSpeed=0.5; pauseReplay(); renderPlaybackDom(); }],
        ["playbackSpeed10", () => { playbackSpeed=1; pauseReplay(); renderPlaybackDom(); }],
        ["playbackSpeed15", () => { playbackSpeed=1.5; pauseReplay(); renderPlaybackDom(); }]
      ];
      bindings.forEach(([id, handler]) => global.document.getElementById(id)?.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); handler(); }, { capture:true, ...(signal?{signal}:{}) }));
    }
    function validateGeometry() {
      const errors = [];
      const unique = (items, key, label) => {
        const seen = new Set();
        items.forEach((item) => { if (seen.has(item[key])) errors.push(`duplicate ${label}: ${item[key]}`); seen.add(item[key]); });
        return seen;
      };
      const portIds = unique(circuitData.ports, "portId", "portId");
      unique(circuitData.wires, "wireId", "wireId");
      unique(circuitData.components, "componentId", "componentId");
      unique(circuitData.deviceEdges, "edgeId", "edgeId");
      const portMap = new Map(circuitData.ports.map((item) => [item.portId, item]));
      circuitData.wires.forEach((item) => {
        if (!item.wireId.startsWith(`${MODULE_ID}__wire__`)) errors.push(`invalid wire namespace: ${item.wireId}`);
        if (!portIds.has(item.fromPort)) errors.push(`missing fromPort: ${item.fromPort}`);
        if (!portIds.has(item.toPort)) errors.push(`missing toPort: ${item.toPort}`);
        if (!Array.isArray(item.routePoints) || item.routePoints.length < 2) errors.push(`invalid routePoints: ${item.wireId}`);
        const from = portMap.get(item.fromPort); const to = portMap.get(item.toPort);
        const first = item.routePoints[0]; const last = item.routePoints[item.routePoints.length-1];
        if (from && (first.x!==from.x || first.y!==from.y)) errors.push(`route start mismatch: ${item.wireId}`);
        if (to && (last.x!==to.x || last.y!==to.y)) errors.push(`route end mismatch: ${item.wireId}`);
      });
      circuitData.deviceEdges.forEach((item) => {
        if (!portIds.has(item.fromPort)) errors.push(`missing edge fromPort: ${item.fromPort}`);
        if (!portIds.has(item.toPort)) errors.push(`missing edge toPort: ${item.toPort}`);
      });
      circuitData.components.forEach((item) => {
        if (!item.componentId.startsWith(`${MODULE_ID}__cmp__`)) errors.push(`invalid component namespace: ${item.componentId}`);
        ["x","y","width","height","orientation"].forEach((field) => { if (!Number.isFinite(item.geometry[field])) errors.push(`missing geometry.${field}: ${item.componentId}`); });
      });
      return { valid: errors.length === 0, errors, geometryLockId: GEOMETRY_LOCK_ID };
    }
    function runTests() {
      const tests = [];
      const test = (name, assertion) => tests.push({ name, passed: Boolean(assertion) });
      const base = createStableState();
      const open = evaluate(createOperationState(), base, 0, "test open");
      test("QF open keeps KM1/KM2 deenergized", !open.stable.km1 && !open.stable.km2);
      const readyOp = { qf:"closed", sb1:"pressed", sb2:"released", fr:"normal" };
      const started = evaluate(readyOp, base, 0, "test start press");
      test("SB1 press energizes KM1", started.stable.km1 && !started.stable.km2);
      const held = evaluate({ ...readyOp, sb1:"released" }, { ...started.stable, rpm:1450 }, 1450, "test hold");
      test("KM1 self-hold survives SB1 release", held.stable.km1);
      const braking = evaluate({ qf:"closed", sb1:"released", sb2:"pressed", fr:"normal" }, { ...held.stable, rpm:1450 }, 1450, "test brake");
      test("SB2 drops KM1 and energizes KM2 through interlock", !braking.stable.km1 && braking.stable.km2);
      test("KM1 and KM2 never energize together", !(braking.stable.km1 && braking.stable.km2));
      const cutoff = evaluate({ qf:"closed", sb1:"released", sb2:"pressed", fr:"normal" }, braking.stable, 80, "test KS cutoff");
      test("KS near-zero cutoff drops KM2", !cutoff.stable.km2);
      const overload = evaluate({ qf:"closed", sb1:"released", sb2:"released", fr:"overload" }, held.stable, 0, "test overload");
      test("FR overload drops both contactors", !overload.stable.km1 && !overload.stable.km2);
      const geometry = validateGeometry();
      test("geometry/topology validation passes", geometry.valid);
      return { passed: tests.every((item)=>item.passed), total: tests.length, passedCount: tests.filter((item)=>item.passed).length, tests, geometry };
    }
    function reset() {
      pauseReplay(); clearBrakeTimer();
      state = { operation: createOperationState(), stable: createStableState() };
      solverResult = evaluate(state.operation, state.stable, 0, "module reset").result;
      feedback = { title: "反接制动控制原理", text: "先合上 QF，再按 SB1 启动；电机运行后按 SB2，可观察 KM1 释放、KM2 投入以及 KS 近零速切除的反接制动过程。", tone: "info", actionId: "idle" };
      replaySteps = []; replayIndex = -1;
      render();
      return getStateSnapshot();
    }

    reset();
    return Object.freeze({
      createInitialState: reset,
      getStateSnapshot,
      dispatchAction,
      solve: (message="facade solve") => { solveNow(message); return normalizeSolverResult(); },
      normalizeSolverResult,
      getOperationViewModel,
      getStatusViewModel,
      buildTeachingFeedback,
      buildReplaySteps,
      mount: (_payload, nextContext) => { context = nextContext || context; bound = false; bindDom(); requestShellRender(); },
      render,
      reset,
      pause: () => { pauseReplay(); clearBrakeTimer(); },
      resume: () => undefined,
      unmount: () => { pauseReplay(); clearBrakeTimer(); if (context?.mountRoot) context.mountRoot.innerHTML = ""; context = null; bound = false; },
      validateGeometry,
      runTests
    });
  }

  platform.moduleFacades.createCh01ReverseBrakingFacade = createReverseBrakingFacade;
})(globalThis);
