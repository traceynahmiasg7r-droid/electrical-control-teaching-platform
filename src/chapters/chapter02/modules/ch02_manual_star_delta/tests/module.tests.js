(function installManualStarDeltaModuleTests(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleTests = platform.moduleTests || {};
  platform.moduleTests.ch02_manual_star_delta = function run(instance) {
    const contract = platform.contracts.validateModuleContract(instance);
    let facade = { valid: false, errors: ["contract invalid"] };
    if (contract.valid) { try { platform.contracts.assertFacadeOutputs(instance); facade = { valid: true, errors: [] }; } catch (error) { facade = { valid: false, errors: [String(error.message || error)] }; } }
    const geometry = instance.validateGeometry(); const solver = instance.runTests();
    return { moduleId: "ch02_manual_star_delta", passed: contract.valid && facade.valid && geometry.valid && solver.passed === solver.total, contract, facade, geometry, solver };
  };
})(globalThis);
