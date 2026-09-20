(function installCh01TextbookLimitDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01TextbookLimit = () => {
    const circuitData = platform.moduleCircuitData.ch01LimitTextbook;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createCh01LimitTextbookFacade({ context, circuitData }),
      meta: {
        schemaVersion: "1.0", chapterId: "ch01", moduleId: "ch01_limit", routeId: "ch01-limit-switch-control",
        order: 7, code: "07", title: "行程开关控制", shortTitle: "行程开关控制",
        purpose: "依据教材原图演示 SB1 自锁、SQ 行程触发和 FR1 过载保护。",
        simulationLevel: "S2", maturity: "M3", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      },
      aliases: ["ch01_limit", "ch01_limit_textbook"]
    });
  };
})(globalThis);
