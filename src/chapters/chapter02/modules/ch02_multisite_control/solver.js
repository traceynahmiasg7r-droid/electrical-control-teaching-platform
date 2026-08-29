(function installMultisiteControlSolver(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const MODULE_ID = "ch02_multisite_control";
  const DEV = (localId) => `${MODULE_ID}__dev__${localId}`;
  const EDGE = (localId) => `${MODULE_ID}__edge__${localId}`;
  const WIRE = (localId) => `${MODULE_ID}__wire__${localId}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function initialState() {
    return {
      operation: { power: "open", start1: "released", start2: "released", stop1: "released", stop2: "released", protection: "normal" },
      memory: { selfHold: false },
      stable: { km1: false },
      lastAction: { type: "RESET_MODULE", message: "模块已复位，两个控制地点均待命。", station: "" },
      iterationCount: 0
    };
  }

  function createMultisiteControlSolver(circuitData) {
    let state = initialState();

    function solve(message = state.lastAction.message) {
      const supplyReady = state.operation.power === "closed" && state.operation.protection === "normal";
      const stopsClosed = state.operation.stop1 === "released" && state.operation.stop2 === "released";
      state.stable.km1 = Boolean(supplyReady && stopsClosed && state.memory.selfHold);
      if (!state.stable.km1) state.memory.selfHold = false;
      state.iterationCount = 2;
      state.lastAction.message = message;
      return getSolverResult();
    }

    function reset() {
      state = initialState();
      solve();
      return getState();
    }

    function dispatch(action) {
      let message = "状态已更新。";
      let station = "";
      switch (action.type) {
        case "POWER_CLOSE":
          state.operation.power = "closed";
          message = "QF1 合闸，两个控制地点同时获得控制电源。";
          break;
        case "POWER_OPEN":
          state.operation.power = "open";
          state.memory.selfHold = false;
          message = "QF1 分闸，KM1 释放，电机与两只指示灯均断电。";
          break;
        case "START_PRIMARY_PRESS":
          station = "地点一";
          state.operation.start1 = "pressed";
          if (state.operation.power === "closed" && state.operation.protection === "normal") state.memory.selfHold = true;
          message = "地点一按下 1SB1，并联启动支路导通，KM1 建立自锁。";
          state.operation.start1 = "released";
          break;
        case "START_SECONDARY_PRESS":
          station = "地点二";
          state.operation.start2 = "pressed";
          if (state.operation.power === "closed" && state.operation.protection === "normal") state.memory.selfHold = true;
          message = "地点二按下 2SB1，并联启动支路导通，KM1 建立自锁。";
          state.operation.start2 = "released";
          break;
        case "STOP_PRIMARY_PRESS":
          station = "地点一";
          state.operation.stop1 = "pressed";
          state.memory.selfHold = false;
          message = "地点一按下 1SB2，串联停止链断开，KM1 释放。";
          state.operation.stop1 = "released";
          break;
        case "STOP_SECONDARY_PRESS":
          station = "地点二";
          state.operation.stop2 = "pressed";
          state.memory.selfHold = false;
          message = "地点二按下 2SB2，串联停止链断开，KM1 释放。";
          state.operation.stop2 = "released";
          break;
        case "PROTECTION_TOGGLE":
          state.operation.protection = "overload";
          state.memory.selfHold = false;
          message = "FR1 过载动作，控制 NC 断开，所有地点均不能启动。";
          break;
        case "PROTECTION_RESET":
          state.operation.protection = "normal";
          message = "FR1 已复位；系统待命，不会自动重启。";
          break;
        case "RESET_MODULE":
          return reset();
        default:
          throw new Error(`${MODULE_ID} does not support ${action.type}`);
      }
      state.lastAction = { type: action.type, message, station };
      return solve(message);
    }

    function getSolverResult() {
      const powered = state.operation.power === "closed";
      const protectedPath = state.operation.protection === "normal";
      const km1 = state.stable.km1;
      const allControl = circuitData.controlWires.map((item) => item.wireId);
      const runningControl = km1 ? [
        "ctl_left_rail", "ctl_right_rail", "ctl_01", "ctl_02", "ctl_03",
        "hold_in", "hold_out", "ctl_04", "ctl_05", "ctl_06",
        "signal_01", "signal_02", "hl1_in", "hl1_out", "hl2_in", "hl2_out"
      ].map(WIRE) : [];
      const activeMain = km1 ? circuitData.mainWires.map((item) => item.wireId) : [];
      const partial = powered && !km1
        ? [...circuitData.mainWires.slice(0, 9).map((item) => item.wireId), ...allControl.slice(0, protectedPath ? 5 : 2)]
        : [];
      const lampState = km1 ? "on" : "off";
      return {
        schemaVersion: "1.0",
        moduleId: MODULE_ID,
        stableDeviceStates: { [DEV("km1")]: km1 },
        edgeStates: {
          [EDGE("qf1_3p")]: powered,
          [EDGE("stop_1_nc")]: true,
          [EDGE("stop_2_nc")]: true,
          [EDGE("start_1_no")]: false,
          [EDGE("start_2_no")]: false,
          [EDGE("km1_hold")]: km1,
          [EDGE("km1_coil")]: km1,
          [EDGE("km1_main")]: km1,
          [EDGE("km1_signal")]: km1,
          [EDGE("fr1_nc")]: protectedPath
        },
        activeMainWireIds: activeMain,
        activeControlWireIds: runningControl,
        partialWireIds: partial,
        motorStates: { [DEV("m1")]: { state: km1 ? "forward" : "stopped", running: km1, direction: km1 ? "forward" : "none" } },
        protectionStates: { [DEV("fr1")]: { state: state.operation.protection, tripped: !protectedPath } },
        converged: true,
        iterationCount: state.iterationCount,
        lastAction: clone(state.lastAction),
        extension: {
          selfHoldEstablished: km1,
          stations: { station1Ready: powered && protectedPath, station2Ready: powered && protectedPath },
          indicators: { standardStatus: "prototype", [DEV("hl1")]: lampState, [DEV("hl2")]: lampState }
        }
      };
    }

    function getState() { return clone(state); }

    function validateGeometry() {
      const wires = [...circuitData.mainWires, ...circuitData.controlWires];
      const components = [...circuitData.mainComponents, ...circuitData.controlComponents];
      const wireIds = wires.map((item) => item.wireId);
      const componentIds = components.map((item) => item.componentId);
      const errors = [];
      if (new Set(wireIds).size !== wireIds.length) errors.push("duplicate wireId");
      if (new Set(componentIds).size !== componentIds.length) errors.push("duplicate componentId");
      if (wires.some((item) => item.routePoints.length < 2)) errors.push("wire routePoints incomplete");
      if (wires.some((item) => !item.wireId.startsWith(`${MODULE_ID}__wire__`))) errors.push("wire namespace mismatch");
      if (components.some((item) => !item.componentId.startsWith(`${MODULE_ID}__cmp__`))) errors.push("component namespace mismatch");
      return { valid: errors.length === 0, errors, geometryLockId: circuitData.geometryLockId };
    }

    function runTests() {
      const saved = getState();
      const results = [];
      function check(name, test) {
        let passed = false;
        let error = "";
        try { passed = Boolean(test()); } catch (failure) { error = String(failure.message || failure); }
        results.push({ name, passed, error });
      }
      reset();
      check("Geometry 与命名空间", () => validateGeometry().valid);
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      check("断电时任一地点启动均无效", () => !state.stable.km1 && !state.memory.selfHold);
      dispatch({ type: "POWER_CLOSE", payload: {} });
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      check("地点一可启动并自锁", () => state.stable.km1 && state.memory.selfHold);
      check("自锁后仅保持支路持续有流", () => {
        const active = new Set(getSolverResult().activeControlWireIds);
        return active.has(WIRE("hold_in")) && !active.has(WIRE("start_1_in")) && !active.has(WIRE("start_2_in"));
      });
      dispatch({ type: "STOP_SECONDARY_PRESS", payload: {} });
      check("地点二可停止地点一启动的电机", () => !state.stable.km1);
      dispatch({ type: "START_SECONDARY_PRESS", payload: {} });
      check("地点二可启动", () => state.stable.km1);
      check("HL1/HL2 同步由 KM1 派生", () => {
        const indicators = getSolverResult().extension.indicators;
        return indicators[DEV("hl1")] === "on" && indicators[DEV("hl2")] === "on";
      });
      dispatch({ type: "STOP_PRIMARY_PRESS", payload: {} });
      check("地点一可停止地点二启动的电机", () => !state.stable.km1);
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      dispatch({ type: "PROTECTION_TOGGLE", payload: {} });
      check("FR1 过载停止并阻止保持", () => !state.stable.km1 && !state.memory.selfHold);
      dispatch({ type: "PROTECTION_RESET", payload: {} });
      check("FR1 复位不自动重启", () => !state.stable.km1 && state.operation.protection === "normal");
      dispatch({ type: "START_SECONDARY_PRESS", payload: {} });
      dispatch({ type: "POWER_OPEN", payload: {} });
      check("QF1 分闸释放 KM1 与自锁", () => !state.stable.km1 && !state.memory.selfHold);
      state = saved;
      solve(saved.lastAction.message);
      return { passed: results.filter((item) => item.passed).length, total: results.length, results };
    }

    solve();
    return Object.freeze({ reset, dispatch, solve, getState, getSolverResult, validateGeometry, runTests });
  }

  platform.moduleSolvers.createMultisiteControlSolver = createMultisiteControlSolver;
})(globalThis);
