(function installCh02MixedMode3Facade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.moduleFacades.createCh02MixedMode3Facade = (context) => platform.mixedRemoteShared.createControlFacade(platform.mixedRemoteConfigs.ch02_mixed_mode3, context);
})(globalThis);
