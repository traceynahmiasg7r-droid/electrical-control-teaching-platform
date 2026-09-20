(function installJogTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const scenarios = Object.freeze([
    { id: "jog-cycle", title: "点动控制完整过程" },
    { id: "overload", title: "FR 过载保护" }
  ]);

  function buildScenario(id, evaluate) {
    if (!scenarios.some((item) => item.id === id)) throw new Error("Unknown jog scenario: " + id);
    let raw = evaluate({ qf: "open", sb: "released", fr: "normal" }, { km: false }).final;
    const steps = [];
    const change = (patch) => {
      raw = evaluate({ ...raw.operationState, ...patch }, raw.stableControlState).final;
      return raw;
    };
    const add = (title, text, teachingFocus, duration = 1600) => steps.push({
      id: id + "-" + steps.length, title, text, duration,
      displayState: { raw: clone(raw), teachingFocus, source: "Playback", electricalPhase: "settled" }
    });

    add("初始断电", "QF 三极断开，SB 常开触点未按下，KM 与电机均处于失电状态。", ["qf", "sb", "motor"]);
    change({ qf: "closed" });
    add("QF 合闸", "主回路和控制回路具备供电条件，但 SB 常开触点仍断开，KM 线圈未得电，电机保持停止。", ["qf"]);
    change({ sb: "pressed" });
    add("按住 SB", "SB 常开触点闭合。控制电流经 FU2、FR 常闭触点和 KM 线圈形成完整回路。", ["sb", "fr_nc", "coil"]);
    add("KM 吸合", "KM 线圈状态由同一图搜索 Solver 求得；三极主触点随 KM 吸合，三相主回路到达电机。", ["coil", "km_main", "motor"], 1900);

    if (id === "jog-cycle") {
      change({ sb: "released" });
      add("松开 SB", "点动控制没有自锁支路。SB 复位断开后，KM 线圈立即失电。", ["sb", "coil"]);
      add("KM 释放，电机停止", "KM 三极主触点释放，三相到电机的可达路径全部切断，电机停止。", ["km_main", "motor"], 1900);
    } else {
      change({ fr: "overload" });
      add("FR 过载动作", "FR 常闭触点断开，KM 线圈失电；即使 SB 仍按住，也不能保留运行回路。", ["fr_nc", "coil", "motor"], 1900);
      change({ sb: "released", fr: "normal" });
      add("FR 复位", "FR 复位只恢复常闭触点。SB 已松开且没有自锁支路，KM 和电机不会自动重新启动。", ["fr_nc", "sb", "motor"], 1900);
    }
    return steps;
  }

  function liveFeedback(snapshot, action) {
    if (snapshot.operation.protections.overload === "overload") return { title: "FR 过载保护", text: "FR 常闭触点断开，KM 线圈失电，KM 主触点释放，电机停止。", tone: "error" };
    if (snapshot.motor.running) return { title: "点动运行", text: "SB 正在按住，KM 线圈得电，三极主触点闭合，电机运行。", tone: "success" };
    if (action === "PROTECTION_RESET") return { title: "FR 已复位", text: "FR 常闭触点恢复，SB 保持释放。复位只恢复启动条件，KM 和电机不会自动重启。", tone: "info" };
    if (snapshot.operation.controls.jog === "pressed" && snapshot.operation.power !== "closed") return { title: "QF 未合闸", text: "SB 已按下，但 QF 未闭合，控制回路没有完整供电路径，KM 与电机保持停止。", tone: "warning" };
    if (action === "JOG_RELEASE") return { title: "点动释放", text: "SB 松开后没有自锁支路，KM 立即释放，电机停止。", tone: "info" };
    return { title: "点动控制待命", text: "先合上 QF，再按住 SB；松开 SB 后电机立即停止。", tone: "info" };
  }

  platform.ch02JogTeaching = Object.freeze({ scenarios, buildScenario, liveFeedback });
})(globalThis);
