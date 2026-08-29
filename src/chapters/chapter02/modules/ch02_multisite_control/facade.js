(function installMultisiteControlFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_multisite_control";
  const ROUTE_ID = "multisite-control";
  const DEV = (localId) => `${MODULE_ID}__dev__${localId}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function createMultisiteControlFacade(options) {
    const { context, circuitData } = options;
    const contracts = platform.contracts;
    const solver = platform.moduleSolvers.createMultisiteControlSolver(circuitData);
    const renderer = platform.moduleRenderers.createMultisiteControlRenderer();
    let mounted = false;

    function getStateSnapshot() {
      const raw = solver.getState();
      const result = solver.getSolverResult();
      const running = Boolean(result.motorStates[DEV("m1")].running);
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: raw.operation.power,
          controls: { start1: raw.operation.start1, start2: raw.operation.start2, stop1: raw.operation.stop1, stop2: raw.operation.stop2 },
          protections: { overload: raw.operation.protection }
        },
        devices: {
          primaryContactor: { id: DEV("km1"), label: "KM1", energized: Boolean(result.stableDeviceStates[DEV("km1")]) }
        },
        motor: { id: DEV("m1"), label: "M", state: running ? "running" : "stopped", running, direction: running ? "forward" : "none" }
      };
    }

    function normalizeSolverResult() { return clone(solver.getSolverResult()); }

    function getOperationViewModel() {
      const state = getStateSnapshot();
      const powerClosed = state.operation.power === "closed";
      const overload = state.operation.protections.overload === "overload";
      const protection = { slot: "primary", visible: true, label: "FR1 过载", resetLabel: "FR1 复位", tripped: overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" };
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: { deviceId: DEV("qf1"), closed: powerClosed, closeLabel: "QF1 合闸", openLabel: "QF1 分闸", closeEnabled: !powerClosed, openEnabled: powerClosed },
        controls: [
          { slot: "primary", visible: true, label: "地点一 1SB1 启动", stateText: state.motor.running ? "运行中" : "待命", buttonClass: "forward", action: "START_PRIMARY_PRESS" },
          { slot: "secondary", visible: true, label: "地点一 1SB2 停止", stateText: state.motor.running ? "可停止" : "已停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS" },
          { slot: "tertiary", visible: true, label: "地点二 2SB1 启动", stateText: state.motor.running ? "运行中" : "待命", buttonClass: "forward", action: "START_SECONDARY_PRESS" },
          { slot: "quaternary", visible: true, label: "地点二 2SB2 停止", stateText: state.motor.running ? "可停止" : "已停止", buttonClass: "stop", action: "STOP_SECONDARY_PRESS" }
        ],
        protection,
        protections: [protection],
        actionStates: [
          { id: "power", label: "QF1", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: "QF1 三极联动，为两个控制地点提供同一电源。" },
          { id: "start1", label: "1SB1", currentState: state.motor.running ? "running" : "ready", availableTransitions: ["start"], onAction: "START_PRIMARY_PRESS", feedbackText: "1SB1 与 2SB1 并联，任一地点均可启动。" },
          { id: "stop1", label: "1SB2", currentState: state.motor.running ? "running" : "stopped", availableTransitions: ["stop"], onAction: "STOP_PRIMARY_PRESS", feedbackText: "1SB2 与 2SB2 串联，任一地点均可停止。" },
          { id: "start2", label: "2SB1", currentState: state.motor.running ? "running" : "ready", availableTransitions: ["start"], onAction: "START_SECONDARY_PRESS", feedbackText: "地点二启动与地点一启动等效。" },
          { id: "stop2", label: "2SB2", currentState: state.motor.running ? "running" : "stopped", availableTransitions: ["stop"], onAction: "STOP_SECONDARY_PRESS", feedbackText: "地点二停止可切断地点一建立的自锁。" },
          { id: "protection", label: "FR1", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "trip"], onAction: overload ? "PROTECTION_RESET" : "PROTECTION_TOGGLE", feedbackText: "FR1 动作后所有地点均不能启动；复位不自动重启。" }
        ]
      };
    }

    function getStatusViewModel() {
      const state = getStateSnapshot();
      const result = solver.getSolverResult();
      const overload = state.operation.protections.overload === "overload";
      const lampOn = result.extension.indicators[DEV("hl1")] === "on";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "分闸", tone: state.operation.power === "closed" ? "on" : "off" },
          { id: "km1", label: "KM1", value: state.devices.primaryContactor.energized ? "吸合/自锁" : "释放", tone: state.devices.primaryContactor.energized ? "forward" : "off" },
          { id: "motor", label: "M", value: state.motor.running ? "运行" : overload ? "保护停止" : "停止", tone: overload ? "error" : state.motor.running ? "forward" : "off" },
          { id: "station1", label: "地点一", value: state.operation.power === "closed" && !overload ? "可操作" : "不可启动", tone: state.operation.power === "closed" && !overload ? "on" : "off" },
          { id: "station2", label: "地点二", value: state.operation.power === "closed" && !overload ? "可操作" : "不可启动", tone: state.operation.power === "closed" && !overload ? "on" : "off" },
          { id: "indicators", label: "HL1 / HL2", value: lampOn ? "点亮（原型）" : "熄灭（原型）", tone: lampOn ? "forward" : "off" },
          { id: "protection", label: "FR1", value: overload ? "已过载" : "正常", tone: overload ? "error" : "on" }
        ]
      };
    }

    function buildTeachingFeedback() {
      const state = getStateSnapshot();
      const raw = solver.getState();
      const running = state.motor.running;
      return {
        title: running ? "多地点启动链已建立" : "多地点控制待命/停止",
        text: raw.lastAction.message,
        steps: running
          ? ["1SB2 与 2SB2 两只停止 NC 均闭合", `${raw.lastAction.station || "某一地点"}启动支路导通`, "KM1 线圈得电", "KM1 辅助 NO 闭合形成自锁", "KM1 主触点闭合，M 运行", "HL1/HL2 由 KM1 信号支路同步点亮（原型）"]
          : ["启动按钮为并联关系", "停止按钮为串联关系", "当前 KM1 线圈通路不完整", "M 停止"],
        source: "Solver stableDeviceStates / activeWireIds"
      };
    }

    function buildReplaySteps() {
      return [
        { label: "复位模块", action: "RESET_MODULE", payload: {} },
        { label: "QF1 合闸", action: "POWER_CLOSE", payload: {} },
        { label: "地点一 1SB1 启动", action: "START_PRIMARY_PRESS", payload: {} },
        { label: "地点二 2SB2 停止", action: "STOP_SECONDARY_PRESS", payload: {} },
        { label: "地点二 2SB1 启动", action: "START_SECONDARY_PRESS", payload: {} },
        { label: "地点一 1SB2 停止", action: "STOP_PRIMARY_PRESS", payload: {} }
      ];
    }

    function render() {
      if (!mounted || !context.mountRoot) return;
      renderer.render({ root: context.mountRoot, circuitData, internalState: solver.getState(), solverResult: solver.getSolverResult() });
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      solver.dispatch(action);
      render();
      context.services?.renderShell?.();
      return { action, state: getStateSnapshot(), solverResult: normalizeSolverResult(), operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: buildTeachingFeedback() };
    }

    function reset() { solver.reset(); render(); return getStateSnapshot(); }

    return Object.freeze({
      createInitialState: () => { solver.reset(); return getStateSnapshot(); },
      getStateSnapshot,
      dispatchAction,
      solve: (message = "multisite control facade solve") => { solver.solve(message); return normalizeSolverResult(); },
      normalizeSolverResult,
      getOperationViewModel,
      getStatusViewModel,
      buildTeachingFeedback,
      buildReplaySteps,
      mount: () => { mounted = true; },
      render,
      reset,
      pause: () => undefined,
      resume: () => undefined,
      unmount: () => { mounted = false; if (context.mountRoot) context.mountRoot.replaceChildren(); },
      validateGeometry: () => solver.validateGeometry(),
      runTests: () => solver.runTests()
    });
  }

  platform.moduleFacades.createMultisiteControlFacade = createMultisiteControlFacade;
})(globalThis);
