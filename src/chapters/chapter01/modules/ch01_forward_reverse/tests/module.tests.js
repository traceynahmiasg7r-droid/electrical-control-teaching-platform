"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../../../../../..");
const files = [
  "src/schemas/module-contract.js",
  "src/platform/runtime/runtime-scope.js",
  "src/platform/module-adapter/facade-module-adapter.js",
  "src/chapters/chapter02/modules/ch02_reverse/facade.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/facade.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/module.js"
];
const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file }));

let operationState;
let solver;
function reset() {
  operationState = { qf1: "open", sb1: "released", sb2: "released", sb3: "released", fr1: "normal" };
  solver = {
    stableControlState: { ki1: false, ki2: false }, motorState: "stopped", edgeStates: {},
    activeMainWireIds: [], activeControlWireIds: [], partialControlWireIds: [], activeControlEdgeIds: [],
    activeMainEdgeIds: [], activeMainWirePhaseMap: {}, motorPhases: {}, converged: true, iterationCount: 1, lastAction: "reset"
  };
}
function update(direction) {
  if (operationState.qf1 !== "closed" || operationState.fr1 === "overload") direction = "stopped";
  solver.motorState = direction;
  solver.stableControlState.ki1 = direction === "forward";
  solver.stableControlState.ki2 = direction === "reverse";
  solver.motorPhases = direction === "forward" ? { U: "L1", V: "L2", W: "L3" }
    : direction === "reverse" ? { U: "L3", V: "L2", W: "L1" } : {};
}
reset();
const port = {
  readRawState: () => ({ operationState, solver }), reset, solve: () => undefined,
  togglePower: () => { operationState.qf1 = operationState.qf1 === "closed" ? "open" : "closed"; update(solver.motorState); },
  pressStop: () => update("stopped"),
  pressForward: () => { if (solver.motorState !== "reverse") update("forward"); },
  pressReverse: () => { if (solver.motorState !== "forward") update("reverse"); },
  toggleProtection: () => { operationState.fr1 = "overload"; update("stopped"); },
  resetProtection: () => { operationState.fr1 = "normal"; update("stopped"); },
  render: () => undefined, pause: () => undefined, unmount: () => undefined,
  validateGeometry: () => ({ valid: true, errors: [] }), runTests: () => ({ passed: true, total: 1, passedCount: 1 }),
  getFeedback: () => ({ title: "正反转", text: "互锁动作正确", tone: "info" }), getReplaySteps: () => []
};
const circuitData = Object.freeze({ schemaVersion: "1.0", moduleId: "legacy-forward-reverse" });
const platform = sandbox.ECTPPlatform;
const definition = platform.moduleDefinitions.createCh01ForwardReverse({ circuitData, port });
const instance = definition.create({ mountRoot: null, services: Object.freeze({}), scope: {} });
const checks = [];
const check = (name, condition) => checks.push({ name, passed: Boolean(condition) });

check("module identity", definition.meta.chapterId === "ch01" && definition.meta.moduleId === "ch01_forward_reverse");
check("module contract", platform.contracts.validateModuleContract(instance).valid);
instance.createInitialState();
platform.contracts.assertFacadeOutputs(instance);
check("facade identity isolated from ch02", [instance.getStateSnapshot(), instance.normalizeSolverResult(), instance.getOperationViewModel(), instance.getStatusViewModel()].every((item) => item.moduleId === "ch01_forward_reverse"));
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_FORWARD_PRESS");
check("forward start", instance.getStateSnapshot().motor.direction === "forward");
instance.dispatchAction("START_REVERSE_PRESS");
check("electrical interlock blocks direct reversal", instance.getStateSnapshot().motor.direction === "forward");
instance.dispatchAction("STOP_PRESS");
instance.dispatchAction("START_REVERSE_PRESS");
check("reverse starts after stop", instance.getStateSnapshot().motor.direction === "reverse");
instance.dispatchAction("PROTECTION_TOGGLE");
check("overload stops reverse", instance.getStateSnapshot().motor.state === "stopped");
instance.dispatchAction("PROTECTION_RESET");
check("reset does not auto restart", instance.getStateSnapshot().motor.state === "stopped");
check("mature geometry and solver tests delegated", instance.validateGeometry().valid && instance.runTests().passed);

if (checks.some((item) => !item.passed)) throw new Error(JSON.stringify(checks, null, 2));
console.log(JSON.stringify({ passed: true, moduleId: definition.meta.moduleId, checks }, null, 2));
