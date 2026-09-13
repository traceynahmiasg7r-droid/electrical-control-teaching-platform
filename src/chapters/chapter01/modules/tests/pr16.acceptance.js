"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repositoryRoot = path.resolve(__dirname, "../../../../..");
const indexHtml = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
const rendererSource = fs.readFileSync(path.join(repositoryRoot, "src/chapters/chapter01/modules/ch01_forward_reverse/renderer.js"), "utf8");
const directStartSource = fs.readFileSync(path.join(repositoryRoot, "src/chapters/chapter01/modules/_shared/direct-start-runtime.js"), "utf8");
const sources = [
  "src/schemas/module-contract.js",
  "src/platform/runtime/runtime-scope.js",
  "src/registry/module-registry.js",
  "src/platform/module-loader/module-loader.js",
  "src/platform/module-adapter/facade-module-adapter.js",
  "src/components/electrical-simulation-primitives.js",
  "src/chapters/chapter01/modules/_shared/direct-start-runtime.js",
  "src/chapters/chapter01/modules/ch01_jog/circuit-data.js",
  "src/chapters/chapter01/modules/ch01_direct_start_protection/circuit-data.js",
  "src/chapters/chapter01/modules/ch01_jog/facade.js",
  "src/chapters/chapter01/modules/ch01_direct_start_protection/facade.js",
  "src/chapters/chapter01/modules/ch01_jog/module.js",
  "src/chapters/chapter01/modules/ch01_direct_start_protection/module.js",
  "src/chapters/chapter01/modules/ch01_timed_auto_stop/circuit.data.js",
  "src/chapters/chapter01/modules/ch01_timed_auto_stop/solver.js",
  "src/chapters/chapter01/modules/ch01_timed_auto_stop/renderer.js",
  "src/chapters/chapter01/modules/ch01_timed_auto_stop/facade.js",
  "src/chapters/chapter01/modules/ch01_timed_auto_stop/module.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/circuit.data.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/solver.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/renderer.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/facade.js",
  "src/chapters/chapter01/modules/ch01_forward_reverse/module.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/circuit-data.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/facade.js",
  "src/chapters/chapter01/modules/ch01_overload_protection/module.js"
];

function createFakeElement() {
  const listeners = new Map();
  const element = {
    innerHTML: "",
    textContent: "",
    disabled: false,
    dataset: {},
    classList: { toggle() {} },
    querySelectorAll: () => [],
    replaceChildren() { this.innerHTML = ""; },
    addEventListener(type, handler, options = {}) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
      options.signal?.addEventListener("abort", () => {
        listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
      }, { once: true });
    },
    dispatch(type) {
      const event = { preventDefault() {}, stopImmediatePropagation() {}, target: element };
      [...(listeners.get(type) || [])].forEach((handler) => handler(event));
    }
  };
  return element;
}

