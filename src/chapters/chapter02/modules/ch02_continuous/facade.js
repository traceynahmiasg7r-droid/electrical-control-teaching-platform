(function installContinuousFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_continuous", ROUTE_ID = "self-lock";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function createContinuousFacade(options) {
    const { context, circuitData, port } = options;
    const contracts = platform.contracts;
    const renderer = platform.moduleRenderers.createCh02ContinuousRenderer(circuitData);
    let mounted = false, lastAction = null;
    const playback = platform.createContinuousPlayback({ scope: context.scope, evaluate: (operation, coils) => port.evaluateDisplay(operation, coils), teaching: platform.ch02ContinuousTeaching, onChange: () => { if (mounted) context.services.renderShell(); } });
    let transientDisplayRaw = null;
    let transientDisplayTimer = null;
    ["readRawState", "evaluateDisplay", "reset", "solve", "togglePower", "startPrimary", "stopPrimary", "toggleProtection", "resetProtection", "render", "pause", "unmount", "validateGeometry", "runTests", "getFeedback", "getReplaySteps"].forEach((method) => { if (typeof port?.[method] !== "function") throw new Error(`${MODULE_ID} port requires ${method}()`); });
    const readRaw = () => port.readRawState();
    function clearTransientDisplay() {
      if (transientDisplayTimer !== null) {
        if (context.scope?.clearTimeout) context.scope.clearTimeout(transientDisplayTimer);
        else global.clearTimeout(transientDisplayTimer);
        transientDisplayTimer = null;
      }
      transientDisplayRaw = null;
    }
    function showTransientDisplay(raw, duration = 700) {
      clearTransientDisplay();
      transientDisplayRaw = raw;
      const complete = () => {
        transientDisplayTimer = null;
        transientDisplayRaw = null;
        if (mounted) context.services.renderShell();
      };
      transientDisplayTimer = context.scope?.timeout
        ? context.scope.timeout(complete, duration)
        : global.setTimeout(complete, duration);
      if (mounted) context.services.renderShell();
    }
    const unwrapRaw = (value) => value?.final?.operationState ? value.final : value;
    function getStateSnapshot(raw = readRaw()) {
      raw = unwrapRaw(raw) || readRaw();
      const op = raw.operationState, solver = raw.solver;
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, routeId: ROUTE_ID, operation: { power: op.qf1, controls: { start: op.sb1, stop: op.sb2 }, protections: { overload: op.fr1 } }, devices: { primaryContactor: { id: "KM1", energized: Boolean(raw.stableControlState?.km1) }, selfHoldContact: { id: "KM1_SELF_HOLD", conductive: Boolean(solver.selfHoldConductive) } }, motor: { id: "M", state: solver.motorRunning ? "running" : "stopped", running: Boolean(solver.motorRunning), direction: solver.motorRunning ? "forward" : "none" } };
    }
    const getVisibleStateSnapshot = () => getStateSnapshot(transientDisplayRaw || readRaw());
    function normalizeSolverResult(rawInput = readRaw()) {
      const raw = unwrapRaw(rawInput) || readRaw(), solver = raw.solver, op = raw.operationState;
      return { ...contracts.createEmptySolverResult(MODULE_ID), stableDeviceStates: { KM1: Boolean(raw.stableControlState?.km1), KM1_SELF_HOLD: Boolean(solver.selfHoldConductive) }, edgeStates: clone(solver.edgeStates || {}), activeMainWireIds: [...(solver.activeMainWireIds || [])], activeControlWireIds: [...(solver.activeControlWireIds || [])], partialWireIds: [...(solver.partialControlWireIds || [])], motorStates: { M: { running: Boolean(solver.motorRunning), direction: solver.motorRunning ? "forward" : "none" } }, protectionStates: { FR1: { state: op.fr1, tripped: op.fr1 === "overload" } }, converged: solver.converged !== false, iterationCount: solver.iterationCount || 0, lastAction: { message: String(solver.lastAction || "") }, extension: { activeControlEdgeIds: [...(solver.activeControlEdgeIds || [])], activeMainEdgeIds: [...(solver.activeMainEdgeIds || [])], controlSupplyBoundary: solver.controlSupplyBoundary || null, selfHoldConductive: Boolean(solver.selfHoldConductive) } };
    }
    function getOperationViewModel() {
      const state = getVisibleStateSnapshot(), powerClosed = state.operation.power === "closed", overload = state.operation.protections.overload === "overload", running = state.motor.running;
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, power: { deviceId: "QF1", closed: powerClosed, closeLabel: "QF1 合闸", openLabel: "QF1 分闸", closeEnabled: !powerClosed, openEnabled: powerClosed }, controls: [{ slot: "primary", visible: true, label: "启动 SB1", stateText: running ? "已执行" : "待命", buttonClass: "forward", action: "START_PRIMARY_PRESS" }, { slot: "secondary", visible: true, label: "停止 SB2", stateText: running ? "可执行停止" : "已停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS" }, { slot: "tertiary", visible: false }, { slot: "quaternary", visible: false }], protection: { label: "FR1 过载", resetLabel: "FR1 复位", tripped: overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" }, protections: [{ label: "FR1 过载", resetLabel: "FR1 复位", tripped: overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" }], actionStates: [{ id: "qf1", label: "QF1", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: powerClosed ? "QF1 当前已合闸。" : "QF1 当前断开。" }, { id: "sb1", label: "启动 SB1", currentState: running ? "running" : "ready", availableTransitions: [running ? "show_stop_hint" : "start"], onAction: "START_PRIMARY_PRESS", feedbackText: "SB1 启动后由 KM1 辅助常开触点自锁。" }, { id: "sb2", label: "停止 SB2", currentState: running ? "running" : "stopped", availableTransitions: [running ? "stop" : "show_stopped_hint"], onAction: "STOP_PRIMARY_PRESS", feedbackText: "SB2 为常闭停止按钮，按下后切断控制回路。" }, { id: "fr1_trip", label: "FR1 过载", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "show_overload_hint" : "trip"], onAction: "PROTECTION_TOGGLE", feedbackText: "FR1 动作后切断 KM1 控制回路。" }, { id: "fr1_reset", label: "FR1 复位", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "show_normal_hint"], onAction: "PROTECTION_RESET", feedbackText: "FR1 复位后不会自动重启。" }] };
    }
    function getStatusViewModel() {
      const state = getVisibleStateSnapshot(), overload = state.operation.protections.overload === "overload";
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, rows: [{ id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "断开", tone: state.operation.power === "closed" ? "on" : "off" }, { id: "start", label: "SB1", value: state.operation.controls.start === "pressed" ? "正在按下" : "未按下", tone: state.operation.controls.start === "pressed" ? "forward" : "off" }, { id: "stop", label: "SB2", value: state.operation.controls.stop === "pressed" ? "正在按下" : "未按下", tone: state.operation.controls.stop === "pressed" ? "error" : "on" }, { id: "contactor", label: "KM1", value: state.devices.primaryContactor.energized ? "得电" : "失电", tone: state.devices.primaryContactor.energized ? "forward" : "off" }, { id: "selfHold", label: "自锁", value: state.devices.selfHoldContact.conductive ? "已建立" : "未建立", tone: state.devices.selfHoldContact.conductive ? "forward" : "off" }, { id: "motor", label: "M", value: state.motor.running ? "运行" : "停止", tone: state.motor.running ? "forward" : "off" }, { id: "protection", label: "FR1", value: overload ? "已过载" : "正常", tone: overload ? "error" : "on" }] };
    }
    function display() { const current = playback.current(), raw = current?.displayState.raw || transientDisplayRaw || readRaw(), snapshot = getStateSnapshot(raw), solver = normalizeSolverResult(raw); return { source: current ? "Playback" : transientDisplayRaw ? "Live transient" : "Live", snapshot, solverResult: solver, visualState: platform.bindCh02ContinuousVisualState(circuitData, snapshot, solver), teachingFocus: current?.displayState.teachingFocus || [] }; }
    function feedback() { const current = playback.current(); return current ? { title: current.title, text: current.text, tone: "info" } : platform.ch02ContinuousTeaching.liveFeedback(getStateSnapshot(), lastAction); }
    function dispatchAction(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input, report = contracts.validateAction(action); if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      playback.cancel(); clearTransientDisplay(); lastAction = action.type; const beforeRaw = readRaw(); const current = getStateSnapshot(beforeRaw);
      const transientPressRaw = action.type === "STOP_PRIMARY_PRESS"
        ? unwrapRaw(port.evaluateDisplay({ ...beforeRaw.operationState, sb2: "pressed" }, beforeRaw.stableControlState))
        : null;
      switch (action.type) { case "POWER_CLOSE": if (current.operation.power !== "closed") port.togglePower(); break; case "POWER_OPEN": if (current.operation.power === "closed") port.togglePower(); break; case "START_PRIMARY_PRESS": port.startPrimary(); break; case "STOP_PRIMARY_PRESS": port.stopPrimary(); break; case "PROTECTION_TOGGLE": port.toggleProtection(); break; case "PROTECTION_RESET": port.resetProtection(); break; case "RESET_MODULE": port.reset(); break; default: throw new Error(`${MODULE_ID} does not support ${action.type}`); }
      if (transientPressRaw) showTransientDisplay(transientPressRaw);
      const result = { action, state: getStateSnapshot(), solverResult: normalizeSolverResult(), operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: feedback() }; if (mounted && !transientPressRaw) context.services.renderShell(); return result;
    }
    function render() { if (!mounted) return; const view = display(); renderer.render({ root: context.mountRoot, visualState: view.visualState, teachingFocus: view.teachingFocus, source: view.source, onAction: (id) => { const type = id === "qf1" ? (getStateSnapshot().operation.power === "closed" ? "POWER_OPEN" : "POWER_CLOSE") : id === "sb1" ? "START_PRIMARY_PRESS" : id === "sb2" ? "STOP_PRIMARY_PRESS" : "PROTECTION_TOGGLE"; dispatchAction(contracts.createAction(type, {}, "continuous-canvas")); } }); }
    function solve(message = "continuous facade solve") { playback.cancel(); port.solve(message); return normalizeSolverResult(); }
    return Object.freeze({ createInitialState: () => { playback.cancel(); clearTransientDisplay(); port.reset(); return getStateSnapshot(); }, getStateSnapshot, dispatchAction, solve, normalizeSolverResult, getOperationViewModel, getStatusViewModel, buildTeachingFeedback: feedback, buildReplaySteps: () => clone(playback.steps()), getPlaybackViewModel: () => ({ ...clone(playback.view()), displayState: display() }), dispatchPlayback: (command, value) => { clearTransientDisplay(); return playback.command(command, value); }, mount: () => { mounted = true; document.body.classList.add("ch02-continuous-active"); document.documentElement.classList.add("ch02-continuous-active-root"); context.services.renderShell(); }, render, reset: () => { playback.cancel(); clearTransientDisplay(); port.reset(); if (mounted) context.services.renderShell(); return getStateSnapshot(); }, pause: () => { playback.cancel(); clearTransientDisplay(); port.pause(); }, resume: () => undefined, unmount: () => { mounted = false; playback.cancel(); clearTransientDisplay(); document.body.classList.remove("ch02-continuous-active"); document.documentElement.classList.remove("ch02-continuous-active-root"); renderer.unmount({ root: context.mountRoot }); port.unmount(); }, validateGeometry: () => circuitData.validateGeometry(), runTests: () => port.runTests() });
  }
  platform.moduleFacades.createContinuousFacade = createContinuousFacade;
})(globalThis);
