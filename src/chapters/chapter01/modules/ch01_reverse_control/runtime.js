(function installCh01ReverseRuntime(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRuntimes = platform.moduleRuntimes || {};
  const MODULE_ID = "ch01_reverse_control";

  function createRuntime(circuitData) {
    let state;
    let solver;
    let feedback;
    let replay;

    const wire = (localId) => `${MODULE_ID}__wire__${localId}`;
    function initialOperationState() {
      return { qf1: "open", sb1: "released", sb2: "released", sb3: "released" };
    }

    function recompute(message) {
      const power = state.qf1 === "closed";
      let km1 = Boolean(solver?.stableControlState?.km1);
      let km2 = Boolean(solver?.stableControlState?.km2);
      const stopClosed = state.sb3 !== "pressed";
      const forwardRequest = state.sb1 === "pressed";
      const reverseRequest = state.sb2 === "pressed";
      let iterations = 0;
      for (; iterations < 4; iterations += 1) {
        const nextKm1 = power && stopClosed && !km2 && (forwardRequest || km1);
        const nextKm2 = power && stopClosed && !nextKm1 && (reverseRequest || km2);
        if (nextKm1 === km1 && nextKm2 === km2) break;
        km1 = nextKm1;
        km2 = nextKm2;
      }
      if (!power || !stopClosed) { km1 = false; km2 = false; }
      const direction = km1 ? "forward" : km2 ? "reverse" : "stopped";
      const activeMainWireIds = power && direction !== "stopped"
        ? ["main_l1", "main_l2", "main_l3", ...(km1 ? ["main_km1_u", "main_km1_v", "main_km1_w"] : ["main_km2_u", "main_km2_v", "main_km2_w"])].map(wire)
        : [];
      const activeControlWireIds = power
        ? ["control_supply", "control_stop", ...(km1 ? ["control_forward", "control_km1_hold"] : km2 ? ["control_reverse", "control_km2_hold"] : []), "control_neutral"].map(wire)
        : [];
      solver = {
        stableControlState: { km1, km2 },
        motorState: direction,
        edgeStates: {
          [`${MODULE_ID}__edge__km1_main`]: km1,
          [`${MODULE_ID}__edge__km2_main`]: km2,
          [`${MODULE_ID}__edge__km1_interlock_nc`]: !km1,
          [`${MODULE_ID}__edge__km2_interlock_nc`]: !km2
        },
        activeMainWireIds,
        activeControlWireIds,
        partialControlWireIds: power && direction === "stopped" ? [wire("control_supply"), wire("control_stop")] : [],
        motorPhases: km1 ? { U: "L1", V: "L2", W: "L3" } : km2 ? { U: "L3", V: "L2", W: "L1" } : {},
        converged: iterations < 4,
        iterationCount: iterations + 1,
        lastAction: message
      };
      return solver;
    }

    function setFeedback(title, principle, steps) {
      feedback = { moduleId: MODULE_ID, title, principle, state: solver.motorState, steps: [...steps] };
      replay = steps.map((text, index) => ({ id: `${MODULE_ID}__step__${index + 1}`, order: index + 1, text }));
    }

    function reset() {
      state = initialOperationState();
      solver = null;
      recompute("模块复位");
      setFeedback("等待操作", "合闸后选择正转或反转；KM1、KM2 的常闭辅助触点构成电气互锁。", ["QF1 分闸", "KM1、KM2 均释放", "电动机停止"]);
    }
    reset();

    function press(direction) {
      const key = direction === "forward" ? "sb1" : "sb2";
      state[key] = "pressed";
      recompute(direction === "forward" ? "按下正转 SB1" : "按下反转 SB2");
      state[key] = "released";
      recompute(direction === "forward" ? "释放正转 SB1" : "释放反转 SB2");
      const running = solver.motorState === direction;
      setFeedback(
        running ? (direction === "forward" ? "正转运行" : "反转运行") : "互锁阻止换向",
        running ? "接触器线圈得电并由辅助常开触点自锁；另一接触器的常闭互锁触点阻止其同时吸合。" : "运行中直接按相反方向按钮不会使两只接触器同时吸合；应先停止再换向。",
        running
          ? [direction === "forward" ? "按下 SB1" : "按下 SB2", `${direction === "forward" ? "KM1" : "KM2"} 线圈得电`, "自锁触点闭合", direction === "forward" ? "三相按 L1-L2-L3 接入，电机正转" : "两相换接，电机反转"]
          : ["相反方向启动请求", "互锁常闭触点已断开", "当前接触器保持，禁止同时吸合"]
      );
    }

    return Object.freeze({
      readRawState: () => ({ operationState: { ...state }, solver: JSON.parse(JSON.stringify(solver)) }),
      reset,
      solve: (message) => recompute(message),
      togglePower: () => { state.qf1 = state.qf1 === "closed" ? "open" : "closed"; recompute(`QF1 ${state.qf1}`); setFeedback(state.qf1 === "closed" ? "电源已合闸" : "电源已分闸", state.qf1 === "closed" ? "控制回路进入待机状态。" : "主、控制回路失电，两只接触器释放。", [state.qf1 === "closed" ? "QF1 合闸" : "QF1 分闸", "Solver 重算", solver.motorState === "stopped" ? "电动机停止" : "电动机运行"]); },
      pressStop: () => { state.sb3 = "pressed"; recompute("按下停止 SB3"); state.sb3 = "released"; recompute("释放停止 SB3"); setFeedback("停止完成", "SB3 常闭触点断开使接触器失电，自锁解除。", ["按下 SB3", "控制回路断开", "KM 释放", "电动机停止"]); },
      pressForward: () => press("forward"),
      pressReverse: () => press("reverse"),
      render: () => undefined,
      pause: () => undefined,
      unmount: () => reset(),
      validateGeometry: () => ({ valid: circuitData.geometryLockId === "ch01_reverse_control_geometry_v1_locked", errors: [] }),
      runTests: () => {
        const results = [];
        const check = (name, condition) => results.push({ name, passed: Boolean(condition) });
        reset(); togglePowerForTest(); press("forward"); check("正转启动并自锁", solver.motorState === "forward" && solver.stableControlState.km1);
        press("reverse"); check("正转期间互锁反转", solver.motorState === "forward" && !solver.stableControlState.km2);
        stopForTest(); press("reverse"); check("停止后可反转", solver.motorState === "reverse" && solver.motorPhases.U === "L3");
        state.qf1 = "open"; recompute("test power open"); check("分闸停止", solver.motorState === "stopped");
        reset();
        return { valid: results.every((item) => item.passed), results };
      },
      getFeedback: () => JSON.parse(JSON.stringify(feedback)),
      getReplaySteps: () => JSON.parse(JSON.stringify(replay))
    });

    function togglePowerForTest() { state.qf1 = "closed"; recompute("test power close"); }
    function stopForTest() { state.sb3 = "pressed"; recompute("test stop"); state.sb3 = "released"; recompute("test stop release"); }
  }

  platform.moduleRuntimes.createCh01ReverseRuntime = createRuntime;
})(globalThis);
