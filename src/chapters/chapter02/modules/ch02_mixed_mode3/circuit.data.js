(function installCh02MixedMode3Data(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.mixedRemoteConfigs = platform.mixedRemoteConfigs || {};
  const moduleId = "ch02_mixed_mode3";
  const config = {
    moduleId,
    routeId: "mixed-mode-3",
    variant: "mode3",
    title: "点动和长动混合控制（方式三）",
    purpose: "以中间继电器 K 保存长动命令，SB3 直接驱动 KM1 点动，分离记忆与执行职责。",
    reference: "原图14 · 第二章第37页",
    geometryLockId: "ch02_mixed_mode3_geometry_v1_locked",
    primaryStartMessage: "SB1 启动脉冲使继电器 K 得电并由 K 辅助常开自锁。",
    primaryStopMessage: "SB2 切断 K 线圈回路，K 与 KM1 均复位。",
    jogPressMessage: "SB3 按下：其 NC 使 K 失电，同时 NO 直接给 KM1 提供点动通路。",
    jogReleaseMessage: "SB3 释放：直接点动通路断开；K 已失去自锁，不会自动恢复。",
    runReason: "K 的执行常开触点已闭合，或 SB3 的点动 NO 正在按住导通。",
    controls: [
      { id: "sb1", slot: "primary", visible: true, label: "SB1 长动启动", buttonClass: "forward", action: "START_PRIMARY_PRESS", help: "使中间继电器 K 建立自锁。" },
      { id: "sb2", slot: "secondary", visible: true, label: "SB2 停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS", help: "切断 K 线圈控制链。" },
      { id: "sb3", slot: "tertiary", visible: true, label: "SB3 点动", buttonClass: "neutral", action: "JOG_PRESS", help: "释放 K 记忆并直接点动 KM1。" },
      { id: "unused", slot: "quaternary", visible: false }
    ],
    replay: [
      { id: "relay", title: "SB1 启动 K", description: "K 线圈得电，K 自锁触点保存长动命令。" },
      { id: "execute", title: "K 驱动 KM1", description: "K 的另一组常开触点闭合，KM1 得电。" },
      { id: "jog", title: "SB3 点动", description: "SB3 先释放 K，再直接给 KM1 提供瞬时通路。" }
    ]
  };
  config.circuitData = platform.mixedRemoteShared.buildCircuitData(config);
  platform.mixedRemoteConfigs[moduleId] = Object.freeze(config);
})(globalThis);
