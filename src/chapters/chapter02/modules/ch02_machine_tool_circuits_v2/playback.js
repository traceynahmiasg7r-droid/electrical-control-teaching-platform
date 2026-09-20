(function installMachineToolV2Playback(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.createMachineToolV2Playback = (options = {}) => {
    const teaching = platform.machineToolV2Teaching || {};
    return platform.createReversePlayback({
      ...options,
      teaching: {
        ...teaching,
        scenarios: teaching.scenarios || teaching.scenes || []
      }
    });
  };
})(globalThis);
