(function installCh01ForwardReverseDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01ForwardReverse = (options) => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: options.circuitData,
    createFacade: () => platform.moduleFacades.createCh01ForwardReverseFacade({ port: options.port }),
    meta: {
      schemaVersion: "1.0",
      chapterId: "ch01",
      moduleId: "ch01_forward_reverse",
      routeId: "ch01-forward-reverse",
      order: 4,
      code: "04",
      title: "正反转控制（第一章 61）",
      shortTitle: "正反转控制",
      simulationLevel: "S2",
      maturity: "M3",
      status: "ready",
      integrationMode: "facade-v1",
      geometryLockId: "forward_reverse_geometry_v1_locked"
    },
    aliases: ["ch01_forward_reverse"]
  });
})(globalThis);
