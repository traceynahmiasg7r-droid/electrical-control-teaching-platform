(function installCh01TextbookJogDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01TextbookJog = () => {
    const circuitData = platform.moduleCircuitData.ch01JogTextbook;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createCh01JogTextbookFacade({ context, circuitData }),
      meta: {
        schemaVersion: "1.0", chapterId: "ch01", moduleId: "ch01_jog", routeId: "ch01-jog-control",
        order: 1, code: "01", title: "点动控制", shortTitle: "点动控制",
        purpose: "依据教材原图，演示 SB1 按住运行、释放即停的点动控制。",
        simulationLevel: "S2", maturity: "M3", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      },
      aliases: ["ch01_jog", "ch01_jog_textbook"]
    });
  };
})(globalThis);