const elements = new Map([
  "chapterModuleCanvas", "principleStepList", "showPrinciplePlayback", "playbackPrev", "playbackToggle",
  "playbackNext", "currentStepText", "playbackSpeed05", "playbackSpeed10", "playbackSpeed15"
].map((id) => [id, createFakeElement()]));
const sandbox = {
  console,
  AbortController,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  matchMedia: () => ({ matches: true }),
  document: { getElementById: (id) => elements.get(id) || null }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sources.forEach((source) => vm.runInContext(fs.readFileSync(path.join(repositoryRoot, source), "utf8"), sandbox, { filename: source }));

const platform = sandbox.ECTPPlatform;
const checks = [];
const check = (name, condition, detail = "") => checks.push({ name, passed: Boolean(condition), ...(detail ? { detail } : {}) });
const definitions = [
  platform.moduleDefinitions.createCh01Jog(),
  platform.moduleDefinitions.createCh01DirectStartProtection(),
  platform.moduleDefinitions.createCh01TimedAutoStop(),
  platform.moduleDefinitions.createCh01ForwardReverse(),
  platform.moduleDefinitions.createCh01OverloadProtection()
];
const registry = platform.registry.createModuleRegistry(platform.contracts);
definitions.forEach((definition) => registry.register(definition));

check("first chapter order and code", definitions.map((item) => `${item.meta.order}:${item.meta.code}:${item.meta.moduleId}`).join("|") === [
  "1:01:ch01_jog",
  "2:02:ch01_direct_start_protection",
  "3:03:ch01_timed_auto_stop",
  "4:04:ch01_forward_reverse",
  "5:05:ch01_overload_protection"
].join("|"));
check("registry identities unique", new Set(definitions.map((item) => item.meta.moduleId)).size === 5);
check("registry routes unique", new Set(definitions.map((item) => item.meta.routeId)).size === 5);
check("all facade-v1", definitions.every((item) => item.meta.integrationMode === "facade-v1"));
check("module catalog contains both routes", /"ch01-forward-reverse"\s*:/.test(indexHtml) && /"ch01-overload-protection"\s*:/.test(indexHtml));
check("index loads both complete module stacks", [
  "ch01_forward_reverse/circuit.data.js", "ch01_forward_reverse/solver.js", "ch01_forward_reverse/renderer.js",
  "ch01_forward_reverse/facade.js", "ch01_forward_reverse/module.js", "ch01_overload_protection/circuit-data.js",
  "ch01_overload_protection/facade.js", "ch01_overload_protection/module.js"
].every((asset) => indexHtml.includes(asset)));
check("registry startup registers both modules", indexHtml.includes("createCh01ForwardReverse()") && indexHtml.includes("createCh01OverloadProtection()"));
check("platform has no module-specific reverse branch", !indexHtml.includes("function isCh01ForwardReverseModule") && !indexHtml.includes('uiState.currentModule === "ch01-forward-reverse"'));
check("reverse renderer consumes formal routePoints", rendererSource.includes("wire.routePoints.map") && !rendererSource.includes('const forwardMainA = "M'));
check("direct-start renderer consumes formal routePoints", directStartSource.includes("pathData(wire.routePoints)"));

const loader = platform.loader.createModuleLoader({
  registry,
  mountRoot: elements.get("chapterModuleCanvas"),
  services: Object.freeze({ setActionFeedback() {}, renderShell() {} })
});
const observedScopes = [];
function load(moduleId) {
  const current = loader.getCurrent();
  if (current) observedScopes.push(current.scope);
  return loader.load(moduleId);
}

function assertFlow(instance, definition, label) {
  const result = instance.normalizeSolverResult();
  const wireIds = new Set(definition.circuitData.wires.map((wire) => wire.wireId));
  const active = [...result.activeMainWireIds, ...result.activeControlWireIds];
  check(`${label} all solver wire IDs exist`, [...active, ...result.partialWireIds].every((wireId) => wireIds.has(wireId)));
  check(`${label} active and partial do not overlap`, result.partialWireIds.every((wireId) => !active.includes(wireId)));
  return result;
}

function assertRenderedRoutes(instance, definition, label) {
  instance.render();
  const markup = elements.get("chapterModuleCanvas").innerHTML;
  const result = instance.normalizeSolverResult();
  const active = [...result.activeMainWireIds, ...result.activeControlWireIds];
  check(`${label} rendered active wires use one base/highlight path`, active.every((wireId) => {
    const escaped = wireId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const paths = [...markup.matchAll(new RegExp(`data-wire-id="${escaped}" d="([^"]+)"`, "g"))].map((match) => match[1]);
    return paths.length >= 2 && new Set(paths).size === 1;
  }));
}

const reverseDefinition = registry.require("ch01-forward-reverse");
let instance = load("ch01-forward-reverse");
check("loader enters reverse by route", loader.diagnostics().currentModuleId === "ch01_forward_reverse");
check("reverse initial state", !instance.getStateSnapshot().motor.running && instance.getStateSnapshot().motor.direction === "none");
platform.contracts.assertFacadeOutputs(instance);
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_FORWARD_PRESS");
let result = assertFlow(instance, reverseDefinition, "reverse forward state");
check("forward self hold and phase sequence", instance.getStateSnapshot().devices.forwardContactor.energized
  && result.extension.motorPhases.U === "A" && result.extension.motorPhases.W === "C");
assertRenderedRoutes(instance, reverseDefinition, "reverse forward state");
instance.dispatchAction("START_REVERSE_PRESS");
check("forward interlock blocks direct reverse", instance.getStateSnapshot().motor.direction === "forward");
instance.dispatchAction("STOP_PRESS");
instance.dispatchAction("START_REVERSE_PRESS");
result = assertFlow(instance, reverseDefinition, "reverse reverse state");
check("reverse self hold and phase sequence", instance.getStateSnapshot().devices.reverseContactor.energized
  && result.extension.motorPhases.U === "C" && result.extension.motorPhases.W === "A");
instance.dispatchAction("START_FORWARD_PRESS");
check("reverse interlock blocks direct forward", instance.getStateSnapshot().motor.direction === "reverse");
check("reverse view models and teaching", instance.getOperationViewModel().controls.length >= 3
  && instance.getStatusViewModel().rows.length >= 5
  && instance.buildTeachingFeedback().steps.length >= 2
  && instance.buildReplaySteps().length === 5);

const reverseScope = loader.getCurrent().scope;
elements.get("playbackToggle").dispatch("click");
check("reverse playback timer tracked by runtime scope", reverseScope.diagnostics().intervalCount === 1);
const overloadDefinition = registry.require("ch01-overload-protection");
instance = load("ch01-overload-protection");
check("reverse unmount disposes scope", reverseScope.diagnostics().disposed && reverseScope.diagnostics().intervalCount === 0 && reverseScope.diagnostics().timeoutCount === 0);
check("overload initial state isolated", !instance.getStateSnapshot().motor.running && instance.getStateSnapshot().operation.protections.overload === "normal");
platform.contracts.assertFacadeOutputs(instance);
instance.dispatchAction("POWER_CLOSE");
instance.dispatchAction("START_PRIMARY_PRESS");
check("overload motor starts and KM energizes", instance.getStateSnapshot().motor.running && instance.getStateSnapshot().devices.primaryContactor.energized);
assertFlow(instance, overloadDefinition, "overload running state");
instance.dispatchAction("PROTECTION_TOGGLE");
check("FR overload opens control and stops motor", instance.getStateSnapshot().operation.protections.overload === "overload"
  && !instance.getStateSnapshot().devices.primaryContactor.energized && !instance.getStateSnapshot().motor.running);
check("overload view models and teaching", instance.getStatusViewModel().rows.some((row) => row.id === "protection" && row.label === "FR1")
  && instance.buildTeachingFeedback().text.includes("过载")
  && instance.buildReplaySteps().length === 3);
instance.dispatchAction("PROTECTION_RESET");
check("FR reset does not restart", instance.getStateSnapshot().operation.protections.overload === "normal" && !instance.getStateSnapshot().motor.running);
instance.dispatchAction("START_PRIMARY_PRESS");
elements.get("playbackToggle").dispatch("click");
const overloadScope = loader.getCurrent().scope;
check("playback timer tracked by runtime scope", overloadScope.diagnostics().intervalCount === 1);

instance = load("ch01_direct_start_protection");
check("overload unmount clears playback timer", overloadScope.diagnostics().disposed && overloadScope.diagnostics().intervalCount === 0);
check("direct-start state not polluted", !instance.getStateSnapshot().motor.running && instance.getStateSnapshot().operation.protections.overload === "normal");

for (let cycle = 0; cycle < 3; cycle += 1) {
  instance = load("ch01-forward-reverse");
  check(`cycle ${cycle + 1} reverse resets`, !instance.getStateSnapshot().motor.running);
  instance.dispatchAction("POWER_CLOSE");
  instance.dispatchAction("START_FORWARD_PRESS");
  instance = load("ch01-overload-protection");
  check(`cycle ${cycle + 1} overload resets`, !instance.getStateSnapshot().motor.running && instance.getStateSnapshot().operation.protections.overload === "normal");
}
observedScopes.push(loader.getCurrent().scope);
loader.destroy();
check("all loader scopes disposed", observedScopes.every((scope) => scope.diagnostics().disposed
  && scope.diagnostics().intervalCount === 0
  && scope.diagnostics().timeoutCount === 0
  && scope.diagnostics().cleanupCount === 0));

const failed = checks.filter((item) => !item.passed);
if (failed.length) throw new Error(JSON.stringify({ passed: false, failed, checks }, null, 2));
console.log(JSON.stringify({ passed: true, total: checks.length, checks }, null, 2));
