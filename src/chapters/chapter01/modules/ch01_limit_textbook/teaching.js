(function installCh01LimitTextbookTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const scenarios = Object.freeze([
    { id: "limit_trip", title: "启动、行程触发与复位", description: "SB1 启动并自锁；SQ 动作切断控制回路；复位后必须重新启动。" },
    { id: "overload_trip", title: "启动、过载与复位", description: "FR1 过载使 KM1 释放；FR1 复位只恢复待机条件，不会自动重启。" }
  ]);
  const step = (title, text, actions, focus) => ({ title, text, actions, focus });
  const scripts = {
    limit_trip: [
      step("接通电源", "外部供电闭合，SB1、SB2、SQ 和 FR1 均处于正常状态。", [{ command: "powerClose" }], ["sb1", "sb2", "sq", "fr1_nc"]),
      step("按下启动 SB1", "SB1 常开触点闭合，KM1 线圈得电，主触点与自锁触点闭合，M 建立 ABC 三相通路。", [{ command: "start" }], ["sb1", "km_self", "km_coil", "km_main", "motor"]),
      step("释放 SB1 后自锁", "SB1 恢复常开，但 KM1 自锁触点继续为线圈供电，电动机保持运行。", [{ command: "release", payload: { command: "start" } }], ["sb1", "km_self", "km_coil", "motor"]),
      step("触发 SQ 行程开关", "SQ 常闭触点断开，控制回路失电，KM1 主触点和自锁触点释放，M 停止。", [{ command: "sqTrip" }], ["sq", "km_main", "km_self", "motor"]),
      step("复位 SQ", "SQ 恢复常闭，但 SB1 已释放；控制回路不会自动重新吸合，必须再次按下启动。", [{ command: "sqReset" }], ["sq", "sb1", "km_coil"])
    ],
    overload_trip: [
      step("启动并建立自锁", "接通电源后按下并释放 SB1，KM1 自锁运行。", [{ command: "powerClose" }, { command: "start" }, { command: "release", payload: { command: "start" } }], ["sb1", "km_self", "km_coil", "motor"]),
      step("FR1 过载动作", "FR1 常闭控制触点断开，KM1 失电，主回路释放，电动机停止。", [{ command: "fr1Trip" }], ["fr1_nc", "km_main", "km_coil", "motor"]),
      step("FR1 复位", "FR1 恢复常闭，仅恢复启动条件；由于 SB1 已释放，电动机不会自动重启。", [{ command: "fr1Reset" }], ["fr1_nc", "sb1", "km_coil"])
    ]
  };
  function buildScenario(id, evaluate) {
    if (!scripts[id]) throw new Error(`未知行程开关教学场景: ${id}`);
    let actions = [];
    return scripts[id].map((item, index) => {
      actions = [...actions, ...item.actions];
      return { id: `${id}-${index}`, title: item.title, text: item.text, duration: 1700, displayState: { raw: evaluate({ actions }), teachingFocus: item.focus } };
    });
  }
  function liveFeedback(snapshot, result) {
    const op = snapshot.operation;
    const unexpected = (result.extension?.diagnostics || []).filter((item) => !["LIMIT_TRIGGERED", "OVERLOAD_TRIPPED"].includes(item.code));
    if (unexpected.length) return { title: "行程控制诊断", text: unexpected.map((item) => item.message || item.code).join("；"), tone: "warning" };
    if (op.power !== "closed") return { title: "等待接通电源", text: "先接通外部电源，再按下 SB1 启动。", tone: "warning" };
    if (snapshot.devices.SQ?.triggered) return { title: "SQ 已动作", text: snapshot.devices.SB1?.pressed ? "行程开关常闭触点断开，KM1 释放；SB1 仍按住时，复位 SQ 会按真实回路重新启动。" : "行程开关常闭触点断开，KM1 释放；SB1 已释放，复位后仍需重新按下启动。", tone: "info" };
    if (snapshot.devices.FR1?.tripped) return { title: "FR1 过载", text: snapshot.devices.SB1?.pressed ? "热继电器常闭触点断开，KM1 失电；SB1 仍按住时，复位 FR1 会按真实回路重新启动。" : "热继电器常闭触点断开，KM1 失电；SB1 已释放，FR1 复位不会自动重启。", tone: "warning" };
    if (snapshot.devices.SB1?.pressed && snapshot.motor.running) return { title: "SB1 启动", text: "SB1 闭合，KM1 得电，主触点接通三相电动机。", tone: "info" };
    if (snapshot.motor.running) return { title: "KM1 自锁运行", text: "SB1 已释放，KM1 自锁触点保持线圈得电，M 持续运行。", tone: "info" };
    return { title: "行程开关控制待机", text: "按下启动 SB1，观察 KM1 自锁；动作 SQ 或 FR1 可切断控制回路。", tone: "info" };
  }
  platform.ch01LimitTextbookTeaching = Object.freeze({ scenarios, scenes: scenarios, scripts, buildScenario, liveFeedback });
})(globalThis);
