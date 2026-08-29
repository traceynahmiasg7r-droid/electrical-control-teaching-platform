(function installTwoMotorSequenceDefinition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02TwoMotorSequence = (options) => {
    const circuitData = platform.twoMotorSequenceRuntime.createCircuitData(options.baseCircuitData);
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createTwoMotorSequenceFacade({
        port: platform.twoMotorSequenceRuntime.createPort({ context, circuitData })
      }),
      meta: Object.freeze({
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_two_motor_sequence",
        routeId: "two-motor-sequence",
        order: 8,
        code: "08",
        title: "两台电动机顺序控制",
        shortTitle: "两电机顺序控制",
        purpose: "观察 1M 启动后 KM1 顺序允许触点闭合，2M 才能启动的控制过程。",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1",
        renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch02_two_motor_sequence"]
    });
  };
})(globalThis);
