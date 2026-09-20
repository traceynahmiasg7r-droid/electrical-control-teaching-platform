(function installContinuousPlayback(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.createContinuousPlayback = (options) => platform.createReversePlayback({ ...options, teaching: platform.ch02ContinuousTeaching });
})(globalThis);
