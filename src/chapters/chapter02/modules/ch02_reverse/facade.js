(function installReverseFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_reverse";
  const ROUTE_ID = "forward-reverse";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createReverseFacade(options) {
    const { context, circuitData, port } = options;
    const contracts = platform.contracts;
    const renderer = platform.moduleRenderers.createCh02ReverseRenderer(circuitData);
    let mounted = false;
    let lastLiveAction = null;
    const playback = platform.createReversePlayback({ scope: context.scope,
      evaluate: (operation, coils) => port.evaluateDisplay(operation, coils),
      onChange: () => { if (mounted) context.services.renderShell(); } });
    const displayRaw = () => playback.current()?.displayState.raw || readRaw();
    const requiredPortMethods = [
      "readRawState", "reset", "solve", "togglePower", "pressStop", "pressForward", "pressReverse",
      "toggleProtection", "resetProtection", "render", "pause", "unmount",
      "validateGeometry", "runTests", "getFeedback", "getReplaySteps", "setOperationState"
    ];
    requiredPortMethods.forEach((method) => {
      if (typeof port?.[method] !== "function") throw new Error(`${MODULE_ID} port requires ${method}()`);
    });

    function readRaw() {
      return port.readRawState();
    }

    function getStateSnapshot(raw = readRaw()) {
      const operation = raw.operationState;
      const solver = raw.solver;
      const motorState = solver.motorState || "stopped";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: operation.qf1,
          controls: { stop: operation.sb1, forward: operation.sb2, reverse: operation.sb3 },
          protections: { overload: operation.fr1 }
        },
        devices: {
          forwardContactor: { id: "KM1", energized: Boolean(solver.stableControlState?.ki1) },
          reverseContactor: { id: "KM2", energized: Boolean(solver.stableControlState?.ki2) }
        },
        motor: {
          id: "M",
          state: motorState,
          running: motorState === "forward" || motorState === "reverse",
          direction: motorState === "forward" || motorState === "reverse" ? motorState : "none"
        }
      };
    }

    function normalizeSolverResult(rawInput = readRaw()) {
      const raw = rawInput?.operationState ? rawInput : readRaw();
      const solver = raw.solver;
      const operation = raw.operationState;
      const motorState = solver.motorState || "stopped";
      return {
        ...contracts.createEmptySolverResult(MODULE_ID),
        stableDeviceStates: {
          KM1: Boolean(solver.stableControlState?.ki1),
          KM2: Boolean(solver.stableControlState?.ki2)
        },
        edgeStates: clone(solver.edgeStates || {}),
        activeMainWireIds: [...(solver.activeMainWireIds || [])],
        activeControlWireIds: [...(solver.activeControlWireIds || [])],
        partialWireIds: [...(solver.partialControlWireIds || [])],
        motorStates: {
          M: { running: motorState === "forward" || motorState === "reverse", direction: motorState === "forward" || motorState === "reverse" ? motorState : "none", state: motorState }
        },
        protectionStates: { FR1: { state: operation.fr1, tripped: operation.fr1 === "overload" } },
        converged: solver.converged !== false,
        iterationCount: solver.iterationCount || 0,
        lastAction: { message: String(solver.lastAction || "") },
        extension: {
          activeControlEdgeIds: [...(solver.activeControlEdgeIds || [])],
          activeMainEdgeIds: [...(solver.activeMainEdgeIds || [])],
          activeMainWirePhaseMap: clone(solver.activeMainWirePhaseMap || {}),
          motorPhases: clone(solver.motorPhases || {})
        }
      };
    }

    function getOperationViewModel() {
      const state = getStateSnapshot(displayRaw());
      const powerClosed = state.operation.power === "closed";
      const overload = state.operation.protections.overload === "overload";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: {
          deviceId: "QF1",
          closed: powerClosed,
          closeLabel: "QF1 合闸",
          openLabel: "QF1 分闸",
          closeEnabled: Boolean(playback.current()) || !powerClosed,
          openEnabled: Boolean(playback.current()) || powerClosed
        },
        controls: [
          { slot: "primary", visible: true, label: "停止 SB1", stateText: state.operation.controls.stop === "pressed" ? "按下" : "已松开", buttonClass: "stop", action: "STOP_PRESS" },
          { slot: "secondary", visible: true, label: "正转启动 SB2", stateText: state.operation.controls.forward === "pressed" ? "按下" : state.motor.direction === "forward" ? "自锁运行" : "已松开", buttonClass: "forward", action: "START_FORWARD_PRESS" },
          { slot: "tertiary", visible: true, label: "反转启动 SB3", stateText: state.operation.controls.reverse === "pressed" ? "按下" : state.motor.direction === "reverse" ? "自锁运行" : "已松开", buttonClass: "reverse", action: "START_REVERSE_PRESS" },
          { slot: "quaternary", visible: false }
        ],
        protection: { label: "FR1 过载", resetLabel: "FR1 复位", tripped: overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" },
        actionStates: [
          { id: "qf1", label: "QF1", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: powerClosed ? "QF1 当前已合闸。" : "QF1 当前断开。" },
          { id: "sb1", label: "停止 SB1", currentState: state.motor.state, availableTransitions: [state.motor.state === "stopped" ? "show_stopped_hint" : "stop"], onAction: "STOP_PRESS", feedbackText: state.motor.state === "stopped" ? "设备当前已经停止。" : "SB1 用于停止当前转向运行。" },
          { id: "sb2", label: "正转启动 SB2", currentState: state.motor.state, availableTransitions: [state.motor.direction === "forward" ? "show_forward_hint" : "start_forward"], onAction: "START_FORWARD_PRESS", feedbackText: state.motor.direction === "forward" ? "电机已经处于正转状态。" : "SB2 会尝试建立正转回路。" },
          { id: "sb3", label: "反转启动 SB3", currentState: state.motor.state, availableTransitions: [state.motor.direction === "reverse" ? "show_reverse_hint" : "start_reverse"], onAction: "START_REVERSE_PRESS", feedbackText: state.motor.direction === "reverse" ? "电机已经处于反转状态。" : "SB3 会尝试建立反转回路。" },
          { id: "fr1_trip", label: "FR1 过载", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "show_overload_hint" : "trip"], onAction: "PROTECTION_TOGGLE", feedbackText: overload ? "FR1 已处于动作状态。" : "FR1 动作后会释放当前接触器。" },
          { id: "fr1_reset", label: "FR1 复位", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "show_normal_hint"], onAction: "PROTECTION_RESET", feedbackText: overload ? "FR1 可复位回到待命状态。" : "FR1 当前处于正常状态。" }
        ]
      };
    }

    function getStatusViewModel() {
      const raw = displayRaw();
      const state = getStateSnapshot(raw);
      const phases = raw.solver.motorPhases || {};
      const overload = state.operation.protections.overload === "overload";
      const phaseText = state.motor.direction === "forward"
        ? "L1-U / L2-V / L3-W"
        : state.motor.direction === "reverse"
          ? "L1-W / L2-V / L3-U"
          : "U=- / V=- / W=-";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "分闸", tone: state.operation.power === "closed" ? "on" : "off" },
          { id: "forwardContactor", label: "KI1", value: state.devices.forwardContactor.energized ? "得电 / 吸合" : "失电 / 释放", tone: state.devices.forwardContactor.energized ? "forward" : "off" },
          { id: "reverseContactor", label: "KI2", value: state.devices.reverseContactor.energized ? "吸合 / 得电" : "失电 / 释放", tone: state.devices.reverseContactor.energized ? "reverse" : "off" },
          { id: "motor", label: "M", value: state.motor.direction === "forward" ? "正转运行" : state.motor.direction === "reverse" ? "反转运行" : overload ? "故障停止" : "停止", tone: overload ? "error" : state.motor.direction === "forward" ? "forward" : state.motor.direction === "reverse" ? "reverse" : "off" },
          { id: "protection", label: "FR1", value: overload ? "已过载" : "正常", tone: overload ? "error" : "on" },
          { id: "mode", label: "模式", value: playback.current() ? "Playback" : "Live", tone: playback.current() ? "forward" : "on" },
          { id: "phase", label: "当前相序", value: phases.U || phases.V || phases.W ? phaseText : "U=- / V=- / W=-", tone: overload ? "error" : state.motor.direction === "forward" ? "forward" : state.motor.direction === "reverse" ? "reverse" : "off" }
        ]
      };
    }

    function buildTeachingFeedback() {
      const step = playback.current();
      return step ? { title: step.title, text: step.text, tone: "info" }
        : platform.reverseTeaching.liveFeedback(getStateSnapshot(), lastLiveAction);
    }

    function buildReplaySteps() {
      return clone(playback.steps());
    }

    function getDisplayState() {
      const raw = displayRaw();
      const snapshot = getStateSnapshot(raw), solverResult = normalizeSolverResult(raw);
      return { source: playback.current() ? "Playback" : "Live", snapshot, solverResult,
        visualState: platform.bindCh02ReverseVisualState(circuitData, snapshot, solverResult),
        teachingFocus: playback.current()?.displayState.teachingFocus || [] };
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      playback.cancel();
      lastLiveAction = action.type;
      const current = getStateSnapshot();
      const button = { STOP_PRESS: "sb1", START_FORWARD_PRESS: "sb2", START_REVERSE_PRESS: "sb3" }[action.type];
      if (button) {
        // One operation state atomically drives both NO and NC. Existing shell clicks are a full pulse.
        const phase = action.payload.phase || "pulse";
        if (!["press", "release", "pulse"].includes(phase)) throw new Error("Invalid button phase: " + phase);
        if (phase !== "release") port.setOperationState({ [button]: "pressed" }, button + " press");
        if (phase !== "press") port.setOperationState({ [button]: "released" }, button + " release");
      } else {
      switch (action.type) {
        case "POWER_CLOSE":
          port.setOperationState({ qf1: "closed" }, "QF1 close");
          break;
        case "POWER_OPEN":
          port.setOperationState({ qf1: "open" }, "QF1 open");
          break;
        case "PROTECTION_TOGGLE":
          port.setOperationState({ fr1: "overload" }, "FR1 overload");
          break;
        case "PROTECTION_RESET":
          // A held start button is an active start command. Require release before reset;
          // never override the Solver's coil/motor result to fake restart inhibition.
          if (current.operation.controls.forward !== "pressed" && current.operation.controls.reverse !== "pressed") {
            port.setOperationState({ fr1: "normal" }, "FR1 reset");
          }
          break;
        case "RESET_MODULE":
          port.reset();
          port.render();
          break;
        default:
          throw new Error(`${MODULE_ID} does not support ${action.type}`);
      }
      }
      context.services.renderShell();
      const result = {
        action,
        state: getStateSnapshot(),
        solverResult: normalizeSolverResult(),
        operationViewModel: getOperationViewModel(),
        statusViewModel: getStatusViewModel(),
        feedback: buildTeachingFeedback()
      };
      contracts.assertFacadeOutputs({
        meta: { moduleId: MODULE_ID },
        getStateSnapshot: () => result.state,
        normalizeSolverResult: () => result.solverResult,
        getOperationViewModel: () => result.operationViewModel,
        getStatusViewModel: () => result.statusViewModel
      });
      return result;
    }

    function solve(actionMessage = "reverse facade solve") {
      playback.cancel();
      port.solve(actionMessage);
      return normalizeSolverResult();
    }

    return Object.freeze({
      createInitialState: () => { playback.cancel(); port.reset(); return getStateSnapshot(); },
      getStateSnapshot,
      dispatchAction,
      solve,
      normalizeSolverResult,
      getOperationViewModel,
      getStatusViewModel,
      buildTeachingFeedback,
      buildReplaySteps,
      getPlaybackViewModel: () => ({ ...clone(playback.view()), displayState: getDisplayState() }),
      dispatchPlayback: (command, value) => { renderer.releaseButtons(); return playback.command(command, value); },
      mount: () => {
        mounted = true;
        document.body.classList.add("ch02-reverse-active");
        context.services.renderShell();
      },
      render: () => {
        const display = getDisplayState();
        if (mounted) renderer.render({ root: context.mountRoot,
          visualState: display.visualState,
          teachingFocus: display.teachingFocus,
          source: display.source,
          onAction: (id, phase) => {
            const type = { sb1: "STOP_PRESS", sb2: "START_FORWARD_PRESS", sb3: "START_REVERSE_PRESS" }[id]
              || (id === "qf1" ? (getStateSnapshot().operation.power === "closed" ? "POWER_OPEN" : "POWER_CLOSE")
                : (getStateSnapshot().operation.protections.overload === "overload" ? "PROTECTION_RESET" : "PROTECTION_TOGGLE"));
            dispatchAction(contracts.createAction(type, { phase }, "reverse-canvas"));
          }
        });
      },
      reset: () => { playback.cancel(); lastLiveAction = null; port.reset(); if (mounted) context.services.renderShell(); return getStateSnapshot(); },
      pause: () => { playback.cancel(); renderer.releaseButtons(); port.pause(); },
      resume: () => undefined,
      unmount: () => {
        mounted = false;
        playback.cancel();
        document.body.classList.remove("ch02-reverse-active");
        renderer.unmount({ root: context.mountRoot });
        port.unmount();
      },
      validateGeometry: () => circuitData.validateGeometry(),
      runTests: () => port.runTests()
    });
  }

  platform.moduleFacades.createReverseFacade = createReverseFacade;
})(globalThis);
