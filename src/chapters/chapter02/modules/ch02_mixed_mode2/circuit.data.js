(function installCh02MixedMode2Data(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.mixedRemoteConfigs = platform.mixedRemoteConfigs || {};
  const moduleId = "ch02_mixed_mode2";
  const config = {
    moduleId,
    routeId: "mixed-mode-2",
    variant: "mode2",
    title: "点动和长动混合控制（方式二）",
    purpose: "SB1 建立长动自锁；复合按钮 SB3 通过 NO/NC 联动实现不误自锁的点动。",
    reference: "原图13 · 第二章第36页",
    geometryLockId: "ch02_mixed_mode2_geometry_v1_locked",
    primaryStartMessage: "SB1 启动脉冲使 KM1 得电，并由 KM1 辅助常开建立长动自锁。",
    primaryStopMessage: "SB2 常闭触点短时断开，KM1 与电机停止。",
    jogPressMessage: "SB3 按下：其 NC 先断自锁，NO 后接通点动路径。",
    jogReleaseMessage: "SB3 释放：NO 先断使 KM1 释放，NC 后复位，因此不会误建立自锁。",
    runReason: "SB1 已建立 KM1 自锁，或 SB3 的点动 NO 正在按住导通。",
    controls: [
      { id: "sb1", slot: "primary", visible: true, label: "SB1 长动启动", buttonClass: "forward", action: "START_PRIMARY_PRESS", help: "一次按下后由 KM1 辅助常开自锁。" },
      { id: "sb2", slot: "secondary", visible: true, label: "SB2 停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS", help: "切断串联控制链。" },
      { id: "sb3", slot: "tertiary", visible: true, label: "SB3 点动", buttonClass: "neutral", action: "JOG_PRESS", help: "NO/NC 机械联动，点动期间抑制自锁。" },
      { id: "unused", slot: "quaternary", visible: false }
    ],
    replay: [
      { id: "long", title: "SB1 长动路径", description: "SB1 使 KM1 得电，KM1 辅助常开接替 SB1。" },
      { id: "compound", title: "SB3 复合点动", description: "NC 先断开自锁，再由 NO 提供点动通路。" },
      { id: "release", title: "释放 SB3", description: "NO 先断、NC 后合，避免 KM1 辅助触点重新自锁。" }
    ]
  };
  config.circuitData = platform.mixedRemoteShared.buildCircuitData(config);
  platform.mixedRemoteConfigs[moduleId] = Object.freeze(config);
})(globalThis);
