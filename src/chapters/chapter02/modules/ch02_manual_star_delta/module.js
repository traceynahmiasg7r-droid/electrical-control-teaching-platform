(function installManualStarDeltaDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh02ManualStarDelta = () => {
    const circuitData = platform.moduleData.ch02_manual_star_delta;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createManualStarDeltaFacade({ context, circuitData }),
      meta: Object.freeze({ schemaVersion: "1.0", chapterId: "ch02", moduleId: "ch02_manual_star_delta", routeId: "manual-star-delta", order: 9, code: "09", title: "手动星形—三角形启动", shortTitle: "手动星—三角启动", purpose: "通过星形按钮启动、三角形按钮切换和停止按钮，观察互锁与绕组连接变化。", simulationLevel: "S2", maturity: "M2", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas", geometryLockId: circuitData.geometryLockId }),
      aliases: ["ch02_manual_star_delta"]
    });
  };
})(globalThis);
