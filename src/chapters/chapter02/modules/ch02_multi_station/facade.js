(function installCh02MultiStationFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.moduleFacades.createCh02MultiStationFacade = (context) => platform.mixedRemoteShared.createControlFacade(platform.mixedRemoteConfigs.ch02_multi_station, context);
})(globalThis);
