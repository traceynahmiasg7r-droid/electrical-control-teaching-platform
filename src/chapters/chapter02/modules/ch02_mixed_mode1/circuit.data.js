(function installCh02MixedMode1Data(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.mixedRemoteConfigs = platform.mixedRemoteConfigs || {};
  const moduleId = "ch02_mixed_mode1";
  const config = {
    moduleId,
    routeId: "mixed-mode-1",
    variant: "mode1",
    title: "点动和长动混合控制（方式一）",
    purpose: "通过 SA 转换开关选择点动或长动，比较同一 SB1 在两种模式下的状态差异。",
    reference: "原图12 · 第二章第35页",
    geometryLockId: "ch02_mixed_mode1_geometry_v1_locked",
    primaryStartMessage: "SB1 完成一次按下/释放；是否保持由 SA 与 KM1 自锁支路决定。",
    primaryStopMessage: "SB2 常闭触点短时断开，解除 KM1 自锁。",
    jogPressMessage: "SB1 正在按下；点动模式下 KM1 只在按住期间得电。",
    jogReleaseMessage: "SB1 已释放；点动模式不保留 KM1 状态。",
    runReason: "SB1 当前按下，或 SA 处于长动且 KM1 辅助常开已形成自锁。",
    controls: [
      { id: "sb1", slot: "primary", visible: true, label: "SB1 点动/启动", buttonClass: "forward", action: "START_PRIMARY_PRESS", help: "点动模式需持续按压；长动模式完成一次启动后由自锁保持。" },
      { id: "sb2", slot: "secondary", visible: true, label: "SB2 停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS", help: "断开控制回路并解除自锁。" },
      { id: "sa", slot: "tertiary", visible: true, label: "SA 模式切换", buttonClass: "neutral", action: "START_SECONDARY_PRESS", help: "在点动与长动之间切换，不直接写入 KM1 或电机状态。" },
      { id: "hold", slot: "quaternary", visible: true, label: "按住 SB1（画布）", buttonClass: "neutral", action: "JOG_PRESS", help: "用于观察点动按住期间的真实导通路径。" }
    ],
    replay: [
      { id: "selector", title: "选择 SA 模式", description: "SA 只决定自锁支路是否可用。" },
      { id: "start", title: "操作 SB1", description: "点动时按住运行；长动时一次启动即可建立自锁。" },
      { id: "stop", title: "按下 SB2", description: "停止按钮切断控制通路，KM1 释放。" }
    ]
  };
  config.circuitData = platform.mixedRemoteShared.buildCircuitData(config);
  platform.mixedRemoteConfigs[moduleId] = Object.freeze(config);
})(globalThis);
