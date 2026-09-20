"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = globalThis;
const folder = path.resolve(__dirname, "..");
require(path.join(folder, "circuit.data.js"));
require(path.join(folder, "solver.js"));

const data = ECTPPlatform.moduleCircuitData.ch01LimitTextbook;
const solver = ECTPPlatform.moduleSolvers.ch01LimitTextbook;
const checks = [];
const observed = [];
const initial = () => solver.createInitialState();
const act = (state, command, payload = {}) => solver.reduce(state, command, payload);

function check(name, fn) {
  fn();
  checks.push({ name, pass: true });
}

function inspect(state) {
  const result = solver.solve(state).solverResult;
  assert.equal(result.moduleId, "ch01_limit");
  assert.equal(result.converged, true);
  const knownWires = new Set(data.wires.map((wire) => wire.wireId));
  const knownEdges = new Set(data.deviceEdges.map((edge) => edge.edgeId));
  for (const id of [...result.activeMainWireIds, ...result.activeControlWireIds]) {
    assert.ok(knownWires.has(id), "unknown active wire " + id);
  }
  for (const id of result.activeEdgeIds) {
    assert.ok(knownEdges.has(id), "unknown active edge " + id);
    assert.equal(result.edgeStates[id].conductive, true, "open edge marked active: " + id);
  }
  assert.equal(result.extension.directSupplyShort, false);
  observed.push(result);
  return result;
}

function withMissingWire(id, fn) {
  const index = data.wires.findIndex((wire) => wire.wireId === id);
  assert.ok(index >= 0, "missing fixture wire " + id);
  const wire = data.wires.splice(index, 1)[0];
  try {
    fn();
  } finally {
    data.wires.splice(index, 0, wire);
  }
}

function runningWithStartHeld() {
  return act(act(initial(), "powerClose"), "start");
}

let state;
let result;

check("geometry exposes textbook devices and C/B control taps", () => {
  const components = new Set(data.components.map((component) => component.componentId));
  for (const id of ["km_main", "fr1_main", "motor", "sb1", "km_self", "sb2", "km_coil", "fr1_nc", "sq"]) {
    assert.ok(components.has(id), "missing textbook component " + id);
  }
  for (const id of ["sb1_no", "km_self_no", "sb2_nc", "km_coil", "fr1_nc", "sq_nc"]) {
    assert.ok(data.deviceEdges.some((edge) => edge.edgeId === id), "missing edge " + id);
  }
  assert.equal(String(data.supplies.controlPhase).toUpperCase(), "C");
  assert.equal(String(data.supplies.controlReturnPhase).toUpperCase(), "B");
  assert.equal(data.supplies.control.length, 2);
  assert.equal(data.validateGeometry().valid, true);
});

check("initial and supply-only states stay stopped", () => {
  state = initial();
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
  assert.equal(result.motorStates.M.running, false);
  assert.deepEqual(result.activeEdgeIds, []);
  state = act(state, "powerClose");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
  assert.equal(result.motorStates.M.running, false);
  assert.equal(result.edgeStates.sb1_no.conductive, false);
  assert.equal(result.edgeStates.sb2_nc.conductive, true);
  assert.equal(result.edgeStates.fr1_nc.conductive, true);
  assert.equal(result.edgeStates.sq_nc.conductive, true);
});

check("SB1 starts KM through every series NC and runs ABC", () => {
  state = act(state, "start");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
  assert.equal(result.motorStates.M.running, true);
  assert.equal(result.motorStates.M.direction, "forward");
  assert.deepEqual(result.motorStates.M.phaseSequence, ["A", "B", "C"]);
  for (const id of ["sb1_no", "sb2_nc", "fr1_nc", "sq_nc", "km_coil"]) {
    assert.ok(result.activeEdgeIds.includes(id), "missing live control edge " + id);
  }
  for (const id of ["km_main_a", "km_main_b", "km_main_c", "fr1_main_a", "fr1_main_b", "fr1_main_c"]) {
    assert.ok(result.activeEdgeIds.includes(id), "missing live main edge " + id);
  }
  assert.ok(result.extension.loadPaths.km_coil);
});

check("releasing SB1 transfers current to KM self-hold", () => {
  state = act(state, "release", { command: "start" });
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
  assert.equal(result.motorStates.M.running, true);
  assert.equal(result.edgeStates.sb1_no.conductive, false);
  assert.equal(result.edgeStates.km_self_no.conductive, true);
  assert.ok(!result.activeEdgeIds.includes("sb1_no"));
  assert.ok(result.activeEdgeIds.includes("km_self_no"));
});

check("SB2 has stop priority, including while SB1 is held", () => {
  state = act(runningWithStartHeld(), "stop");
  result = inspect(state);
  assert.equal(result.edgeStates.sb1_no.conductive, true);
  assert.equal(result.edgeStates.sb2_nc.conductive, false);
  assert.equal(result.stableDeviceStates.KM, false);
  state = act(state, "release", { command: "stop" });
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
});

