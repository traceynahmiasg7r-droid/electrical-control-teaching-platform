(function installCh01LimitTextbookSolver(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};

  const MODULE_ID = "ch01_limit";
  const MAX_ITERATIONS = 12;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  const defaultOperation = () => ({
    power: "open",
    buttons: { sb1: "released", sb2: "released" },
    fr1: "normal",
    sq: "normal"
  });

  function createInitialState(seed = {}) {
    const base = defaultOperation();
    const supplied = seed.operationState || {};
    return {
      operationState: {
        power: supplied.power || base.power,
        buttons: { ...base.buttons, ...(supplied.buttons || {}) },
        fr1: supplied.fr1 || base.fr1,
        sq: supplied.sq || base.sq
      },
      stableDeviceStates: {
        KM: Boolean(seed.stableDeviceStates && seed.stableDeviceStates.KM)
      },
      lastAction: clone(seed.lastAction || {
        type: "reset",
        message: "Power open; SB1/SB2 released; FR1 and SQ reset"
      })
    };
  }

  function circuitData() {
    const data = platform.moduleCircuitData && platform.moduleCircuitData.ch01LimitTextbook;
    if (!data) {
      throw new Error("ch01_limit_textbook circuit.data.js must load before Solver");
    }
    return data;
  }

  function isConductive(edge, values) {
    if (edge.kind === "load" || edge.condition === "always") return true;
    const condition = String(edge.condition || "always");
    return condition.charAt(0) === "!"
      ? !Boolean(values[condition.slice(1)])
      : Boolean(values[condition]);
  }

  function makeGraph(data, values) {
    const adjacency = new Map();
    const reachabilityCache = new Map();

    function add(from, to, id, kind) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ from, to, node: to, id, kind });
    }

    const conductiveEdges = data.deviceEdges.filter((edge) => {
      // A load is the boundary whose two sides are tested separately. Adding
      // it to the graph would make every healthy coil look like a supply short.
      return edge.kind !== "load" && isConductive(edge, values);
    });

    for (const edge of [...data.wires, ...conductiveEdges]) {
      const id = edge.wireId || edge.edgeId;
      const kind = edge.wireId ? "wire" : "device";
      add(edge.from, edge.to, id, kind);
      add(edge.to, edge.from, id, kind);
    }

    function nodesReachableFrom(from) {
      if (reachabilityCache.has(from)) return reachabilityCache.get(from);
      const seen = new Set([from]);
      const queue = [from];
      for (const here of queue) {
        for (const edge of adjacency.get(here) || []) {
          if (seen.has(edge.node)) continue;
          seen.add(edge.node);
          queue.push(edge.node);
        }
      }
      reachabilityCache.set(from, seen);
      return seen;
    }

    function reachable(from, to) {
      return nodesReachableFrom(from).has(to);
    }

    function paths(from, to) {
      if (!reachable(from, to)) return [];
      const seen = new Set([from]);
      const route = [];
      const union = new Map();

      function visit(here) {
        if (here === to) {
          route.forEach((edge) => union.set(edge.id, edge));
          return;
        }
        for (const edge of adjacency.get(here) || []) {
          if (seen.has(edge.node)) continue;
          seen.add(edge.node);
          route.push(edge);
          visit(edge.node);
          route.pop();
          seen.delete(edge.node);
        }
      }

      visit(from);
      return [...union.values()];
    }

    return { reachable, paths };
  }

  function phaseSourcePort(data, tapPortId, phaseName) {
    const tap = data.ports.find((port) => port.portId === tapPortId);
    const phase = phaseName ? String(phaseName).toUpperCase() : "";
    const nodeId = phase ? "phase:" + phase : tap && tap.electricalNodeId;
    return data.supplies.phases.find((portId) => {
      const port = data.ports.find((candidate) => candidate.portId === portId);
      return Boolean(port) && (
        (nodeId && port.electricalNodeId === nodeId)
        || (phase && String(port.phase || "").toUpperCase() === phase)
      );
    }) || tapPortId;
  }

  function controlSupply(data) {
    const taps = data.supplies.control || [];
    if (taps.length !== 2) {
      throw new Error("ch01_limit requires exactly two control supply taps");
    }
    return {
      sourceTap: taps[0],
      returnTap: taps[1],
      source: phaseSourcePort(data, taps[0], data.supplies.controlPhase),
      return: phaseSourcePort(data, taps[1], data.supplies.controlReturnPhase)
    };
  }

  function loadConnection(graph, supply, load) {
    const orientations = [
      { sourceTerminal: load.from, returnTerminal: load.to },
      { sourceTerminal: load.to, returnTerminal: load.from }
    ];
    for (const orientation of orientations) {
      if (
        graph.reachable(supply.source, orientation.sourceTerminal)
        && graph.reachable(orientation.returnTerminal, supply.return)
      ) {
        return { connected: true, ...orientation };
      }
    }
    return {
      connected: false,
      sourceTerminal: load.from,
      returnTerminal: load.to
    };
  }

  function solve(inputState) {
    const data = circuitData();
    const state = createInitialState(clone(inputState));
    const operation = state.operationState;
    const power = operation.power === "closed";
    const values = {
      SB1: operation.buttons.sb1 === "pressed",
      SB2: operation.buttons.sb2 === "pressed",
      FR1: operation.fr1 === "tripped",
      SQ: operation.sq === "triggered",
      KM: Boolean(state.stableDeviceStates.KM)
    };
    const coil = data.deviceEdges.find((edge) => edge.edgeId === "km_coil");
    if (!coil || coil.kind !== "load") {
      throw new Error("ch01_limit requires a km_coil load edge");
    }

    const supply = controlSupply(data);
    const diagnostics = [];
    const transitionTrace = [];
    let graph = makeGraph(data, values);
    let converged = false;
    let iterationCount = 0;

    for (let index = 0; index < MAX_ITERATIONS; index += 1) {
      iterationCount = index + 1;
      const connection = loadConnection(graph, supply, coil);
      const supplyShort = graph.reachable(supply.source, supply.return);
      const requested = Boolean(power && connection.connected && !supplyShort);

      if (requested === values.KM) {
        converged = true;
        break;
      }

      values.KM = requested;
      transitionTrace.push({
        phase: requested ? "pickup" : "dropout",
        stableDeviceStates: { KM: requested }
      });
      graph = makeGraph(data, values);
    }

    if (!converged) {
      values.KM = false;
      graph = makeGraph(data, values);
      diagnostics.push({
        code: "NO_STABLE_SOLUTION",
        message: "The control circuit did not converge; KM was released"
      });
    }

    state.stableDeviceStates = { KM: values.KM };
    const supplyShort = power && graph.reachable(supply.source, supply.return);
    const coilConnection = loadConnection(graph, supply, coil);

    if (values.SQ) {
      diagnostics.push({
        code: "LIMIT_TRIGGERED",
        message: "SQ is triggered and its NC control contact is open"
      });
    }
    if (values.FR1) {
      diagnostics.push({
        code: "OVERLOAD_TRIPPED",
        message: "FR1 is tripped and its NC control contact is open"
      });
    }
    if (supplyShort) {
      diagnostics.push({
        code: "CONTROL_SUPPLY_SHORT",
        message: "The two control supply phases are connected without the KM coil load"
      });
    }

    const activeWires = new Set();
    const activeEdges = new Set();
    const loadPaths = {};

    function collect(loadId, segments, load) {
      const wireIds = [...new Set(
        segments.filter((edge) => edge.kind === "wire").map((edge) => edge.id)
      )];
      const edgeIds = [...new Set(
        segments.filter((edge) => edge.kind === "device").map((edge) => edge.id)
      )];
      if (load && !edgeIds.includes(load.edgeId)) edgeIds.push(load.edgeId);
      wireIds.forEach((wireId) => activeWires.add(wireId));
      edgeIds.forEach((edgeId) => activeEdges.add(edgeId));
      loadPaths[loadId] = { wireIds, edgeIds, segments };
    }

    const controlPowered = Boolean(
      power && values.KM && coilConnection.connected && !supplyShort
    );
    if (controlPowered) {
      collect("km_coil", [
        ...graph.paths(supply.source, coilConnection.sourceTerminal),
        ...graph.paths(coilConnection.returnTerminal, supply.return)
      ], coil);
    }

    const motor = data.components.find((component) => component.type === "motor");
    if (!motor || !motor.geometry || !Array.isArray(motor.geometry.phasePorts)) {
      throw new Error("ch01_limit requires a motor with three phasePorts");
    }

    const phaseNames = ["A", "B", "C"];
    const terminalPhases = motor.geometry.phasePorts.map((terminal) => {
      if (!power || !values.KM) return [];
      return data.supplies.phases
        .map((source, index) => graph.reachable(source, terminal) ? index : -1)
        .filter((index) => index >= 0);
    });
    const running = Boolean(
      power
      && values.KM
      && terminalPhases.length === 3
      && terminalPhases.every((phases) => phases.length === 1)
      && new Set(terminalPhases.map((phases) => phases[0])).size === 3
    );
    const phaseSequence = terminalPhases.map((phases) => {
      return phases.length === 1 ? phaseNames[phases[0]] : null;
    });
    const phaseIndices = terminalPhases.map((phases) => phases[0]);
    const positiveSequence = Boolean(
      running
      && (phaseIndices[1] - phaseIndices[0] + 3) % 3 === 1
      && (phaseIndices[2] - phaseIndices[1] + 3) % 3 === 1
    );

    if (running) {
      collect("M", motor.geometry.phasePorts.flatMap((terminal, index) => {
        const source = data.supplies.phases[terminalPhases[index][0]];
        return graph.paths(source, terminal);
      }));
    } else if (power && values.KM) {
      diagnostics.push({
        code: "INCOMPLETE_MOTOR_SUPPLY",
        message: "KM is picked up, but M does not have three independent phases"
      });
    }

    const motorStates = {
      M: {
        running,
        direction: running ? (positiveSequence ? "forward" : "reverse") : "none",
        phaseSequence,
        terminalSources: Object.fromEntries(
          ["U", "V", "W"].map((name, index) => [
            name,
            terminalPhases[index].map((phaseIndex) => phaseNames[phaseIndex])
          ])
        )
      }
    };

    const activeEdgeIds = data.deviceEdges
      .filter((edge) => activeEdges.has(edge.edgeId))
      .map((edge) => edge.edgeId);
    const edgeStates = Object.fromEntries(data.deviceEdges.map((edge) => [
      edge.edgeId,
      {
        edgeId: edge.edgeId,
        conductive: isConductive(edge, values),
        energized: activeEdges.has(edge.edgeId)
      }
    ]));

    return {
      state,
      solverResult: {
        schemaVersion: "1.0",
        moduleId: MODULE_ID,
        stableDeviceStates: { KM: values.KM },
        edgeStates,
        activeMainWireIds: data.wires
          .filter((wire) => wire.domain === "main" && activeWires.has(wire.wireId))
          .map((wire) => wire.wireId),
        activeControlWireIds: data.wires
          .filter((wire) => wire.domain !== "main" && activeWires.has(wire.wireId))
          .map((wire) => wire.wireId),
        activeEdgeIds,
        partialWireIds: [],
        motorStates,
        protectionStates: {
          FR1: { tripped: values.FR1 },
          SQ: { triggered: values.SQ }
        },
        converged,
        iterationCount,
        lastAction: clone(state.lastAction),
        extension: {
          activeEdgeIds: [...activeEdgeIds],
          loadPaths,
          diagnostics,
          transitionTrace,
          supplyConnected: power,
          pressed: { ...operation.buttons },
          operation: { fr1: operation.fr1, sq: operation.sq },
          controlSupply: {
            sourcePort: supply.source,
            returnPort: supply.return,
            sourceTap: supply.sourceTap,
            returnTap: supply.returnTap,
            sourcePhase: data.supplies.controlPhase,
            returnPhase: data.supplies.controlReturnPhase
          },
          directSupplyShort: supplyShort,
          assumptions: [
            "The textbook omits QF and FU; the external power command only models supply availability.",
            "SQ and FR1 NC contacts are in series on the KM coil return path."
          ]
        }
      }
    };
  }

  function reduce(inputState, command, payload = {}) {
    const state = createInitialState(clone(inputState));
    const operation = state.operationState;

    switch (command) {
      case "powerClose":
        operation.power = "closed";
        break;
      case "powerOpen":
        operation.power = "open";
        break;
      case "powerToggle":
        return reduce(
          state,
          operation.power === "closed" ? "powerOpen" : "powerClose",
          payload
        );
      case "start":
      case "jog":
        operation.buttons.sb1 = "pressed";
        break;
      case "stop":
        operation.buttons.sb2 = "pressed";
        break;
      case "sqTrip":
        operation.sq = "triggered";
        break;
      case "sqReset":
        operation.sq = "normal";
        break;
      case "fr1Trip":
        operation.fr1 = "tripped";
        break;
      case "fr1Reset":
        operation.fr1 = "normal";
        break;
      case "release":
        if (payload.command === "start" || payload.command === "jog") {
          operation.buttons.sb1 = "released";
        } else if (payload.command === "stop") {
          operation.buttons.sb2 = "released";
        } else {
          operation.buttons.sb1 = "released";
          operation.buttons.sb2 = "released";
        }
        break;
      case "reset":
        return solve(createInitialState()).state;
      default:
        throw new Error("Unknown ch01 limit command: " + command);
    }

    state.lastAction = {
      type: command,
      payload: clone(payload),
      message: payload.message || command
    };
    return solve(state).state;
  }

  function runTests() {
    const checks = [];
    const check = (id, pass) => checks.push({ id, pass: Boolean(pass) });
    const act = (state, command, payload = {}) => reduce(state, command, payload);
    const resultOf = (state) => solve(state).solverResult;
    const initial = () => createInitialState();
    let state;
    let result;

    state = initial();
    result = resultOf(state);
    check("initial stopped", !result.stableDeviceStates.KM && !result.motorStates.M.running);

    state = act(state, "powerClose");
    result = resultOf(state);
    check("power only does not start", !result.stableDeviceStates.KM);

    state = act(state, "start");
    result = resultOf(state);
    check(
      "SB1 starts ABC motor",
      result.stableDeviceStates.KM
        && result.motorStates.M.running
        && result.motorStates.M.phaseSequence.join(",") === "A,B,C"
    );

    state = act(state, "release", { command: "start" });
    result = resultOf(state);
    check(
      "KM self hold",
      result.stableDeviceStates.KM
        && result.edgeStates.km_self_no.conductive
        && !result.edgeStates.sb1_no.conductive
    );

    state = act(state, "stop");
    result = resultOf(state);
    check("SB2 stop priority", !result.stableDeviceStates.KM && !result.edgeStates.sb2_nc.conductive);
    state = act(state, "release", { command: "stop" });
    result = resultOf(state);
    check("stop release with SB1 released does not restart", !result.stableDeviceStates.KM);

    state = act(act(initial(), "powerClose"), "start");
    state = act(state, "sqTrip");
    result = resultOf(state);
    check("SQ trip drops KM", !result.stableDeviceStates.KM && !result.edgeStates.sq_nc.conductive);
    state = act(state, "release", { command: "start" });
    state = act(state, "sqReset");
    result = resultOf(state);
    check("SQ reset with SB1 released does not restart", !result.stableDeviceStates.KM);

    state = act(act(initial(), "powerClose"), "start");
    state = act(state, "sqTrip");
    state = act(state, "sqReset");
    result = resultOf(state);
    check("SQ reset with SB1 held follows the real circuit", result.stableDeviceStates.KM);

    state = act(state, "fr1Trip");
    result = resultOf(state);
    check("FR1 trip drops KM", !result.stableDeviceStates.KM && !result.edgeStates.fr1_nc.conductive);
    state = act(state, "release", { command: "start" });
    state = act(state, "fr1Reset");
    result = resultOf(state);
    check("FR1 reset with SB1 released does not restart", !result.stableDeviceStates.KM);

    state = act(act(initial(), "powerClose"), "start");
    state = act(state, "fr1Trip");
    state = act(state, "fr1Reset");
    result = resultOf(state);
    check("FR1 reset with SB1 held follows the real circuit", result.stableDeviceStates.KM);

    state = act(state, "powerOpen");
    result = resultOf(state);
    check("power open drops KM", !result.stableDeviceStates.KM);
    state = act(state, "powerClose");
    result = resultOf(state);
    check("held SB1 restarts when power returns", result.stableDeviceStates.KM);

    state = act(state, "release", { command: "start" });
    state = act(state, "powerOpen");
    state = act(state, "powerClose");
    result = resultOf(state);
    check("released SB1 prevents restart after power loss", !result.stableDeviceStates.KM);

    state = act(act(initial(), "powerClose"), "start");
    state = act(state, "reset");
    result = resultOf(state);
    check(
      "reset clears supply and controls",
      state.operationState.power === "open"
        && state.operationState.buttons.sb1 === "released"
        && state.operationState.buttons.sb2 === "released"
        && state.operationState.fr1 === "normal"
        && state.operationState.sq === "normal"
        && !result.stableDeviceStates.KM
    );

    return {
      passed: checks.every((item) => item.pass),
      checks
    };
  }

  platform.moduleSolvers.ch01LimitTextbook = Object.freeze({
    createInitialState,
    solve,
    reduce,
    defaultOperation,
    runTests
  });
})(globalThis);
