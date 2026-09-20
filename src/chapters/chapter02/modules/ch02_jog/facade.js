(function installJogFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_jog";
  const ROUTE_ID = "jog-control";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createJogFacade(options) {
    const { context, circuitData, port } = options;
    const contracts = platform.contracts;
    const renderer = platform.moduleRenderers.createCh02JogRenderer(circuitData);
    let mounted = false;
    let lastLiveAction = null;
    const playback = platform.createJogPlayback({
      scope: context.scope,
      evaluate: (operation, coils) => port.evaluateDisplay(operation, coils),
      onChange: () => { if (mounted) context.services.renderShell(); }
    });
    const requiredPortMethods = [
      "readRawState", "evaluateDisplay", "reset", "solve", "togglePower", "pressJog", "releaseJog",
      "toggleProtection", "resetProtection", "render", "pause", "unmount",
      "validateGeometry", "runTests", "getFeedback", "getReplaySteps"
    ];
    requiredPortMethods.forEach((method) => {
      if (typeof port?.[method] !== "function") throw new Error(`${MODULE_ID} port requires ${method}()`);
    });

    function readRaw() {
      return port.readRawState();
    }

    function readDisplayRaw() {
      return playback.current()?.displayState.raw || readRaw();
    }

    function getStateSnapshot(raw = readRaw()) {
      const operation = raw.operationState;
      const solver = raw.solver;
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: operation.qf,
          controls: { jog: operation.sb },
          protections: { overload: operation.fr }
        },
        devices: {
          primaryContactor: { id: "KM", energized: Boolean(raw.stableControlState?.km ?? solver.motorRunning) }
        },
        motor: {
          id: "M",
          state: solver.motorRunning ? "running" : "stopped",
          running: Boolean(solver.motorRunning),
          direction: solver.motorRunning ? "forward" : "none"
        }
      };
    }

    function normalizeSolverResult(rawInput = readRaw()) {
      const raw = rawInput?.operationState ? rawInput : readRaw();
      const solver = raw.solver;
      const operation = raw.operationState;
      return {
        ...contracts.createEmptySolverResult(MODULE_ID),
        stableDeviceStates: { KM: Boolean(raw.stableControlState?.km ?? solver.motorRunning) },
        edgeStates: clone(solver.edgeStates || {}),
        activeMainWireIds: [...(solver.activeMainWireIds || [])],
        activeControlWireIds: [...(solver.activeControlWireIds || [])],
        partialWireIds: [...(solver.partialControlWireIds || [])],
        motorStates: {
          M: { running: Boolean(solver.motorRunning), direction: solver.motorRunning ? "forward" : "none" }
        },
        protectionStates: { FR: { state: operation.fr, tripped: operation.fr === "overload" } },
        converged: solver.converged !== false,
        iterationCount: solver.iterationCount || 0,
        lastAction: { message: String(solver.lastAction || "") },
        extension: {
          activeControlEdgeIds: [...(solver.activeControlEdgeIds || [])],
          activeMainEdgeIds: [...(solver.activeMainEdgeIds || [])],
          controlSupplyBoundary: solver.controlSupplyBoundary || null
        }
      };
    }

    function getOperationViewModel() {
      const state = getStateSnapshot(readDisplayRaw());
      const powerClosed = state.operation.power === "closed";
      const jogPressed = state.operation.controls.jog === "pressed";
      const overload = state.operation.protections.overload === "overload";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: {
          deviceId: "QF",
          closed: powerClosed,
          closeLabel: "QF 合闸",
          openLabel: "QF 分闸",
          closeEnabled: !powerClosed,
          openEnabled: powerClosed
        },
        controls: [
          { slot: "primary", visible: false },
          { slot: "secondary", visible: true, label: "SB 点动", stateText: jogPressed ? "正在按住" : "按住运行 / 松开停止", buttonClass: "forward", pressAction: "JOG_PRESS", releaseAction: "JOG_RELEASE" },
          { slot: "tertiary", visible: false },
          { slot: "quaternary", visible: false }
        ],
        protection: { label: "FR 过载", resetLabel: "FR 复位", tripped: overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" },
        actionStates: [
          { id: "qf", label: "QF", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: powerClosed ? "QF 当前已合闸。" : "QF 当前断开。" },
          { id: "sb", label: "SB 点动", currentState: jogPressed ? "pressed" : "released", availableTransitions: [jogPressed ? "release" : "press"], onAction: jogPressed ? "JOG_RELEASE" : "JOG_PRESS", feedbackText: state.motor.running ? "点动按钮按住时电机运行，松开后立即停止。" : "点动按钮是瞬时动作，不能锁存为持续运行。" },
          { id: "fr_trip", label: "FR 过载", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "trip"], onAction: "PROTECTION_TOGGLE", feedbackText: overload ? "再次操作 FR 可复位，复位后不会自动启动。" : "FR 动作后会切断 KM 控制回路。" },
          { id: "fr_reset", label: "FR 复位", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "show_normal_hint"], onAction: "PROTECTION_RESET", feedbackText: overload ? "FR 可复位回到待机状态。" : "FR 当前处于正常状态。" }
        ]
      };
    }

    function getStatusViewModel() {
      const state = getStateSnapshot(readDisplayRaw());
      const powerClosed = state.operation.power === "closed";
      const jogPressed = state.operation.controls.jog === "pressed";
      const overload = state.operation.protections.overload === "overload";
      const energized = state.devices.primaryContactor.energized;
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "power", label: "QF", value: powerClosed ? "已合闸" : "断开", tone: powerClosed ? "on" : "off" },
          { id: "jog", label: "SB", value: jogPressed ? "正在按下" : "未按下", tone: jogPressed ? "forward" : "off" },
          { id: "contactor", label: "KM", value: energized ? "得电" : "失电", tone: energized ? "forward" : "off" },
          { id: "motor", label: "M", value: state.motor.running ? "运行" : "停止", tone: state.motor.running ? "forward" : "off" },
          { id: "protection", label: "FR", value: overload ? "已过载" : "正常", tone: overload ? "error" : "on" },
          { id: "mode", label: "模式", value: playback.current() ? "Playback" : "Live", tone: playback.current() ? "forward" : "on" }
        ]
      };
    }

    function buildTeachingFeedback() {
      const step = playback.current();
      return step ? { title: step.title, text: step.text, tone: "info" }
        : platform.ch02JogTeaching.liveFeedback(getStateSnapshot(), lastLiveAction);
    }

    function buildReplaySteps() {
      return clone(playback.steps());
    }

    function getDisplayState() {
      const step = playback.current();
      const raw = readDisplayRaw();
      const snapshot = getStateSnapshot(raw);
      const solverResult = normalizeSolverResult(raw);
      return {
        source: step ? "Playback" : "Live",
        snapshot,
        solverResult,
        visualState: platform.bindCh02JogVisualState(circuitData, snapshot, solverResult),
        teachingFocus: [...(step?.displayState.teachingFocus || [])]
      };
    }

    function actionOutput(action) {
      return {
        action,
        state: getStateSnapshot(),
        solverResult: normalizeSolverResult(),
        operationViewModel: getOperationViewModel(),
        statusViewModel: getStatusViewModel(),
        feedback: buildTeachingFeedback()
      };
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      const current = getStateSnapshot();
      // The shell broadcasts pointer releases, including releases over playback controls.
      if (action.type === "JOG_RELEASE" && current.operation.controls.jog !== "pressed") return actionOutput(action);
      playback.cancel();
      lastLiveAction = action.type;
      switch (action.type) {
        case "POWER_CLOSE":
          if (current.operation.power !== "closed") port.togglePower();
          break;
        case "POWER_OPEN":
          if (current.operation.power === "closed") port.togglePower();
          break;
        case "JOG_PRESS":
          port.pressJog(action.payload.reason || "facade jog press");
          break;
        case "JOG_RELEASE":
          port.releaseJog(action.payload.reason || "facade jog release");
          break;
        case "PROTECTION_TOGGLE":
          if (current.operation.protections.overload === "overload") {
            port.resetProtection();
            lastLiveAction = "PROTECTION_RESET";
          } else port.toggleProtection();
          break;
        case "PROTECTION_RESET":
          port.resetProtection();
          break;
        case "RESET_MODULE":
          port.reset();
          port.render();
          break;
        default:
          throw new Error(`${MODULE_ID} does not support ${action.type}`);
      }
      const result = actionOutput(action);
      contracts.assertFacadeOutputs({
        meta: { moduleId: MODULE_ID },
        getStateSnapshot: () => result.state,
        normalizeSolverResult: () => result.solverResult,
        getOperationViewModel: () => result.operationViewModel,
        getStatusViewModel: () => result.statusViewModel
      });
      if (mounted) context.services.renderShell();
      return result;
    }

    function solve(actionMessage = "jog facade solve") {
      playback.cancel();
      port.solve(actionMessage);
      if (mounted) context.services.renderShell();
      return normalizeSolverResult();
    }

    function releaseLiveButton() {
      renderer.releaseButtons();
      if (getStateSnapshot().operation.controls.jog === "pressed") port.releaseJog("jog interaction cleanup");
    }

    return Object.freeze({
      createInitialState: () => { playback.cancel(); lastLiveAction = null; port.reset(); return getStateSnapshot(); },
      getStateSnapshot,
      dispatchAction,
      solve,
      normalizeSolverResult,
      getOperationViewModel,
      getStatusViewModel,
      buildTeachingFeedback,
      buildReplaySteps,
      getPlaybackViewModel: () => ({ ...clone(playback.view()), displayState: getDisplayState() }),
      dispatchPlayback: (command, value) => { releaseLiveButton(); port.pause(); return playback.command(command, value); },
      mount: () => { mounted = true; document.body.classList.add("ch02-jog-active"); document.documentElement.classList.add("ch02-jog-active-root"); context.services.renderShell(); },
      render: () => {
        if (!mounted) return;
        const display = getDisplayState();
        renderer.render({
          root: context.mountRoot,
          visualState: display.visualState,
          teachingFocus: display.teachingFocus,
          source: display.source,
          onAction: (id, phase) => {
            const type = id === "qf"
              ? (getStateSnapshot().operation.power === "closed" ? "POWER_OPEN" : "POWER_CLOSE")
              : id === "sb"
                ? (phase === "release" ? "JOG_RELEASE" : "JOG_PRESS")
                : "PROTECTION_TOGGLE";
            dispatchAction(contracts.createAction(type, { phase }, "jog-canvas"));
          }
        });
      },
      reset: () => { playback.cancel(); lastLiveAction = null; port.reset(); if (mounted) context.services.renderShell(); return getStateSnapshot(); },
      pause: () => { playback.cancel(); releaseLiveButton(); port.pause(); },
      resume: () => undefined,
      unmount: () => { mounted = false; playback.cancel(); releaseLiveButton(); document.body.classList.remove("ch02-jog-active"); document.documentElement.classList.remove("ch02-jog-active-root"); renderer.unmount({ root: context.mountRoot }); port.unmount(); },
      validateGeometry: () => circuitData.validateGeometry(),
      runTests: () => port.runTests()
    });
  }

  platform.moduleFacades.createJogFacade = createJogFacade;
})(globalThis);
