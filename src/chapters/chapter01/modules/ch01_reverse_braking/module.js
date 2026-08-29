(function installCh01ReverseBrakingDefinition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh01ReverseBraking = () => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: platform.chapterCircuitData.ch01ReverseBraking,
    createFacade: () => platform.moduleFacades.createCh01ReverseBrakingFacade(),
    meta: {
      schemaVersion: "1.0",
      chapterId: "ch01",
      moduleId: "ch01_reverse_braking",
      routeId: "ch01-reverse-braking",
      order: 4,
      code: "04",
      title: "反接制动控制",
      shortTitle: "反接制动控制",
      simulationLevel: "S2",
      maturity: "M3",
      status: "ready",
      integrationMode: "facade-v1",
      renderTarget: "module-canvas",
      geometryLockId: "ch01_reverse_braking_geometry_v2_two_file_locked"
    },
    aliases: ["ch01_reverse_braking", "reverse-braking"]
  });
})(globalThis);
