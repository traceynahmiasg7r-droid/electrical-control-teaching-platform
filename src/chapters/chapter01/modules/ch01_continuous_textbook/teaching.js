(function installCh01ContinuousTextbookTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const scenarios = Object.freeze([
    { id: "self_hold", title: "长动：启动、自锁、停止", description: "SB1 启动后松开，KM 自锁触点继续供电；按下 SB2 常闭停止按钮，KM 释放。" },
    { id: "power_restore", title: "失压与恢复供电", description: "运行中的电路断电停止；恢复供电时，只有仍按住 SB1 才会重新吸合，启动按钮已释放则不会自动重启。" }
  ]);
  const step = (title, text, actions, focus) => ({ title, text, actions, focus });
  const scripts = {
    self_hold: [
      step("观察教材电路", "主电路为 A、B、C 经 KM 三个主触点连接电动机 M；控制回路为 A—（SB1 常开与 KM 自锁常开并联）—SB2 常闭—KM 线圈—N。", [], ["sb1", "km_self", "sb2", "km_coil", "motor"]),
      step("接通外部电源", "外部供电接通；按钮均释放，KM 线圈未得电。电源操作表示供电环境，不在教材图中增画 QF。", [{ command: "powerClose" }], ["sb1", "sb2", "km_coil"]),
      step("按下启动 SB1", "SB1 常开触点闭合，KM 线圈得电，主触点闭合，电动机 M 运行；KM 自锁触点同时闭合。", [{ command: "start" }], ["sb1", "km_self", "km_coil", "km_main", "motor"]),
      step("松开 SB1，保持运行", "SB1 恢复断开，但 KM 自锁常开触点跨接 SB1 保持线圈通路，M 继续运行。", [{ command: "release", payload: { command: "start" } }], ["sb1", "km_self", "km_coil", "motor"]),
      step("按下停止 SB2", "SB2 常闭触点断开，KM 线圈立即失电；主触点和自锁触点释放，M 停止。", [{ command: "stop" }], ["sb2", "km_self", "km_main", "motor"]),
      step("松开 SB2", "SB2 恢复闭合；由于 SB1 已释放且自锁已断开，KM 不会自动重新吸合。", [{ command: "release", payload: { command: "stop" } }], ["sb2", "km_self", "km_coil"])
    ],
    power_restore: [
      step("启动并建立自锁", "接通外部电源，按住 SB1 后松开；KM 通过自锁触点保持，M 持续运行。", [{ command: "powerClose" }, { command: "start" }, { command: "release", payload: { command: "start" } }], ["km_self", "km_coil", "motor"]),
      step("外部电源失压", "供电环境断开，KM 失电、主触点释放，M 停止；SB1 已释放。", [{ command: "powerOpen" }], ["sb1", "km_main", "km_coil", "motor"]),
      step("恢复供电，不自动重启", "外部电源恢复，但 SB1 已释放；自锁触点无法凭空建立，KM 与 M 保持停止。", [{ command: "powerClose" }], ["sb1", "km_self", "motor"]),
      step("重新按住 SB1", "再次按下 SB1，控制回路闭合，KM 得电并重新建立自锁，M 运行。", [{ command: "start" }], ["sb1", "km_self", "km_coil", "motor"]),
      step("释放 SB1", "松开 SB1 后仍由 KM 自锁触点保持运行。", [{ command: "release", payload: { command: "start" } }], ["sb1", "km_self", "motor"]),
      step("按下并释放 SB2", "停止按钮断开控制回路；释放后不会自动重启，必须再次按 SB1。", [{ command: "stop" }, { command: "release", payload: { command: "stop" } }], ["sb2", "km_self", "km_main", "motor"])
    ]
  };
  function buildScenario(id, evaluate) {
    if (!scripts[id]) throw new Error(`未知长动教学场景: ${id}`);
    let actions = [];
    return scripts[id].map((item, index) => {
      actions = [...actions, ...item.actions];
      return { id: `${id}-${index}`, title: item.title, text: item.text, duration: 1700, displayState: { raw: evaluate({ actions }), teachingFocus: item.focus } };
    });
  }
  function liveFeedback(snapshot, result) {
    const op = snapshot.operation, heldStart = op.controls.sb1 === "pressed", heldStop = op.controls.sb2 === "pressed";
    if (result.extension?.diagnostics?.length) return { title: "长动回路诊断", text: result.extension.diagnostics.map((item) => item.message || item.code || item).join("；"), tone: "warning" };
    if (op.power !== "closed") return { title: "外部电源未接通", text: heldStart ? "SB1 仍按住，但外部电源断开；KM 线圈与 M 无法得电。恢复供电后，若 SB1 仍按住，真实回路会重新启动。" : "先接通外部电源。图中没有额外 QF、FR 或 FU。", tone: "warning" };
    if (heldStop) return { title: "按下停止 SB2", text: "SB2 常闭触点断开，停止优先于启动；KM 线圈失电，主触点和自锁触点释放。", tone: "info" };
    if (result.motorStates.M?.running) return { title: heldStart ? "按住启动 SB1" : "KM 自锁运行", text: heldStart ? "SB1 常开触点闭合，KM 得电并吸合主触点；继续按住或松开后观察自锁。" : "SB1 已松开，KM 自锁常开触点仍维持线圈通路，M 继续运行。", tone: "info" };
    if (heldStart) return { title: "SB1 已按下但未运行", text: "SB1 触点已闭合，但当前供电或停止回路尚未形成完整通路。", tone: "warning" };
    return { title: "长动待机", text: "SB1 已释放、SB2 常闭恢复；按住 SB1 启动，松开后由 KM 自锁保持，按住 SB2 停止。", tone: "info" };
  }
  platform.ch01ContinuousTextbookTeaching = Object.freeze({ scenarios, scenes: scenarios, scripts, buildScenario, liveFeedback });
})(globalThis);
