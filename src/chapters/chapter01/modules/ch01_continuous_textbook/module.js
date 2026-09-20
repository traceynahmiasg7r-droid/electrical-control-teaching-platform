(function installCh01TextbookContinuousDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01TextbookContinuous = () => {
    const circuitData = platform.moduleCircuitData.ch01ContinuousTextbook;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createCh01ContinuousTextbookFacade({ context, circuitData }),
      meta: {
        schemaVersion: "1.0", chapterId: "ch01", moduleId: "ch01_continuous", routeId: "ch01-continuous-control",
        order: 6, code: "06", title: "长动控制", shortTitle: "长动控制",
        purpose: "依据教材原图，演示 SB1 启动、KM 辅助触点自锁、SB2 停止的长动控制。",
        simulationLevel: "S2", maturity: "M3", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      },
      aliases: ["ch01_continuous", "ch01_continuous_textbook"]
    });
  };
})(globalThis);
