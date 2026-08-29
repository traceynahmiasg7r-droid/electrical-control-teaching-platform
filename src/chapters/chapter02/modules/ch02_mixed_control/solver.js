(function installMixedControlSolver(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const MODULE_ID = "ch02_mixed_control";
  const DEV = (localId) => `${MODULE_ID}__dev__${localId}`;
  const EDGE = (localId) => `${MODULE_ID}__edge__${localId}`;
  const WIRE = (localId) => `${MODULE_ID}__wire__${localId}`;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialInternalState() {
    return {
      operation: {
        power: "open",
        scheme: "one",
        saMode: "jog",
        start: "released",
        stop: "released",
        jog: "released",
        protection: "normal"
      },
      memory: { km1Latched: false, kLatched: false },
      stable: { km1: false, k: false },
      lastAction: { type: "RESET_MODULE", message: "模块已复位，等待 QF1 合闸。" },
      iterationCount: 0
    };
  }

  function createMixedControlSolver(circuitData) {
    let state = createInitialInternalState();

    function reset(overrides = {}) {
      state = createInitialInternalState();
      state.operation = { ...state.operation, ...(overrides.operation || {}) };
      solve("模块已复位。");
      return getState();
    }

    function clearRunMemory() {
      state.memory.km1Latched = false;
      state.memory.kLatched = false;
    }

    function dispatch(action) {
      const payload = action.payload || {};
      let message = "状态已更新。";
      switch (action.type) {
        case "POWER_CLOSE":
          state.operation.power = "closed";
          message = "QF1 合闸，主回路与控制回路获得电源。";
          break;
        case "POWER_OPEN":
          state.operation.power = "open";
          clearRunMemory();
          message = "QF1 分闸，KM1 与 K 均释放，电机停止。";
          break;
        case "START_PRIMARY_PRESS":
          state.operation.start = "pressed";
          if (state.operation.power === "closed" && state.operation.protection === "normal") {
            if (state.operation.scheme === "three") state.memory.kLatched = true;
            else if (state.operation.scheme !== "one" || state.operation.saMode === "continuous") state.memory.km1Latched = true;
          }
          message = state.operation.scheme === "three"
            ? "按下 SB1，继电器 K 得电并通过自身常开触点保持。"
            : "按下 SB1，长动支路尝试建立 KM1 自锁。";
          state.operation.start = "released";
          break;
        case "STOP_PRIMARY_PRESS":
        case "STOP_PRESS":
          state.operation.stop = "pressed";
          clearRunMemory();
          message = "按下 SB2，控制回路被切断，自锁解除。";
          state.operation.stop = "released";
          break;
        case "JOG_PRESS":
          state.operation.jog = "pressed";
          if (state.operation.scheme === "two") state.memory.km1Latched = false;
          if (state.operation.scheme === "three") state.memory.kLatched = false;
          message = state.operation.scheme === "one"
            ? "按住 SB1 点动触点，KM1 仅在按钮保持期间得电。"
            : "按住 SB3，长动保持支路被解除，点动支路直接控制 KM1。";
          break;
        case "JOG_RELEASE":
          state.operation.jog = "released";
          message = "松开点动按钮，点动支路断开，KM1 释放。";
          break;
        case "START_SECONDARY_PRESS":
          if (payload.kind === "sa") {
            state.operation.saMode = payload.position === "continuous" ? "continuous" : "jog";
            clearRunMemory();
            message = `SA 已切换到${state.operation.saMode === "continuous" ? "长动" : "点动"}位置。`;
          } else {
            const scheme = ["one", "two", "three"].includes(payload.scheme) ? payload.scheme : "one";
            state.operation.scheme = scheme;
            clearRunMemory();
            message = `已切换到${circuitData.variants[scheme].title}，运行状态已安全复位。`;
          }
          break;
        case "PROTECTION_TOGGLE":
          state.operation.protection = "overload";
          clearRunMemory();
          message = "FR1 过载动作，控制常闭触点断开，KM1 释放。";
          break;
        case "PROTECTION_RESET":
          state.operation.protection = "normal";
          message = "FR1 已复位；系统回到待启动状态，不会自动重启。";
          break;
        case "RESET_MODULE":
          return reset();
        default:
          throw new Error(`${MODULE_ID} does not support ${action.type}`);
      }
      state.lastAction = { type: action.type, message, payload: clone(payload) };
      return solve(message);
    }

    function solve(actionMessage = state.lastAction.message) {
      const powered = state.operation.power === "closed" && state.operation.protection === "normal";
      let km1 = false;
      let k = false;
      if (powered) {
        if (state.operation.scheme === "one") {
          km1 = state.operation.saMode === "continuous"
            ? state.memory.km1Latched
            : state.operation.jog === "pressed";
        } else if (state.operation.scheme === "two") {
          km1 = state.memory.km1Latched || state.operation.jog === "pressed";
        } else {
          k = state.memory.kLatched && state.operation.jog !== "pressed";
          km1 = k || state.operation.jog === "pressed";
        }
      }
      state.stable.km1 = Boolean(km1);
      state.stable.k = Boolean(k);
      state.iterationCount = 2;
      state.lastAction.message = actionMessage;
      return getSolverResult();
    }

    function selectedWires() {
      return circuitData.variants[state.operation.scheme].wires;
    }

    function getSolverResult() {
      const powered = state.operation.power === "closed";
      const protectedPath = state.operation.protection === "normal";
      const km1 = state.stable.km1;
      const k = state.stable.k;
      const controlWireIds = selectedWires().map((item) => item.wireId);
      let activeControlWireIds = [];
      if (km1 && state.operation.scheme === "one") {
        activeControlWireIds = ["one_left_rail", "one_right_rail", "one_01", "one_02", "one_03", "one_04", "one_05"];
        if (state.operation.saMode === "continuous") activeControlWireIds.push("one_hold_01", "one_hold_02", "one_hold_03");
      } else if (km1 && state.operation.scheme === "two") {
        activeControlWireIds = ["two_left_rail", "two_right_rail", "two_01", "two_02", "two_03", "two_04", "two_05"];
        activeControlWireIds.push(...(state.operation.jog === "pressed"
          ? ["two_jog_01", "two_jog_02"]
          : ["two_hold_01", "two_hold_02", "two_hold_03"]));
      } else if (km1) {
        activeControlWireIds = ["three_left_rail", "three_right_rail", "three_run_03", "three_run_04", "three_run_05"];
        if (state.operation.jog === "pressed") {
          activeControlWireIds.push("three_jog_01", "three_jog_02");
        } else {
          activeControlWireIds.push(
            "three_k_01", "three_k_02", "three_k_03", "three_k_04", "three_k_05",
            "three_hold_01", "three_hold_02", "three_hold_run_01", "three_hold_run_02"
          );
        }
      }
      activeControlWireIds = activeControlWireIds.map(WIRE);
      const activeMainWireIds = km1 ? circuitData.mainWires.map((item) => item.wireId) : [];
      const partialWireIds = powered && !km1
        ? [...circuitData.mainWires.slice(0, 9).map((item) => item.wireId), ...controlWireIds.slice(0, 2)]
        : [];
      return {
        schemaVersion: "1.0",
        moduleId: MODULE_ID,
        stableDeviceStates: {
          [DEV("km1")]: km1,
          [DEV("k")]: k
        },
        edgeStates: {
          [EDGE("qf1_3p")]: powered,
          [EDGE("km1_main")]: km1,
          [EDGE("km1_aux")]: km1,
          [EDGE("km1_coil")]: km1,
          [EDGE("fr1_nc")]: protectedPath,
          [EDGE("sb1_no")]: state.operation.start === "pressed",
          [EDGE("sb2_nc")]: state.operation.stop !== "pressed",
          [EDGE("sb3_no")]: state.operation.jog === "pressed",
          [EDGE("sb3_nc")]: state.operation.jog !== "pressed",
          [EDGE("sa_continuous")]: state.operation.saMode === "continuous",
          [EDGE("k_aux")]: k,
          [EDGE("k_coil")]: k
        },
        activeMainWireIds,
        activeControlWireIds,
        partialWireIds,
        motorStates: {
          [DEV("m1")]: { state: km1 ? "forward" : "stopped", running: km1, direction: km1 ? "forward" : "none" }
        },
        protectionStates: {
          [DEV("fr1")]: { state: state.operation.protection, tripped: state.operation.protection === "overload" }
        },
        converged: true,
        iterationCount: state.iterationCount,
        lastAction: clone(state.lastAction),
        extension: {
          selectedScheme: state.operation.scheme,
          saMode: state.operation.saMode,
          kRelayEnergized: k,
          selfHoldEstablished: state.operation.scheme === "three" ? k : state.memory.km1Latched
        }
      };
    }

    function getState() {
      return clone(state);
    }

    function validateGeometry() {
      const allWires = [
        ...circuitData.mainWires,
        ...Object.values(circuitData.variants).flatMap((variant) => variant.wires)
      ];
      const allComponents = [
        ...circuitData.mainComponents,
        ...Object.values(circuitData.variants).flatMap((variant) => variant.components)
      ];
      const wireIds = allWires.map((item) => item.wireId);
      const componentIds = allComponents.map((item) => item.componentId);
      const errors = [];
      if (new Set(wireIds).size !== wireIds.length) errors.push("duplicate wireId");
      if (new Set(componentIds).size !== componentIds.length) errors.push("duplicate componentId");
      if (allWires.some((item) => item.routePoints.length < 2)) errors.push("wire routePoints incomplete");
      if (allWires.some((item) => !item.wireId.startsWith(`${MODULE_ID}__wire__`))) errors.push("wire namespace mismatch");
      if (allComponents.some((item) => !item.componentId.startsWith(`${MODULE_ID}__cmp__`))) errors.push("component namespace mismatch");
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
      check("断电时任何启动均无效", () => !getSolverResult().motorStates[DEV("m1")].running);
      dispatch({ type: "POWER_CLOSE", payload: {} });
      dispatch({ type: "START_SECONDARY_PRESS", payload: { kind: "sa", position: "jog" } });
      dispatch({ type: "JOG_PRESS", payload: {} });
      check("方式一点动按住运行", () => getSolverResult().motorStates[DEV("m1")].running);
      dispatch({ type: "JOG_RELEASE", payload: {} });
      check("方式一点动松开停止", () => !getSolverResult().motorStates[DEV("m1")].running);
      dispatch({ type: "START_SECONDARY_PRESS", payload: { kind: "sa", position: "continuous" } });
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      check("方式一长动自锁", () => getSolverResult().extension.selfHoldEstablished && state.stable.km1);
      dispatch({ type: "STOP_PRIMARY_PRESS", payload: {} });
      check("SB2 解除自锁", () => !state.stable.km1);
      dispatch({ type: "START_SECONDARY_PRESS", payload: { scheme: "two" } });
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      check("方式二长动可建立并保持自锁", () => state.stable.km1 && state.memory.km1Latched);
      dispatch({ type: "JOG_PRESS", payload: {} });
      check("方式二点动仅点亮 SB3 NO 支路", () => {
        const active = new Set(getSolverResult().activeControlWireIds);
        return active.has(WIRE("two_jog_01")) && !active.has(WIRE("two_hold_01"));
      });
      dispatch({ type: "JOG_RELEASE", payload: {} });
      check("方式二 SB3 点动不残留自锁", () => !state.stable.km1 && !state.memory.km1Latched);
      dispatch({ type: "START_SECONDARY_PRESS", payload: { scheme: "three" } });
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      check("方式三 K 继电器保持", () => state.stable.k && state.stable.km1);
      check("方式三运行使用 K 并联支路", () => {
        const active = new Set(getSolverResult().activeControlWireIds);
        return active.has(WIRE("three_hold_run_01")) && !active.has(WIRE("three_jog_01"));
      });
      dispatch({ type: "STOP_PRIMARY_PRESS", payload: {} });
      dispatch({ type: "JOG_PRESS", payload: {} });
      check("方式三点动不吸合 K", () => state.stable.km1 && !state.stable.k);
      dispatch({ type: "JOG_RELEASE", payload: {} });
      check("方式三点动释放必停", () => !state.stable.km1 && !state.stable.k);
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      dispatch({ type: "PROTECTION_TOGGLE", payload: {} });
      check("FR1 过载强制停机", () => !state.stable.km1 && getSolverResult().protectionStates[DEV("fr1")].tripped);
      dispatch({ type: "PROTECTION_RESET", payload: {} });
      check("FR1 复位不自动重启", () => !state.stable.km1 && state.operation.protection === "normal");
      dispatch({ type: "START_PRIMARY_PRESS", payload: {} });
      dispatch({ type: "POWER_OPEN", payload: {} });
      check("QF1 分闸强制释放所有线圈", () => !state.stable.km1 && !state.stable.k && !state.memory.km1Latched && !state.memory.kLatched);
      state = saved;
      solve(saved.lastAction.message);
      return { passed: results.filter((item) => item.passed).length, total: results.length, results };
    }

    solve();
    return Object.freeze({ reset, dispatch, solve, getState, getSolverResult, validateGeometry, runTests });
  }

  platform.moduleSolvers.createMixedControlSolver = createMixedControlSolver;
})(globalThis);
