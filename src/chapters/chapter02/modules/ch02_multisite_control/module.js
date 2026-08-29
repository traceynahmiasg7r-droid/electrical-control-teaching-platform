(function installMultisiteControlDefinition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02MultisiteControl = () => {
    const circuitData = platform.moduleData.ch02_multisite_control;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createMultisiteControlFacade({ context, circuitData }),
      meta: Object.freeze({
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_multisite_control",
        routeId: "multisite-control",
        order: 6, code: "06",
        title: "多地点远程控制",
        shortTitle: "多地点远程控制",
        purpose: "理解多个启动位置并联、多个停止位置串联时对同一 KM1 与电机的共同控制。",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1", renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch02_multisite_control"]
    });
  };
})(globalThis);
