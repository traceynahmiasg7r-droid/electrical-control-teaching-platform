"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../../../../../..");
const files = [
  "src/schemas/module-contract.js",
  "src/platform/runtime/runtime-scope.js",
  "src/registry/module-registry.js",
  "src/platform/module-adapter/facade-module-adapter.js",
  "src/chapters/chapter01/modules/_shared/direct-start-runtime.js",
  "src/chapters/chapter01/modules/ch01_direct_start_protection/circuit-data.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/circuit-data.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/facade.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/module.js"
];

function element() {
  return { innerHTML: "", textContent: "", disabled: false, dataset: {}, classList: { toggle() {} }, addEventListener() {} };
}
const elements = new Map([
  "chapterModuleCanvas", "principleStepList", "showPrinciplePlayback", "playbackPrev", "playbackToggle",
  "playbackNext", "currentStepText", "playbackSpeed05", "playbackSpeed10", "playbackSpeed15"
].map((id) => [id, element()]));
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController,
  matchMedia: () => ({ matches: true }),
  document: { getElementById: (id) => elements.get(id) || null }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file }));

const platform = sandbox.ECTPPlatform;
const definition = platform.moduleDefinitions.createCh01OverloadProtection();
const scope = platform.runtime.createRuntimeScope(definition.meta.moduleId);
const instance = definition.create({ mountRoot: null, services: Object.freeze({ setActionFeedback() {}, renderShell() {} }), scope });
const checks = [];
const check = (name, condition) => checks.push({ name, passed: Boolean(condition) });

check("module identity", definition.meta.chapterId === "ch01" && definition.meta.moduleId === "ch01_overload_protection");
check("module contract", platform.contracts.validateModuleContract(instance).valid);
instance.createInitialState();
platform.contracts.assertFacadeOutputs(instance);
check("geometry", instance.validateGeometry().valid);
check("built-in solver regression", instance.runTests().passed);
check("namespace isolation", [
  ...definition.circuitData.ports.map((item) => item.portId),
  ...definition.circuitData.wires.map((item) => item.wireId),
  ...definition.circuitData.components.map((item) => item.componentId),
  ...definition.circuitData.deviceEdges.map((item) => item.edgeId)
].every((id) => id.startsWith("ch01_overload_protection__")));

instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_PRIMARY_PRESS");
check("motor starts and self-holds", instance.getStateSnapshot().motor.running);
instance.dispatchAction("PROTECTION_TOGGLE");
let state = instance.getStateSnapshot();
check("overload trips FR and stops motor", state.operation.protections.overload === "overload" && !state.motor.running && !state.devices.primaryContactor.energized);
check("overload replay explains protection chain", instance.buildReplaySteps().length === 3);
instance.dispatchAction("PROTECTION_RESET");
state = instance.getStateSnapshot();
check("reset does not auto restart", state.operation.protections.overload === "normal" && !state.motor.running);
instance.dispatchAction("START_PRIMARY_PRESS");
check("manual restart works after reset", instance.getStateSnapshot().motor.running);
instance.unmount({});
scope.dispose();
check("lifecycle disposed", scope.diagnostics().disposed && scope.diagnostics().intervalCount === 0);

if (checks.some((item) => !item.passed)) throw new Error(JSON.stringify(checks, null, 2));
console.log(JSON.stringify({ passed: true, moduleId: definition.meta.moduleId, checks }, null, 2));
