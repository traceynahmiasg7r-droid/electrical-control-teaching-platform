(function installCh02MixedMode1Definition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  const config = platform.mixedRemoteConfigs.ch02_mixed_mode1;
  platform.moduleDefinitions.createCh02MixedMode1 = () => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: config.circuitData,
    createFacade: (context) => platform.moduleFacades.createCh02MixedMode1Facade(context),
    meta: {
      schemaVersion: "1.0", chapterId: "ch02", moduleId: config.moduleId, routeId: config.routeId,
      order: 5, code: "05", title: config.title, shortTitle: "混合控制一", simulationLevel: "S2",
      maturity: "M3", status: "ready", integrationMode: "facade-v1", geometryLockId: config.geometryLockId
    },
    aliases: [config.moduleId]
  });
})(globalThis);
