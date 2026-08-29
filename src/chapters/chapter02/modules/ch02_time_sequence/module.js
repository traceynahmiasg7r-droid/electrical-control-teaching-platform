(function installTimeSequenceDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh02TimeSequence = () => {
    const circuitData = platform.moduleData.ch02_time_sequence;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createTimeSequenceFacade({ context, circuitData }),
      meta: Object.freeze({ schemaVersion: "1.0", chapterId: "ch02", moduleId: "ch02_time_sequence", routeId: "time-sequence-control", order: 10, code: "10", title: "时间原则控制线路", shortTitle: "时间原则控制", purpose: "观察 KT1、KT2、KT3 依次动作并逐级切除转子电阻的时间原则启动过程。", simulationLevel: "S2", maturity: "M2", status: "ready", integrationMode: "facade-v1", renderTarget: "module-canvas", geometryLockId: circuitData.geometryLockId }),
      aliases: ["ch02_time_sequence"]
    });
  };
})(globalThis);
