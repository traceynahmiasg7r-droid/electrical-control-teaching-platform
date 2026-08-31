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
  "src/components/electrical-simulation-primitives.js",
  path.relative(repo, path.join(moduleDir, "circuit.data.js")),
  path.relative(repo, path.join(moduleDir, "runtime.js")),
  path.relative(repo, path.join(moduleDir, "renderer.js")),
  path.relative(repo, path.join(moduleDir, "facade.js")),
  path.relative(repo, path.join(moduleDir, "module.js"))
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(repo, file), "utf8"), context, { filename: file }));

const platform = context.ECTPPlatform;
const definition = platform.moduleDefinitions.createCh01ReverseControl();
const mountRoot = { innerHTML: "", replaceChildren() { this.innerHTML = ""; }, get firstElementChild() { return { classList: { add() {} } }; } };
const moduleInstance = definition.create({ mountRoot, services: { renderShell() {} } });
platform.contracts.assertModuleContract(moduleInstance);
platform.contracts.assertFacadeOutputs(moduleInstance);
const behavior = moduleInstance.runTests();
if (!behavior.valid) throw new Error(JSON.stringify(behavior.results, null, 2));
moduleInstance.dispatchAction("POWER_CLOSE");
moduleInstance.dispatchAction("START_FORWARD_PRESS");
if (moduleInstance.getStateSnapshot().motor.direction !== "forward") throw new Error("Facade action did not start forward rotation");
moduleInstance.dispatchAction("STOP_PRESS");
moduleInstance.dispatchAction("START_REVERSE_PRESS");
if (moduleInstance.getStateSnapshot().motor.direction !== "reverse") throw new Error("Facade action did not start reverse rotation");
moduleInstance.mount(); moduleInstance.render();
if (!mountRoot.innerHTML.includes('data-module="ch01_reverse_control"') || !mountRoot.innerHTML.includes("KM2 互锁 NC") || !mountRoot.innerHTML.includes("三相异步电动机")) throw new Error("Central circuit renderer did not mount the reverse circuit");
console.log(JSON.stringify({ moduleId: definition.meta.moduleId, contract: "pass", facade: "pass", behavior }, null, 2));
