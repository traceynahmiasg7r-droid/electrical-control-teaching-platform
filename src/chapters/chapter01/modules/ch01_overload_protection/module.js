(function installCh01OverloadProtectionDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  platform.moduleDefinitions.createCh01OverloadProtection = () => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: platform.chapterCircuitData.ch01OverloadProtection,
    createFacade: () => platform.moduleFacades.createCh01OverloadProtectionFacade(),
    meta: {
      schemaVersion: "1.0",
      chapterId: "ch01",
      moduleId: "ch01_overload_protection",
      routeId: "ch01-overload-protection",
      order: 5,
      code: "05",
      title: "过载保护（第一章 113）",
      shortTitle: "过载保护",
      simulationLevel: "S2",
      maturity: "M3",
      status: "ready",
      integrationMode: "facade-v1",
      renderTarget: "module-canvas",
      geometryLockId: "ch01_overload_protection_geometry_v1_locked"
    },
    aliases: ["ch01_overload_protection"]
  });
})(globalThis);
