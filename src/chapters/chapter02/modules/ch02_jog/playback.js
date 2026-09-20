(function installJogPlayback(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.createJogPlayback = (options) => platform.createReversePlayback({
    ...options,
    teaching: platform.ch02JogTeaching
  });
})(globalThis);
