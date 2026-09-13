(function installCh02MixedMode2Facade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.moduleFacades.createCh02MixedMode2Facade = (context) => platform.mixedRemoteShared.createControlFacade(platform.mixedRemoteConfigs.ch02_mixed_mode2, context);
})(globalThis);
