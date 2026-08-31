(function installCh01OverloadRuntime(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRuntimes = platform.moduleRuntimes || {};
  const MODULE_ID = "ch01_overload_protection";
  const wire = (localId) => `${MODULE_ID}__wire__${localId}`;

  function createRuntime(circuitData) {
    let operation; let km1; let solver; let feedback; let replay;
    function recompute(message) {
      const power = operation.qf1 === "closed";
      const stopClosed = operation.sb1 !== "pressed";
      const frNcClosed = operation.fr1 === "normal";
      const startRequest = operation.sb2 === "pressed";
      const nextKm1 = power && stopClosed && frNcClosed && (startRequest || km1);
      km1 = Boolean(nextKm1);
      const motorRunning = power && km1 && frNcClosed;
      solver = {
        stableDeviceState: { km1 }, motorRunning,
        edgeStates: { [`${MODULE_ID}__edge__km1_main`]: km1, [`${MODULE_ID}__edge__km1_aux_no`]: km1, [`${MODULE_ID}__edge__fr1_nc`]: frNcClosed },
        activeMainWireIds: motorRunning ? ["main_l1", "main_l2", "main_l3", "main_km1_fr_u", "main_km1_fr_v", "main_km1_fr_w", "main_fr_m_u", "main_fr_m_v", "main_fr_m_w"].map(wire) : [],
        activeControlWireIds: power && frNcClosed ? ["control_supply", "control_stop", ...(km1 ? ["control_hold", "control_fr_nc", "control_coil"] : ["control_fr_nc"]), "control_neutral"].map(wire) : [],
        partialControlWireIds: power && !frNcClosed ? [wire("control_supply"), wire("control_stop")] : [],
        converged: true, iterationCount: 1, lastAction: message,
        extension: { frNcClosed, selfHoldConductive: km1, tripReason: operation.fr1 === "overload" ? "thermal_overload" : "none" }
      };
      return solver;
    }
    function setFeedback(title, principle, steps) { feedback = { moduleId: MODULE_ID, title, principle, state: operation.fr1, steps: [...steps] }; replay = steps.map((text, index) => ({ id: `${MODULE_ID}__step__${index + 1}`, order: index + 1, text })); }
    function reset() { operation = { qf1: "open", sb1: "released", sb2: "released", fr1: "normal" }; km1 = false; recompute("模块复位"); setFeedback("等待操作", "FR1 控制常闭触点正常闭合，等待合闸与启动。", ["QF1 分闸", "FR1 正常", "KM1 释放", "电动机停止"]); }
    function start() { operation.sb2 = "pressed"; recompute("按下启动 SB2"); operation.sb2 = "released"; recompute("释放启动 SB2"); setFeedback(solver.motorRunning ? "电动机运行" : operation.fr1 === "overload" ? "过载锁止启动" : "启动条件不满足", solver.motorRunning ? "KM1 线圈得电，主触点与自锁触点闭合，三相电源经 FR1 热元件送至电动机。" : "FR1 过载时控制常闭触点保持断开，KM1 不能吸合。", solver.motorRunning ? ["按下 SB2", "KM1 线圈得电", "KM1 自锁", "主触点闭合", "电动机运行"] : ["启动请求", "保护/电源条件检查", "KM1 保持释放", "电动机停止"]); }
    reset();
    return Object.freeze({
      readRawState: () => ({ operationState: { ...operation }, stableDeviceState: { km1 }, solver: JSON.parse(JSON.stringify(solver)) }),
      reset, solve: (message) => recompute(message),
      togglePower: () => { operation.qf1 = operation.qf1 === "closed" ? "open" : "closed"; recompute(`QF1 ${operation.qf1}`); setFeedback(operation.qf1 === "closed" ? "电源已合闸" : "电源已分闸", operation.qf1 === "closed" ? "控制回路进入待启动状态。" : "接触器释放，电动机失电停止。", [operation.qf1 === "closed" ? "QF1 合闸" : "QF1 分闸", "Solver 重算", "当前状态更新"]); },
      startPrimary: start,
      stopPrimary: () => { operation.sb1 = "pressed"; recompute("按下停止 SB1"); operation.sb1 = "released"; recompute("释放停止 SB1"); setFeedback("停止完成", "SB1 常闭触点瞬时断开，KM1 释放并解除自锁。", ["按下 SB1", "KM1 线圈失电", "主触点断开", "电动机停止"]); },
      toggleProtection: () => { if (operation.fr1 === "normal") operation.fr1 = "overload"; recompute("FR1 过载动作"); setFeedback("FR1 过载保护动作", "FR1 控制常闭触点断开，KM1 线圈失电，主触点断开，电动机停止。", ["主回路发生过载", "FR1 动作", "FR1 常闭触点断开", "KM1 释放", "电动机停止"]); },
      resetProtection: () => { operation.fr1 = "normal"; recompute("FR1 手动复位"); setFeedback("FR1 已复位", "FR1 恢复正常只重新闭合保护触点；由于 KM1 已释放且启动按钮未按下，电动机不会自动重启。", ["执行 FR1 复位", "FR1 常闭触点闭合", "KM1 仍释放", "等待重新按下 SB2"]); },
      render: () => undefined, pause: () => undefined, unmount: () => reset(),
      validateGeometry: () => ({ valid: circuitData.geometryLockId === "ch01_overload_protection_geometry_v1_locked", errors: [] }),
      runTests: () => { const results = []; const check = (name, condition) => results.push({ name, passed: Boolean(condition) }); reset(); operation.qf1 = "closed"; recompute("test close"); start(); check("启动并自锁", solver.motorRunning && km1); operation.fr1 = "overload"; recompute("test overload"); check("过载使 FR NC 断开", !solver.extension.frNcClosed); check("过载释放 KM1 并停机", !km1 && !solver.motorRunning); operation.fr1 = "normal"; recompute("test reset"); check("复位不自动重启", !km1 && !solver.motorRunning); start(); check("复位后可重新启动", solver.motorRunning); reset(); return { valid: results.every((item) => item.passed), results }; },
      getFeedback: () => JSON.parse(JSON.stringify(feedback)), getReplaySteps: () => JSON.parse(JSON.stringify(replay))
    });
  }
  platform.moduleRuntimes.createCh01OverloadRuntime = createRuntime;
})(globalThis);
