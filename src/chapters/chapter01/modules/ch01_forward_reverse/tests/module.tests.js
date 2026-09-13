"use strict";

const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "../../../../../..");
const files = [
  "src/schemas/module-contract.js",
  "src/platform/runtime/runtime-scope.js",
  "src/registry/module-registry.js",
  "src/platform/module-adapter/facade-module-adapter.js",
  "src/components/electrical-simulation-primitives.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/circuit.data.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/solver.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/renderer.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/facade.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/module.js"
];
const sandbox = { console, AbortController, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file }));

const platform = sandbox.ECTPPlatform;
const definition = platform.moduleDefinitions.createCh01ForwardReverse();
const scope = platform.runtime.createRuntimeScope(definition.meta.moduleId);
const instance = definition.create({ mountRoot: null, services: Object.freeze({ renderShell() {} }), scope });
const checks = [];
const check = (name, value) => checks.push({ name, passed: Boolean(value) });

check("module identity", definition.meta.chapterId === "ch01" && definition.meta.moduleId === "ch01_forward_reverse");
check("independent module canvas", definition.meta.renderTarget === "module-canvas");
check("module contract", platform.contracts.validateModuleContract(instance).valid);
instance.createInitialState();
platform.contracts.assertFacadeOutputs(instance);
check("chapter 1 A-N 220V basis", definition.circuitData.electricalBasis.controlSupply.live === "A" && definition.circuitData.electricalBasis.controlSupply.neutral === "N" && definition.circuitData.electricalBasis.controlSupply.nominalVoltage === 220);
check("no second chapter or overload components", !JSON.stringify(definition.circuitData.components).match(/QF|FU|FR|KI1|KI2/));
check("button mapping", [
  ["SB1 正转", "START_FORWARD_PRESS"], ["SB2 反转", "START_REVERSE_PRESS"], ["SB3 停止", "STOP_PRESS"]
].every(([label, action]) => instance.getOperationViewModel().controls.some((control) => control.label === label && control.action === action)));
check("no overload controls", !instance.getOperationViewModel().protection && !instance.getOperationViewModel().protections);
check("geometry", instance.validateGeometry().valid);
check("built-in electrical regression", instance.runTests().passed);
const renderRoot = { innerHTML: "" };
const renderer = platform.moduleRenderers.createCh01ForwardReverseRenderer(definition.circuitData);
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_FORWARD_PRESS");
renderer.render({ root: renderRoot, internalState: { power: "closed", direction: "forward" }, solverResult: instance.normalizeSolverResult() });
check("forward animation has green route and clockwise indicator", renderRoot.innerHTML.includes("direction-forward") && renderRoot.innerHTML.includes("顺时针") && !renderRoot.innerHTML.includes("direction-reverse phase-a"));
instance.dispatchAction("RESET_MODULE");
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_REVERSE_PRESS");
renderer.render({ root: renderRoot, internalState: { power: "closed", direction: "reverse" }, solverResult: instance.normalizeSolverResult() });
check("reverse animation has blue route and counterclockwise indicator", renderRoot.innerHTML.includes("direction-reverse") && renderRoot.innerHTML.includes("逆时针") && !renderRoot.innerHTML.includes("direction-forward phase-a"));
check("motor body has no rotation element", !/<animate(?:Transform)?\b/i.test(renderRoot.innerHTML));
check("repository component UI reused", ["sim-terminal-outer", "sim-button-contactblock", "sim-coil-body", "sim-motor-shell"].every((className) => renderRoot.innerHTML.includes(className)));
check("mature circuit canvas ratio reused", renderRoot.innerHTML.includes('viewBox="0 0 1509 1134"'));
check("main circuit uses orthogonal terminal routing", renderRoot.innerHTML.includes("V580H300V735") && renderRoot.innerHTML.includes("V620H300V735") && !renderRoot.innerHTML.includes("L300 735"));
check("motor wiring is separated from direction feedback", renderRoot.innerHTML.includes("ch01-fr-terminal-board") && renderRoot.innerHTML.includes("ch01-fr-direction-badge") && !renderRoot.innerHTML.includes("ch01-fr-direction-arrow"));

instance.dispatchAction("RESET_MODULE");
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_FORWARD_PRESS");
check("SB1 energizes KM1", instance.getStateSnapshot().devices.forwardContactor.energized && !instance.getStateSnapshot().devices.reverseContactor.energized);
check("forward ABC", JSON.stringify(instance.normalizeSolverResult().extension.motorPhases) === JSON.stringify({ U: "A", V: "B", W: "C" }));
instance.dispatchAction("START_REVERSE_PRESS");
check("KM1 interlock blocks KM2", instance.getStateSnapshot().motor.direction === "forward" && !instance.getStateSnapshot().devices.reverseContactor.energized);
instance.dispatchAction("STOP_PRESS");
instance.dispatchAction("START_REVERSE_PRESS");
check("SB2 energizes KM2 after stop", instance.getStateSnapshot().devices.reverseContactor.energized && !instance.getStateSnapshot().devices.forwardContactor.energized);
check("reverse CBA", JSON.stringify(instance.normalizeSolverResult().extension.motorPhases) === JSON.stringify({ U: "C", V: "B", W: "A" }));
instance.dispatchAction("POWER_OPEN");
check("power open releases both", !instance.getStateSnapshot().motor.running && !instance.getStateSnapshot().devices.forwardContactor.energized && !instance.getStateSnapshot().devices.reverseContactor.energized);
check("playback available", instance.buildReplaySteps().length === 5);
instance.unmount();
scope.dispose();
check("lifecycle disposed", scope.diagnostics().disposed);

if (checks.some((item) => !item.passed)) throw new Error(JSON.stringify(checks, null, 2));
console.log(JSON.stringify({ passed: true, moduleId: definition.meta.moduleId, checks }, null, 2));
