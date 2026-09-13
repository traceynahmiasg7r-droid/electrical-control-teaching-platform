(function installCh01ForwardReverseFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch01_forward_reverse";
  const ROUTE_ID = "ch01-forward-reverse";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function identify(value) {
    const output = clone(value);
    if (output && typeof output === "object") {
      if (Object.prototype.hasOwnProperty.call(output, "moduleId")) output.moduleId = MODULE_ID;
      if (Object.prototype.hasOwnProperty.call(output, "routeId")) output.routeId = ROUTE_ID;
      ["state", "solverResult", "operationViewModel", "statusViewModel"].forEach((key) => {
        if (output[key] && typeof output[key] === "object") output[key].moduleId = MODULE_ID;
        if (key === "state" && output[key]) output[key].routeId = ROUTE_ID;
      });
    }
    return output;
  }

  platform.moduleFacades.createCh01ForwardReverseFacade = (options) => {
    const source = platform.moduleFacades.createReverseFacade(options);
    return Object.freeze({
      createInitialState: () => identify(source.createInitialState()),
      getStateSnapshot: () => identify(source.getStateSnapshot()),
      dispatchAction: (action) => identify(source.dispatchAction(action)),
      solve: (message) => identify(source.solve(message)),
      normalizeSolverResult: () => identify(source.normalizeSolverResult()),
      getOperationViewModel: () => identify(source.getOperationViewModel()),
      getStatusViewModel: () => identify(source.getStatusViewModel()),
      buildTeachingFeedback: () => identify(source.buildTeachingFeedback()),
      buildReplaySteps: () => identify(source.buildReplaySteps()),
      mount: (context) => source.mount(context),
      render: () => source.render(),
      reset: () => identify(source.reset()),
      pause: (context) => source.pause(context),
      resume: (context) => source.resume(context),
      unmount: (context) => source.unmount(context),
      validateGeometry: () => source.validateGeometry(),
      runTests: () => source.runTests()
    });
  };
})(globalThis);