check("SB2 release cannot restart after SB1 release", () => {
  state = act(runningWithStartHeld(), "stop");
  state = act(state, "release", { command: "start" });
  state = act(state, "release", { command: "stop" });
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
});

check("SQ trip and reset follow physical SB1 state", () => {
  state = act(runningWithStartHeld(), "sqTrip");
  result = inspect(state);
  assert.equal(result.edgeStates.sq_nc.conductive, false);
  assert.equal(result.protectionStates.SQ.triggered, true);
  assert.equal(result.stableDeviceStates.KM, false);
  state = act(state, "sqReset");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
  state = act(state, "sqTrip");
  state = act(state, "release", { command: "start" });
  state = act(state, "sqReset");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
});

check("FR1 trip and reset follow physical SB1 state", () => {
  state = act(runningWithStartHeld(), "fr1Trip");
  result = inspect(state);
  assert.equal(result.edgeStates.fr1_nc.conductive, false);
  assert.equal(result.protectionStates.FR1.tripped, true);
  assert.equal(result.stableDeviceStates.KM, false);
  state = act(state, "fr1Reset");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
  state = act(state, "fr1Trip");
  state = act(state, "release", { command: "start" });
  state = act(state, "fr1Reset");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
});

check("power restoration only starts with physically held SB1", () => {
  state = act(runningWithStartHeld(), "powerOpen");
  result = inspect(state);
  assert.equal(state.operationState.buttons.sb1, "pressed");
  assert.equal(result.stableDeviceStates.KM, false);
  state = act(state, "powerClose");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, true);
  state = act(state, "release", { command: "start" });
  state = act(state, "powerOpen");
  state = act(state, "powerClose");
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM, false);
});

check("every control wire has its real branch role and no hidden bypass", () => {
  const controlWires = data.wires.filter((wire) => wire.domain !== "main");
  const startEdge = data.deviceEdges.find((edge) => edge.edgeId === "sb1_no");
  const holdEdge = data.deviceEdges.find((edge) => edge.edgeId === "km_self_no");
  const touches = (wire, edge) => [edge.from, edge.to].includes(wire.from)
    || [edge.from, edge.to].includes(wire.to);
  const startBranch = controlWires.filter((wire) => touches(wire, startEdge));
  const holdBranch = controlWires.filter((wire) => touches(wire, holdEdge));
  const branchIds = new Set([...startBranch, ...holdBranch].map((wire) => wire.wireId));
  const commonSeries = controlWires.filter((wire) => !branchIds.has(wire.wireId));

  assert.equal(startBranch.length, 2);
  assert.equal(holdBranch.length, 2);
  assert.ok(commonSeries.length > 0);

  for (const wire of startBranch) {
    withMissingWire(wire.wireId, () => {
      result = inspect(runningWithStartHeld());
      assert.equal(result.stableDeviceStates.KM, false, wire.wireId + " bypasses SB1");
    });
  }
  for (const wire of holdBranch) {
    withMissingWire(wire.wireId, () => {
      let candidate = runningWithStartHeld();
      result = inspect(candidate);
      assert.equal(result.stableDeviceStates.KM, true, "SB1 should still pick up KM");
      candidate = act(candidate, "release", { command: "start" });
      result = inspect(candidate);
      assert.equal(result.stableDeviceStates.KM, false, wire.wireId + " did not break self-hold");
    });
  }
  for (const wire of commonSeries) {
    withMissingWire(wire.wireId, () => {
      result = inspect(runningWithStartHeld());
      assert.equal(result.stableDeviceStates.KM, false, wire.wireId + " has an unintended bypass");
    });
  }
});

check("removing either C/B control source tap interrupts pickup", () => {
  const sourceTapWires = data.wires.filter((wire) => {
    return data.supplies.phases.includes(wire.from)
      && data.supplies.control.includes(wire.to);
  });
  assert.equal(sourceTapWires.length, 2);
  for (const wire of sourceTapWires) {
    withMissingWire(wire.wireId, () => {
      result = inspect(runningWithStartHeld());
      assert.equal(result.stableDeviceStates.KM, false, wire.wireId + " has a control bypass");
      assert.equal(result.motorStates.M.running, false);
    });
  }
});

check("a direct C-to-B bypass is diagnosed and cannot energize the coil", () => {
  const bypass = {
    wireId: "test-only-control-supply-bypass",
    from: data.supplies.phases[2],
    to: data.supplies.phases[1],
    domain: "control",
    points: []
  };
  data.wires.push(bypass);
  try {
    result = solver.solve(runningWithStartHeld()).solverResult;
    assert.equal(result.extension.directSupplyShort, true);
    assert.equal(result.stableDeviceStates.KM, false);
    assert.equal(result.motorStates.M.running, false);
    assert.ok(result.extension.diagnostics.some((item) => item.code === "CONTROL_SUPPLY_SHORT"));
    assert.ok(!result.activeControlWireIds.includes(bypass.wireId));
  } finally {
    data.wires.pop();
  }
});

