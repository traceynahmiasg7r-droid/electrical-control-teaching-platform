(function installReverseDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh02Reverse = (options) => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: options.circuitData,
    createFacade: (context) => platform.moduleFacades.createReverseFacade({ context, circuitData: options.circuitData, port: options.port }),
    meta: {
      schemaVersion: "1.0",
      chapterId: "ch02",
      moduleId: "ch02_reverse",
      routeId: "forward-reverse",
      order: 4,
      code: "04",
      title: "正反转控制",
      shortTitle: "正反转控制",
      simulationLevel: "S2",
      maturity: "M3",
      status: "ready",
      integrationMode: "facade-v1",
      renderTarget: "module-canvas",
      geometryLockId: options.circuitData.geometryLockId
    },
    aliases: ["ch02_reverse"]
  });
})(globalThis);
