(function installTimedAutoStopDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01TimedAutoStop = () => {
    const circuitData = platform.moduleData.ch01_timed_auto_stop;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createTimedAutoStopFacade({ context, circuitData }),
      meta: Object.freeze({ schemaVersion: "1.0", chapterId: "ch01", moduleId: "ch01_timed_auto_stop", routeId: "timed-auto-stop", order: 3, code: "03", title: "电机启动后定时自动停止", shortTitle: "定时自动停止", purpose: "观察 KM1 自锁后 KT1、KT2 计时以及 120 秒到时自动切断的因果过程。", simulationLevel: "S2", maturity: "M2", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas", geometryLockId: circuitData.geometryLockId }),
      aliases: ["ch01_timed_auto_stop"]
    });
  };
})(globalThis);
