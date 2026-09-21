(function installCh02MultiStationData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.mixedRemoteConfigs = platform.mixedRemoteConfigs || {};
  const moduleId = "ch02_multi_station";
  const config = {
    moduleId,
    routeId: "multi-station",
    variant: "multi",
    title: "多地点远程控制",
    purpose: "验证启动按钮并联、停止按钮串联的因果关系，并同步展示两只运行指示灯。",
    reference: "原图15 · 第二章第39页",
    geometryLockId: "ch02_multi_station_geometry_v1_locked",
    primaryStartMessage: "第一地点启动按钮动作，并联启动支路使 KM1 建立自锁。",
    primaryStopMessage: "第一地点停止按钮动作，串联停止链断开。",
    jogPressMessage: "本模块不使用点动动作。",
    jogReleaseMessage: "本模块不使用点动动作。",
    runReason: "任一地点启动按钮曾建立 KM1 自锁，且两处停止按钮与 FR1 均保持闭合。",
    controls: [
      { id: "station1Start", slot: "primary", visible: true, label: "1SB1 启动", buttonClass: "forward", action: "START_PRIMARY_PRESS", help: "第一地点的并联启动支路。" },
      { id: "station1Stop", slot: "secondary", visible: true, label: "1SB2 停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS", help: "第一地点串联停止触点。" },
      { id: "station2Start", slot: "tertiary", visible: true, label: "2SB1 启动", buttonClass: "forward", action: "START_SECONDARY_PRESS", help: "第二地点的并联启动支路。" },
      { id: "station2Stop", slot: "quaternary", visible: true, label: "2SB2 停止", buttonClass: "stop", action: "STOP_SECONDARY_PRESS", help: "第二地点串联停止触点。" }
    ],
    replay: [
      { id: "stops", title: "检查串联停止链", description: "1SB2、2SB2 与 FR1 任一断开都会切断 KM1。" },
      { id: "starts", title: "任选地点启动", description: "1SB1、2SB1 与 KM1 自锁触点构成并联启动网络。" },
      { id: "indicators", title: "观察 HL1/HL2", description: "两灯只读取 Solver 的 motorRunning 结果，不参与求解。" }
    ]
  };
  config.circuitData = platform.mixedRemoteShared.buildCircuitData(config);
  platform.mixedRemoteConfigs[moduleId] = Object.freeze(config);
})(globalThis);
