(function installCh02MixedMode1Facade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.moduleFacades.createCh02MixedMode1Facade = (context) => platform.mixedRemoteShared.createControlFacade(platform.mixedRemoteConfigs.ch02_mixed_mode1, context);
})(globalThis);
