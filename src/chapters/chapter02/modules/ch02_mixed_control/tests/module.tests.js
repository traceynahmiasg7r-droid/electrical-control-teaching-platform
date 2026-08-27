(function installMixedControlModuleTests(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleTests = platform.moduleTests || {};

  platform.moduleTests.ch02_mixed_control = function runMixedControlModuleTests(instance) {
    const contract = platform.contracts.validateModuleContract(instance);
    const facade = contract.valid ? (() => {
      try { platform.contracts.assertFacadeOutputs(instance); return { valid: true, errors: [] }; }
      catch (error) { return { valid: false, errors: [String(error.message || error)] }; }
    })() : { valid: false, errors: ["contract invalid"] };
    const geometry = instance.validateGeometry();
    const solver = instance.runTests();
    return {
      moduleId: "ch02_mixed_control",
      passed: contract.valid && facade.valid && geometry.valid && solver.passed === solver.total,
      contract,
      facade,
      geometry,
      solver
    };
  };
})(globalThis);
