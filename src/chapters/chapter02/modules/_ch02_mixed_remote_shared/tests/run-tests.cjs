"use strict";

const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../../../../..");
const modulesRoot = path.resolve(__dirname, "../..");

function load(relativePath) {
  require(path.resolve(repoRoot, relativePath));
}

load("src/schemas/module-contract.js");
load("src/platform/runtime/runtime-scope.js");
load("src/platform/module-adapter/facade-module-adapter.js");
require(path.resolve(__dirname, "../runtime.js"));

const moduleDescriptors = [
  ["ch02_mixed_mode1", "createCh02MixedMode1"],
  ["ch02_mixed_mode2", "createCh02MixedMode2"],
  ["ch02_mixed_mode3", "createCh02MixedMode3"],
  ["ch02_multi_station", "createCh02MultiStation"]
];

for (const [moduleId] of moduleDescriptors) {
  require(path.resolve(modulesRoot, moduleId, "circuit.data.js"));
  require(path.resolve(modulesRoot, moduleId, "facade.js"));
  require(path.resolve(modulesRoot, moduleId, "module.js"));
}

const platform = globalThis.ECTPPlatform;
const failures = [];

for (const [moduleId, factoryName] of moduleDescriptors) {
  const definition = platform.moduleDefinitions[factoryName]();
  const scope = platform.runtime.createRuntimeScope(moduleId);
  const instance = definition.create({ mountRoot: null, services: {}, scope });
  const contractReport = platform.contracts.validateModuleContract(instance);
  if (!contractReport.valid) failures.push(`${moduleId}: ${contractReport.errors.join("; ")}`);
  instance.createInitialState();
  try {
    platform.contracts.assertFacadeOutputs(instance);
  } catch (error) {
    failures.push(`${moduleId}: ${error.message}`);
  }
  const moduleReport = instance.runTests();
  if (!moduleReport.valid) failures.push(`${moduleId}: ${moduleReport.failures.join("; ")}`);
  const svg = instance.render();
  if (svg !== undefined) failures.push(`${moduleId}: adapter must not render before mount`);
  instance.mount();
  const mountedSvg = instance.render();
  if (typeof mountedSvg !== "string" || !mountedSvg.includes("optimized-circuit")) failures.push(`${moduleId}: optimized SVG render missing`);
  instance.pause();
  instance.resume();
  instance.unmount();
  scope.dispose();
  const diagnostics = scope.diagnostics();
  if (!diagnostics.disposed || diagnostics.timeoutCount || diagnostics.intervalCount || diagnostics.cleanupCount) failures.push(`${moduleId}: lifecycle cleanup failed`);
  console.log(`${moduleId}: contract=${contractReport.valid} moduleTests=${moduleReport.valid} geometry=${moduleReport.geometry.valid}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("All mixed/remote module checks passed.");
}
