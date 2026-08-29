(function installMixedControlDefinition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02MixedControl = () => {
    const circuitData = platform.moduleData.ch02_mixed_control;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createMixedControlFacade({ context, circuitData }),
      meta: Object.freeze({
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_mixed_control",
        routeId: "mixed-control",
        order: 5, code: "05",
        title: "点动与长动混合控制",
        shortTitle: "点动/长动混合控制",
        purpose: "比较三种点动与长动混合接线，观察自锁、点动和继电器 K 的因果差异。",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1", renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch02_mixed_control"]
    });
  };
})(globalThis);