check("each open NC contact interrupts pickup", () => {
  const cases = [
    ["sb2_nc", (candidate) => { candidate.operationState.buttons.sb2 = "pressed"; }],
    ["fr1_nc", (candidate) => { candidate.operationState.fr1 = "tripped"; }],
    ["sq_nc", (candidate) => { candidate.operationState.sq = "triggered"; }]
  ];
  for (const item of cases) {
    const candidate = runningWithStartHeld();
    item[1](candidate);
    result = inspect(candidate);
    assert.equal(result.edgeStates[item[0]].conductive, false);
    assert.equal(result.stableDeviceStates.KM, false);
  }
});

check("each removed main wire causes phase loss but keeps KM energized", () => {
  const live = runningWithStartHeld();
  const sourceTapIds = new Set(data.wires.filter((wire) => {
    return data.supplies.phases.includes(wire.from)
      && data.supplies.control.includes(wire.to);
  }).map((wire) => wire.wireId));
  const motorOnlyWires = data.wires.filter((wire) => {
    return wire.domain === "main" && !sourceTapIds.has(wire.wireId);
  });
  const sharedTapIds = new Set(sourceTapIds);
  for (const wire of motorOnlyWires) {
    withMissingWire(wire.wireId, () => {
      result = inspect(live);
      assert.equal(result.stableDeviceStates.KM, true);
      assert.equal(result.motorStates.M.running, false, wire.wireId + " did not cause phase loss");
      assert.ok(result.extension.diagnostics.some((item) => item.code === "INCOMPLETE_MOTOR_SUPPLY"));
      assert.equal(result.extension.loadPaths.M, undefined);
      assert.ok(result.activeMainWireIds.every((id) => sharedTapIds.has(id)));
      assert.ok(result.activeControlWireIds.length > 0);
    });
  }
});

check("motor direction comes from graph phase paths", () => {
  const motor = data.components.find((component) => component.type === "motor");
  const phaseA = data.wires.find((wire) => wire.to === motor.geometry.phasePorts[0]);
  const phaseC = data.wires.find((wire) => wire.to === motor.geometry.phasePorts[2]);
  assert.ok(phaseA && phaseC);
  const firstTarget = phaseA.to;
  const secondTarget = phaseC.to;
  try {
    phaseA.to = secondTarget;
    phaseC.to = firstTarget;
    result = inspect(runningWithStartHeld());
    assert.equal(result.motorStates.M.running, true);
    assert.equal(result.motorStates.M.direction, "reverse");
    assert.deepEqual(result.motorStates.M.phaseSequence, ["C", "B", "A"]);
  } finally {
    phaseA.to = firstTarget;
    phaseC.to = secondTarget;
  }
});

check("reset and repeated solve are deterministic", () => {
  state = act(runningWithStartHeld(), "reset");
  result = inspect(state);
  assert.equal(state.operationState.power, "open");
  assert.equal(state.operationState.buttons.sb1, "released");
  assert.equal(state.operationState.buttons.sb2, "released");
  assert.equal(state.operationState.fr1, "normal");
  assert.equal(state.operationState.sq, "normal");
  assert.equal(result.stableDeviceStates.KM, false);
  for (const power of ["open", "closed"]) {
    for (const sb1 of ["released", "pressed"]) {
      for (const sb2 of ["released", "pressed"]) {
        for (const fr1 of ["normal", "tripped"]) {
          for (const sq of ["normal", "triggered"]) {
            const candidate = solver.createInitialState({
              operationState: { power, buttons: { sb1, sb2 }, fr1, sq },
              stableDeviceStates: { KM: true }
            });
            const copy = structuredClone(candidate);
            const first = solver.solve(candidate);
            const second = solver.solve(first.state);
            assert.deepEqual(candidate, copy);
            assert.deepEqual(first.state, second.state);
            for (const field of ["stableDeviceStates", "edgeStates", "motorStates", "activeEdgeIds", "activeMainWireIds", "activeControlWireIds", "protectionStates"]) {
              assert.deepEqual(first.solverResult[field], second.solverResult[field], field);
            }
            inspect(second.state);
          }
        }
      }
    }
  }
});

check("public self-test passes", () => {
  const report = solver.runTests();
  assert.equal(report.passed, true);
  assert.ok(report.checks.length >= 16);
});

console.log(JSON.stringify({
  passed: true,
  checks: checks.length,
  observedStates: observed.length,
  results: checks
}, null, 2));
