(function installContinuousTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const op = (qf1, sb1 = "released", sb2 = "released", fr1 = "normal") => ({ qf1, sb1, sb2, fr1 });
  platform.ch02ContinuousTeaching = {
    scenarios: [
      { id: "continuous-cycle", title: "长动自锁完整过程" },
      { id: "overload", title: "FR1 过载保护" }
    ],
    buildScenario(id, evaluate) {
      const frames = [];
      const add = (stepId, title, text, operation, coils, focus = [], duration = 1500) => {
        const result = evaluate(operation, coils);
        frames.push({ id: stepId, title, text, duration, displayState: { raw: clone(result), teachingFocus: focus, source: "Playback", electricalPhase: "settled" } });
        return result.final?.stableControlState || result.stableControlState || coils;
      };
      let coils = { km1: false };
      if (id === "overload") {
        add("continuous-overload-0", "QF1 合闸待命", "主回路和控制回路具备供电条件，KM1 尚未吸合。", op("closed"), coils, ["qf1"], 1300);
        coils = add("continuous-overload-1", "SB1 启动并自锁", "按下 SB1 后，KM1 线圈得电，主触点和自锁触点闭合。", op("closed", "pressed"), coils, ["sb1", "coil", "km1_self", "motor"], 1500);
        coils = add("continuous-overload-2", "松开 SB1 后连续运行", "SB1 恢复常开，KM1 由辅助常开触点继续保持得电。", op("closed"), coils, ["km1_self", "motor"], 1500);
        add("continuous-overload-3", "FR1 过载动作", "FR1 常闭保护触点断开，KM1 线圈失电，主回路释放。", op("closed", "released", "released", "overload"), coils, ["fr1_nc", "coil", "motor"], 1700);
        add("continuous-overload-4", "FR1 复位后待命", "保护触点恢复，但不会自动重启，必须重新按下 SB1。", op("closed", "released", "released", "normal"), { km1: false }, ["fr1_nc"], 1500);
        return frames;
      }
      add("continuous-cycle-0", "初始断电", "QF1 分闸，KM1 与电机均处于失电状态。", op("open"), coils, ["qf1"], 1300);
      add("continuous-cycle-1", "QF1 合闸", "主回路和控制回路具备供电条件，系统进入待命。", op("closed"), coils, ["qf1", "fu2"], 1300);
      coils = add("continuous-cycle-2", "按下 SB1", "SB1 常开触点闭合，控制电流进入 KM1 线圈。", op("closed", "pressed"), coils, ["sb1", "coil"], 1300);
      coils = add("continuous-cycle-3", "KM1 主触点与自锁触点闭合", "KM1 吸合，三相主触点和辅助自锁触点同步闭合。", op("closed", "pressed"), coils, ["km1_main", "km1_self", "coil"], 1500);
      coils = add("continuous-cycle-4", "松开 SB1", "启动按钮恢复断开，控制电流改由 KM1 自锁支路维持。", op("closed"), coils, ["km1_self", "motor"], 1600);
      add("continuous-cycle-5", "连续运行", "SB1 已松开，KM1 自锁保持成立，电机继续运行。", op("closed"), coils, ["km1_self", "motor"], 1600);
      add("continuous-cycle-6", "按下 SB2 停止", "SB2 常闭触点断开，控制回路被切断，KM1 释放。", op("closed", "released", "pressed"), coils, ["sb2", "coil"], 1500);
      add("continuous-cycle-7", "停止后待命", "SB2 松开只恢复常闭触点，不会自动重新启动。", op("closed"), { km1: false }, ["sb2"], 1400);
      return frames;
    },
    liveFeedback(snapshot, action) {
      const running = Boolean(snapshot?.motor?.running);
      const overload = snapshot?.operation?.protections?.overload === "overload";
      if (overload) return { title: "FR1 过载保护", text: "FR1 常闭保护触点断开，KM1 失电，复位后不会自动重启。", tone: "warning" };
      if (running) return { title: "长动自锁已建立", text: "SB1 松开后，KM1 仍由辅助常开触点保持得电，电机连续运行。", tone: "success" };
      if (action === "STOP_PRIMARY_PRESS") return { title: "SB2 已停止", text: "停止按钮切断控制回路，KM1 和电机均已释放。", tone: "info" };
      return { title: "长动控制待命", text: "先合上 QF1，再按下 SB1 启动；松开 SB1 后由 KM1 自锁保持。", tone: "info" };
    }
  };
})(globalThis);
