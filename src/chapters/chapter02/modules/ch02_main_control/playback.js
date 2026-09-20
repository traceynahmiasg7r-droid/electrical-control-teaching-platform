(function installMainControlPlayback(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.createMainControlPlayback = (options) => platform.createReversePlayback({
    ...options,
    teaching: platform.mainControlTeaching
  });
})(globalThis);
