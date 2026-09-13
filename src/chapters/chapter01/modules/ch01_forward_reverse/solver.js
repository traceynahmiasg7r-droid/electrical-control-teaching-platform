(function installCh01ForwardReverseSolver(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const M = "ch01_forward_reverse";
  const id = (kind, name) => `${M}__${kind}__${name}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fresh = () => ({
    power: "open",
    direction: "stopped",
    lastAction: { type: "RESET_MODULE", message: "模块已复位，KM1、KM2均释放，电动机停止。" }
  });

  platform.moduleSolvers.createCh01ForwardReverseSolver = (circuitData) => {
    let state = fresh();

    function result() {
      const powered = state.power === "closed";
      const forward = powered && state.direction === "forward";
      const reverse = powered && state.direction === "reverse";
      const running = forward || reverse;
      const activeMainWireIds = !running ? [] : [
        id("wire", forward ? "main_forward_a" : "main_reverse_a"),
        id("wire", forward ? "main_forward_b" : "main_reverse_b"),
        id("wire", forward ? "main_forward_c" : "main_reverse_c"),
        id("wire", "motor_terminal_u"),
        id("wire", "motor_terminal_v"),
        id("wire", "motor_terminal_w")
      ];
      const activeControlWireIds = !running ? [] : [
        id("wire", "control_common"),
        id("wire", forward ? "control_forward_hold" : "control_reverse_hold"),
        id("wire", forward ? "control_forward_interlock" : "control_reverse_interlock"),
        id("wire", forward ? "control_forward_return" : "control_reverse_return")
      ];
      return {
        schemaVersion: "1.0",
        moduleId: M,
        stableDeviceStates: {
          [id("dev", "km1")]: forward,
          [id("dev", "km2")]: reverse
        },
        edgeStates: {
          [id("edge", "sb3_stop_nc")]: { conductive: true },
          [id("edge", "sb1_forward_no")]: { conductive: false },
          [id("edge", "sb2_reverse_no")]: { conductive: false },
          [id("edge", "km1_self_no")]: { conductive: forward },
          [id("edge", "km2_self_no")]: { conductive: reverse },
          [id("edge", "km2_interlock_nc")]: { conductive: !reverse },
          [id("edge", "km1_interlock_nc")]: { conductive: !forward },
          [id("edge", "km1_coil")]: { conductive: forward },
          [id("edge", "km2_coil")]: { conductive: reverse },
          [id("edge", "km1_main")]: { conductive: forward },
          [id("edge", "km2_main")]: { conductive: reverse }
        },
        activeMainWireIds,
        activeControlWireIds,
        partialWireIds: powered && !running ? [id("wire", "control_common")] : [],
        motorStates: {
          [id("dev", "motor")]: { state: running ? state.direction : "stopped", running, direction: running ? state.direction : "none" }
        },
        protectionStates: {},
        converged: true,
        iterationCount: 2,
        lastAction: clone(state.lastAction),
        extension: {
          controlSupply: powered ? "A-N / 220V" : "断开",
          interlock: forward ? "KM1吸合，KM1常闭互锁断开KM2支路" : reverse ? "KM2吸合，KM2常闭互锁断开KM1支路" : "KM1、KM2互锁触点均处于常闭待命位置",
          motorPhases: forward ? { U: "A", V: "B", W: "C" } : reverse ? { U: "C", V: "B", W: "A" } : {}
        }
      };
    }

    function solve(message = state.lastAction.message) {
      if (state.power !== "closed") state.direction = "stopped";
      state.lastAction.message = message;
      return result();
    }

    function reset() {
      state = fresh();
      return solve();
    }

    function dispatch(action) {
      let message;
      switch (action.type) {
        case "POWER_CLOSE":
          state.power = "closed";
          message = "A—N控制电源已接通，系统进入待命状态。";
          break;
        case "POWER_OPEN":
          state.power = "open";
          state.direction = "stopped";
          message = "A—N控制电源已断开，KM1、KM2释放，电动机停止。";
          break;
        case "START_FORWARD_PRESS":
          if (state.power !== "closed") message = "A—N控制电源未接通，SB1按下后KM1不能得电。";
          else if (state.direction === "reverse") message = "KM2正在吸合，其常闭互锁触点已断开KM1支路，不能直接切换为正转。请先按SB3停止。";
          else if (state.direction === "forward") message = "KM1已经吸合并由自身常开辅助触点保持，电动机继续正转。";
          else { state.direction = "forward"; message = "按下SB1，KM1线圈得电并自锁，KM1主触点按ABC相序接通，电动机正转。"; }
          break;
        case "START_REVERSE_PRESS":
          if (state.power !== "closed") message = "A—N控制电源未接通，SB2按下后KM2不能得电。";
          else if (state.direction === "forward") message = "KM1正在吸合，其常闭互锁触点已断开KM2支路，不能直接切换为反转。请先按SB3停止。";
          else if (state.direction === "reverse") message = "KM2已经吸合并由自身常开辅助触点保持，电动机继续反转。";
          else { state.direction = "reverse"; message = "按下SB2，KM2线圈得电并自锁，KM2主触点将A、C两相对调为CBA相序，电动机反转。"; }
          break;
        case "STOP_PRESS":
          state.direction = "stopped";
          message = "按下SB3，公共常闭停止触点断开，KM1或KM2线圈失电，电动机停止。";
          break;
        case "RESET_MODULE":
          return reset();
        default:
          throw new Error(`${M} does not support ${action.type}`);
      }
      state.lastAction = { type: action.type, message };
      return solve(message);
    }

    function validateGeometry() {
      const errors = [];
      const basis = circuitData.electricalBasis || {};
      if (basis.controlSupply?.live !== "A" || basis.controlSupply?.neutral !== "N" || basis.controlSupply?.nominalVoltage !== 220) errors.push("control supply must be A-N 220V");
      if (JSON.stringify(basis.forwardPhaseOrder) !== JSON.stringify({ U: "A", V: "B", W: "C" })) errors.push("forward phase order mismatch");
      if (JSON.stringify(basis.reversePhaseOrder) !== JSON.stringify({ U: "C", V: "B", W: "A" })) errors.push("reverse phase order mismatch");
      if (basis.stopButton !== "SB3" || basis.forwardButton !== "SB1" || basis.reverseButton !== "SB2") errors.push("chapter 1 button mapping mismatch");
      if (circuitData.components.some((component) => /QF|FU|FR|KI[12]/.test(component.label))) errors.push("chapter 2 or overload components leaked into chapter 1 circuit");
      if (circuitData.wires.some((wire) => !wire.wireId.startsWith(`${M}__wire__`) || wire.routePoints.length < 2)) errors.push("wire namespace or geometry mismatch");
      if (circuitData.wires.some((wire) => (wire.routeBreaks || []).some((index) => index <= 0 || index >= wire.routePoints.length))) errors.push("wire route break mismatch");
      return { valid: errors.length === 0, errors, geometryLockId: circuitData.geometryLockId };
    }

    function runTests() {
      const saved = clone(state);
      const tests = [];
      const check = (name, condition) => tests.push({ name, passed: Boolean(condition) });
      reset();
      check("Geometry matches chapter 1 page 61", validateGeometry().valid);
      dispatch({ type: "START_FORWARD_PRESS" });
      check("Disconnected A-N supply blocks start", state.direction === "stopped");
      dispatch({ type: "POWER_CLOSE" });
      dispatch({ type: "START_FORWARD_PRESS" });
      check("SB1 starts KM1 forward", state.direction === "forward" && result().stableDeviceStates[id("dev", "km1")]);
      check("Forward phase order is ABC", JSON.stringify(result().extension.motorPhases) === JSON.stringify({ U: "A", V: "B", W: "C" }));
      dispatch({ type: "START_REVERSE_PRESS" });
      check("KM1 interlock blocks direct reverse", state.direction === "forward" && !result().stableDeviceStates[id("dev", "km2")]);
      dispatch({ type: "STOP_PRESS" });
      dispatch({ type: "START_REVERSE_PRESS" });
      check("SB2 starts KM2 reverse after stop", state.direction === "reverse" && result().stableDeviceStates[id("dev", "km2")]);
      check("Reverse phase order is CBA", JSON.stringify(result().extension.motorPhases) === JSON.stringify({ U: "C", V: "B", W: "A" }));
      dispatch({ type: "START_FORWARD_PRESS" });
      check("KM2 interlock blocks direct forward", state.direction === "reverse" && !result().stableDeviceStates[id("dev", "km1")]);
      dispatch({ type: "POWER_OPEN" });
      check("Power disconnect releases both contactors", state.direction === "stopped" && !result().stableDeviceStates[id("dev", "km1")] && !result().stableDeviceStates[id("dev", "km2")]);
      state = saved;
      solve(saved.lastAction.message);
      return { passed: tests.every((test) => test.passed), total: tests.length, results: tests };
    }

    solve();
    return Object.freeze({ reset, dispatch, solve, getState: () => clone(state), getSolverResult: result, validateGeometry, runTests });
  };
})(globalThis);
