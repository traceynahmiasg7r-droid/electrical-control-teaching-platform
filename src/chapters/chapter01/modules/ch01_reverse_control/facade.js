(function installCh01ReverseFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch01_reverse_control";
  const ROUTE_ID = "ch01-reverse-control";
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function createFacade({ port, context = {}, circuitData }) {
    const contracts = platform.contracts;
    const renderer = platform.moduleRenderers.createCh01ReverseRenderer();
    let mounted = false;
    const raw = () => port.readRawState();
    function getStateSnapshot() {
      const current = raw(); const s = current.solver; const direction = s.motorState || "stopped";
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, routeId: ROUTE_ID,
        operation: { power: current.operationState.qf1, controls: { forward: current.operationState.sb1, reverse: current.operationState.sb2, stop: current.operationState.sb3 }, protections: {} },
        devices: { forwardContactor: { id: "KM1", energized: Boolean(s.stableControlState.km1) }, reverseContactor: { id: "KM2", energized: Boolean(s.stableControlState.km2) } },
        motor: { id: "M", state: direction, running: direction !== "stopped", direction: direction === "stopped" ? "none" : direction } };
    }
    function normalizeSolverResult() {
      const s = raw().solver;
      return { ...contracts.createEmptySolverResult(MODULE_ID), stableDeviceStates: { KM1: Boolean(s.stableControlState.km1), KM2: Boolean(s.stableControlState.km2) }, edgeStates: clone(s.edgeStates), activeMainWireIds: [...s.activeMainWireIds], activeControlWireIds: [...s.activeControlWireIds], partialWireIds: [...s.partialControlWireIds], motorStates: { M: { running: s.motorState !== "stopped", state: s.motorState, direction: s.motorState === "stopped" ? "none" : s.motorState } }, protectionStates: {}, converged: s.converged, iterationCount: s.iterationCount, lastAction: { message: s.lastAction }, extension: { motorPhases: clone(s.motorPhases), interlock: true } };
    }
    function getOperationViewModel() {
      const state = getStateSnapshot(); const closed = state.operation.power === "closed";
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID,
        power: { deviceId: "QF1", closed, closeLabel: "QF1 合闸", openLabel: "QF1 分闸", closeEnabled: !closed, openEnabled: closed },
        controls: [
          { slot: "primary", visible: true, label: "正转启动 SB1", stateText: state.motor.direction === "forward" ? "运行中" : "待命", buttonClass: "forward", action: "START_FORWARD_PRESS" },
          { slot: "secondary", visible: true, label: "反转启动 SB2", stateText: state.motor.direction === "reverse" ? "运行中" : "待命", buttonClass: "reverse", action: "START_REVERSE_PRESS" },
          { slot: "tertiary", visible: true, label: "停止 SB3", stateText: state.motor.running ? "可停止" : "已停止", buttonClass: "stop", action: "STOP_PRESS" }, { slot: "quaternary", visible: false }],
        actionStates: [
          { id: "qf1", label: "QF1", currentState: closed ? "closed" : "open", availableTransitions: [closed ? "open" : "close"], onAction: closed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: "控制三相电源。" },
          { id: "sb1", label: "SB1", currentState: state.motor.state, availableTransitions: ["start_forward"], onAction: "START_FORWARD_PRESS", feedbackText: "建立正转与自锁回路。" },
          { id: "sb2", label: "SB2", currentState: state.motor.state, availableTransitions: ["start_reverse"], onAction: "START_REVERSE_PRESS", feedbackText: "建立反转与自锁回路。" },
          { id: "sb3", label: "SB3", currentState: state.motor.state, availableTransitions: ["stop"], onAction: "STOP_PRESS", feedbackText: "断开控制回路并解除自锁。" }] };
    }
    function getStatusViewModel() {
      const state = getStateSnapshot();
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, rows: [
        { id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "分闸", tone: state.operation.power === "closed" ? "on" : "off" },
        { id: "km1", label: "KM1", value: state.devices.forwardContactor.energized ? "吸合" : "释放", tone: state.devices.forwardContactor.energized ? "forward" : "off" },
        { id: "km2", label: "KM2", value: state.devices.reverseContactor.energized ? "吸合" : "释放", tone: state.devices.reverseContactor.energized ? "reverse" : "off" },
        { id: "motor", label: "M", value: state.motor.direction === "forward" ? "正转" : state.motor.direction === "reverse" ? "反转" : "停止", tone: state.motor.direction === "forward" ? "forward" : state.motor.direction === "reverse" ? "reverse" : "off" },
        { id: "interlock", label: "电气互锁", value: "有效", tone: "on" }] };
    }
    function dispatchAction(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input; const report = contracts.validateAction(action); if (!report.valid) throw new Error(report.errors.join("; "));
      const state = getStateSnapshot();
      if (action.type === "POWER_CLOSE" && state.operation.power !== "closed") port.togglePower();
      else if (action.type === "POWER_OPEN" && state.operation.power === "closed") port.togglePower();
      else if (action.type === "START_FORWARD_PRESS") port.pressForward();
      else if (action.type === "START_REVERSE_PRESS") port.pressReverse();
      else if (action.type === "STOP_PRESS") port.pressStop();
      else if (action.type === "RESET_MODULE") port.reset();
      else if (!["POWER_CLOSE", "POWER_OPEN"].includes(action.type)) throw new Error(`${MODULE_ID} does not support ${action.type}`);
      render(); context.services?.renderShell?.();
      return { action, state: getStateSnapshot(), solverResult: normalizeSolverResult(), operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: clone(port.getFeedback()) };
    }
    function render() { if (mounted && context.mountRoot) renderer.render({ root: context.mountRoot, circuitData, internalState: raw(), solverResult: normalizeSolverResult() }); }
    return Object.freeze({ createInitialState: () => { port.reset(); return getStateSnapshot(); }, getStateSnapshot, dispatchAction, solve: (message = "facade solve") => { port.solve(message); render(); return normalizeSolverResult(); }, normalizeSolverResult, getOperationViewModel, getStatusViewModel, buildTeachingFeedback: () => clone(port.getFeedback()), buildReplaySteps: () => clone(port.getReplaySteps()), mount: () => { mounted = true; }, render, reset: () => { port.reset(); render(); return getStateSnapshot(); }, pause: () => port.pause(), resume: () => undefined, unmount: () => { mounted = false; if (context.mountRoot) context.mountRoot.replaceChildren(); port.unmount(); }, validateGeometry: () => port.validateGeometry(), runTests: () => port.runTests() });
  }
  platform.moduleFacades.createCh01ReverseFacade = createFacade;
})(globalThis);
