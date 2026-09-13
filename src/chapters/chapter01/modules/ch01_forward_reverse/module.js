(function installCh01ForwardReverseDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01ForwardReverse = () => {
    const circuitData = platform.moduleData.ch01_forward_reverse;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createCh01ForwardReverseFacade({ context, circuitData }),
      meta: Object.freeze({
        schemaVersion: "1.0", chapterId: "ch01", moduleId: "ch01_forward_reverse", routeId: "ch01-forward-reverse",
        order: 4, code: "04", title: "正反转控制（第一章 61）", shortTitle: "正反转控制",
        purpose: "按照第一章第61页观察A—N控制电源、KM1/KM2自锁互锁及ABC/CBA换相。",
        simulationLevel: "S2", maturity: "M3", status: "ready", integrationMode: "facade-v1",
        renderTarget: "module-canvas", geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch01_forward_reverse"]
    });
  };
})(globalThis);
