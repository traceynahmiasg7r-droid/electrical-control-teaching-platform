const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "../../../../../..");
const moduleDir = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
context.globalThis = context;
[
  "src/schemas/module-contract.js",
  "src/platform/module-adapter/facade-module-adapter.js",
  path.relative(repo, path.join(moduleDir, "circuit.data.js")),
  path.relative(repo, path.join(moduleDir, "runtime.js")),
  path.relative(repo, path.join(moduleDir, "facade.js")),
  path.relative(repo, path.join(moduleDir, "module.js"))
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(repo, file), "utf8"), context, { filename: file }));

const platform = context.ECTPPlatform;
const definition = platform.moduleDefinitions.createCh01OverloadProtection();
const moduleInstance = definition.create({});
platform.contracts.assertModuleContract(moduleInstance);
platform.contracts.assertFacadeOutputs(moduleInstance);
const behavior = moduleInstance.runTests();
if (!behavior.valid) throw new Error(JSON.stringify(behavior.results, null, 2));
moduleInstance.dispatchAction("POWER_CLOSE");
moduleInstance.dispatchAction("START_PRIMARY_PRESS");
moduleInstance.dispatchAction("PROTECTION_TOGGLE");
if (moduleInstance.getStateSnapshot().motor.state !== "fault") throw new Error("Overload did not stop motor in fault state");
moduleInstance.dispatchAction("PROTECTION_RESET");
if (moduleInstance.getStateSnapshot().motor.running) throw new Error("Protection reset restarted motor unexpectedly");
console.log(JSON.stringify({ moduleId: definition.meta.moduleId, contract: "pass", facade: "pass", behavior }, null, 2));
