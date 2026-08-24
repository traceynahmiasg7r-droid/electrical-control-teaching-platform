(function installCh02MultiStationDefinition(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};
  const config = platform.mixedRemoteConfigs.ch02_multi_station;
  platform.moduleDefinitions.createCh02MultiStation = () => platform.facadeAdapter.createFacadeModuleDefinition({
    circuitData: config.circuitData,
    createFacade: (context) => platform.moduleFacades.createCh02MultiStationFacade(context),
    meta: {
      schemaVersion: "1.0", chapterId: "ch02", moduleId: config.moduleId, routeId: config.routeId,
      order: 8, code: "08", title: config.title, shortTitle: "多地点控制", simulationLevel: "S2",
      maturity: "M3", status: "ready", integrationMode: "facade-v1", geometryLockId: config.geometryLockId
    },
    aliases: [config.moduleId]
  });
})(globalThis);
