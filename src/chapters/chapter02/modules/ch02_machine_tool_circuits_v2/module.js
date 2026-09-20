(function installMachineToolV2Definition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02MachineToolCircuitsV2 = () => {
    const circuitData = platform.moduleCircuitData.ch02MachineToolCircuitsV2;
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => platform.moduleFacades.createMachineToolCircuitsV2Facade({ context, circuitData }),
      meta: Object.freeze({
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_machine_tool_circuits_v2",
        routeId: "machine-tool-circuits",
        order: 7,
        code: "07",
        title: "Z3040 机床综合线路",
        shortTitle: "Z3040 综合线路",
        purpose: "按教材原图数字化主回路、控制回路与辅助回路，由 Solver 驱动全部元件状态。",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1",
        renderTarget: "module-canvas",
        geometryLockId: circuitData.geometryLockId
      }),
      aliases: ["ch02_machine_tool_circuits_v2", "ch02_machine_tool_circuits"]
    });
  };
})(globalThis);
