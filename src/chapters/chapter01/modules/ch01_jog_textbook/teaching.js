(function installCh01JogTextbookTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const scenarios = Object.freeze([{ id: "jog", title: "点动：按住运行，松开停止" }]);
  const script = Object.freeze([
    { title: "观察教材电路", text: "主电路是 A、B、C 三相经 KM 主触点连接电动机 M；控制电路是 A—SB1—KM 线圈—N。图中没有自锁支路。", actions: [], focus: ["sb1", "km_main", "km_coil", "motor"] },
    { title: "接通外部电源", text: "外部供电已接通。SB1 仍为断开状态，KM 线圈没有闭合通路，主触点保持断开，电动机停止。电源操作表示供电环境，不在原图中增画开关。", actions: [{ command: "powerClose" }], focus: ["sb1", "km_coil"] },
    { title: "按下点动按钮 SB1", text: "SB1 常开触点闭合，控制电流沿 A—SB1—KM 线圈—N 流过，KM 线圈得电。三相主触点联动闭合，电动机开始运行。", actions: [{ command: "jog" }], focus: ["sb1", "km_coil", "km_main", "motor"] },
    { title: "保持按住", text: "只有持续按住 SB1，控制回路才能保持导通。当前红色线路和闭合触点均来自 Solver 的真实负载通路，绿色提示 KM 线圈与电动机工作。", actions: [], focus: ["sb1", "km_coil", "motor"] },
    { title: "松开 SB1", text: "按钮弹回，常开触点断开；KM 线圈立即失电，三相主触点释放，电动机停止。教材没有自锁触点，不能松手后继续运行。", actions: [{ command: "release" }], focus: ["sb1", "km_coil", "km_main", "motor"] },
    { title: "断开外部电源", text: "外部电源断开，电动机保持停止。再次练习时，接通电源并重新按住 SB1；回放结束会返回独立保存的实时操作状态。", actions: [{ command: "powerOpen" }], focus: ["sb1", "motor"] }
  ]);
  function buildScenario(id, evaluate) {
    if (id !== "jog") throw new Error("未知点动教学场景");
    let actions = [];
    return script.map((item, index) => {
      actions = [...actions, ...item.actions];
      return { id: `jog-${index}`, title: item.title, text: item.text, duration: 1700,
        displayState: { raw: evaluate({ actions }), teachingFocus: [...item.focus] } };
    });
  }
  function liveFeedback(snapshot, result) {
    const pressed = snapshot.operation.controls.sb1 === "pressed";
    if (snapshot.operation.power !== "closed") return { title: "外部电源未接通", text: pressed ? "SB1 已按下，按钮触点发生真实动作；由于外部电源断开，KM 线圈不吸合，电动机不运行。" : "先接通外部电源，再按住 SB1。图中的点动电路不包含 QF、热继电器或自锁支路。", tone: "warning" };
    const diagnostics = result.extension?.diagnostics || [];
    if (diagnostics.length) return { title: pressed ? "SB1 已按下：检查电路通路" : "电路诊断", text: diagnostics.map((item) => typeof item === "string" ? item : item.message || item.code).join("；"), tone: "warning" };
    if (result.motorStates.M.running) return { title: "按住 SB1：点动运行", text: "SB1 常开触点闭合，KM 线圈得电，三相主触点同步闭合，电动机运行。保持按住鼠标或空格键；松开即停止。", tone: "info" };
    if (pressed) return { title: "SB1 已按下：电动机未运行", text: result.stableDeviceStates?.KM ? "SB1 触点闭合，KM 线圈已得电，但电动机未获得完整三相通路。当前不能显示为正常点动运行。" : "SB1 触点已闭合，但 KM 线圈尚未形成完整的供电与返回通路，因此主触点未闭合，电动机停止。", tone: "warning" };
    return { title: "SB1 已释放：电动机停止", text: "外部电源仍然接通，SB1 常开触点已断开，KM 线圈失电，主触点释放。该电路没有自锁，必须重新按住 SB1 才能运行。", tone: "info" };
  }
  platform.ch01JogTextbookTeaching = Object.freeze({ scenarios, scenes: scenarios, buildScenario, liveFeedback });
})(globalThis);
