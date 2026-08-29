(function installCh02ReverseBrakingDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02ReverseBraking = (options = {}) => {
    const circuitData = options.circuitData || platform.moduleData?.ch02_reverse_braking;
    if (!circuitData) throw new Error("ch02_reverse_braking circuitData is missing; load facade.js before module.js");
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createReverseBrakingFacade({ context, circuitData }),
      meta: Object.freeze({
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_reverse_braking",
        routeId: "reverse-braking",
        order: 5,
        code: "05",
        title: "反接制动控制",
        shortTitle: "反接制动控制",
        purpose: "按下启动按钮时，KM1 线圈得电使电机运行；按下停止按钮后，KS 检测后续转速，KM2 线圈得电实现反接制动，电机反向制动直至停止。",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1",
        renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch02_reverse_braking", "reverse-braking"]
    });
  };
})(globalThis);
