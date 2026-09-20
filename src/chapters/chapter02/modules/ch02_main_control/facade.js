(function installMainControlFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_main_control";
  const ROUTE_ID = "main-control";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createMainControlFacade(options) {
    const { context, circuitData, port } = options;
    const contracts = platform.contracts;
    const renderer = platform.moduleRenderers.createCh02MainControlRenderer(circuitData);
    let mounted = false;
    let lastLiveAction = null;
    const playback = platform.createMainControlPlayback({ scope: context.scope,
      evaluate: (operation, coils) => port.evaluateDisplay(operation, coils),
      onChange: () => { if (mounted) context.services.renderShell(); }
    });
    const requiredPortMethods = [
      "readRawState", "reset", "solve", "togglePower",
      "startPrimary", "stopPrimary", "startSecondary", "stopSecondary",
      "toggleProtection", "resetProtection", "toggleSecondaryProtection", "resetSecondaryProtection",
      "setOperationState",
      "render", "pause", "unmount", "validateGeometry", "runTests", "getFeedback", "getReplaySteps"
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
      const motor1Running = solver.motorStates?.motor1 === "running";
      const motor2Running = solver.motorStates?.motor2 === "running";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: operation.qf1,
          controls: {
            stopPrimary: operation.sb2,
            startPrimary: operation.sb1,
            stopSecondary: operation.sb4,
            startSecondary: operation.sb3
          },
          protections: { primary: operation.fr1, secondary: operation.fr2 }
        },
        devices: {
          primaryContactor: { id: "KM1", energized: Boolean(raw.stableControlState?.km1) },
          secondaryContactor: { id: "KM2", energized: Boolean(raw.stableControlState?.km2) }
        },
        motor: {
          id: "dual-motor",
          state: motor1Running && motor2Running ? "both-running" : motor1Running ? "primary-running" : motor2Running ? "secondary-running" : "stopped",
          running: motor1Running || motor2Running,
          direction: "none",
          channels: {
            M1: { running: motor1Running, state: motor1Running ? "running" : "stopped" },
            M2: { running: motor2Running, state: motor2Running ? "running" : "stopped" }
          }
        }
      };
    }

    function normalizeSolverResult(rawInput = readRaw()) {
      const raw = rawInput?.operationState ? rawInput : readRaw();
      const solver = raw.solver;
      const operation = raw.operationState;
      const motor1Running = solver.motorStates?.motor1 === "running";
      const motor2Running = solver.motorStates?.motor2 === "running";
      return {
        ...contracts.createEmptySolverResult(MODULE_ID),
        stableDeviceStates: {
          KM1: Boolean(raw.stableControlState?.km1),
          KM2: Boolean(raw.stableControlState?.km2)
        },
        edgeStates: clone(solver.edgeStates || {}),
        activeMainWireIds: [...(solver.activeMainWireIds || [])],
        activeControlWireIds: [...(solver.activeControlWireIds || [])],
        partialWireIds: [...(solver.partialControlWireIds || [])],
        motorStates: {
          M1: { running: motor1Running, direction: "none", state: motor1Running ? "running" : "stopped" },
          M2: { running: motor2Running, direction: "none", state: motor2Running ? "running" : "stopped" }
        },
        protectionStates: {
          FR1: { state: operation.fr1, tripped: operation.fr1 === "overload" },
          FR2: { state: operation.fr2, tripped: operation.fr2 === "overload" }
        },
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
      const state = getStateSnapshot(playback.current()?.displayState.raw || readRaw());
      const powerClosed = state.operation.power === "closed";
      const motor1Running = state.motor.channels.M1.running;
      const motor2Running = state.motor.channels.M2.running;
      const fr1Overload = state.operation.protections.primary === "overload";
      const fr2Overload = state.operation.protections.secondary === "overload";
      const primaryProtection = {
        slot: "primary", visible: true, label: "FR1 过载", resetLabel: "FR1 复位",
        tripped: fr1Overload, toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET"
      };
      const secondaryProtection = {
        slot: "secondary", visible: true, label: "FR2 过载", resetLabel: "FR2 复位",
        tripped: fr2Overload, toggleAction: "PROTECTION_SECONDARY_TOGGLE", resetAction: "PROTECTION_SECONDARY_RESET"
      };
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: {
          deviceId: "QF1",
          closed: powerClosed,
          closeLabel: "QF1 合闸",
          openLabel: "QF1 分闸",
          closeEnabled: !powerClosed,
          openEnabled: powerClosed
        },
        controls: [
          { slot: "primary", visible: true, label: "启动 SB1", stateText: motor1Running ? "已执行" : "待命", buttonClass: "forward", action: "START_PRIMARY_PRESS" },
          { slot: "secondary", visible: true, label: "停止 SB2", stateText: motor1Running ? "可执行停止" : "已停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS" },
          { slot: "tertiary", visible: true, label: "启动 SB3", stateText: motor2Running ? "已执行" : "待命", buttonClass: "forward", action: "START_SECONDARY_PRESS" },
          { slot: "quaternary", visible: true, label: "停止 SB4", stateText: motor2Running ? "可执行停止" : "已停止", buttonClass: "stop", action: "STOP_SECONDARY_PRESS" }
        ],
        protection: primaryProtection,
        protections: [primaryProtection, secondaryProtection],
        actionStates: [
          { id: "qf1", label: "QF1", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: powerClosed ? "QF1 当前已合闸。" : "QF1 当前断开。" },
          { id: "sb1", label: "启动 SB1", currentState: motor1Running ? "running" : "stopped", availableTransitions: [motor1Running ? "show_running_hint" : "start"], onAction: "START_PRIMARY_PRESS", feedbackText: motor1Running ? "1M 当前已经运行。" : "SB1 会尝试建立 KM1 控制回路。" },
          { id: "sb2", label: "停止 SB2", currentState: motor1Running ? "running" : "stopped", availableTransitions: [motor1Running ? "stop" : "show_stopped_hint"], onAction: "STOP_PRIMARY_PRESS", feedbackText: motor1Running ? "SB2 用于停止 1M。" : "1M 当前已经停止。" },
          { id: "sb3", label: "启动 SB3", currentState: motor2Running ? "running" : "stopped", availableTransitions: [motor2Running ? "show_running_hint" : "start"], onAction: "START_SECONDARY_PRESS", feedbackText: motor2Running ? "2M 当前已经运行。" : "SB3 会尝试建立 KM2 控制回路。" },
          { id: "sb4", label: "停止 SB4", currentState: motor2Running ? "running" : "stopped", availableTransitions: [motor2Running ? "stop" : "show_stopped_hint"], onAction: "STOP_SECONDARY_PRESS", feedbackText: motor2Running ? "SB4 用于停止 2M。" : "2M 当前已经停止。" },
          { id: "fr1_trip", label: "FR1 过载", currentState: fr1Overload ? "overload" : "normal", availableTransitions: [fr1Overload ? "show_overload_hint" : "trip"], onAction: "PROTECTION_TOGGLE", feedbackText: fr1Overload ? "FR1 已处于动作状态。" : "FR1 仅保护 1M 支路。" },
          { id: "fr1_reset", label: "FR1 复位", currentState: fr1Overload ? "overload" : "normal", availableTransitions: [fr1Overload ? "reset" : "show_normal_hint"], onAction: "PROTECTION_RESET", feedbackText: fr1Overload ? "FR1 可复位到待命状态。" : "FR1 当前处于正常状态。" },
          { id: "fr2_trip", label: "FR2 过载", currentState: fr2Overload ? "overload" : "normal", availableTransitions: [fr2Overload ? "show_overload_hint" : "trip"], onAction: "PROTECTION_SECONDARY_TOGGLE", feedbackText: fr2Overload ? "FR2 已处于动作状态。" : "FR2 仅保护 2M 支路。" },
          { id: "fr2_reset", label: "FR2 复位", currentState: fr2Overload ? "overload" : "normal", availableTransitions: [fr2Overload ? "reset" : "show_normal_hint"], onAction: "PROTECTION_SECONDARY_RESET", feedbackText: fr2Overload ? "FR2 可复位到待命状态。" : "FR2 当前处于正常状态。" }
        ]
      };
    }

    function getStatusViewModel() {
      const state = getStateSnapshot(playback.current()?.displayState.raw || readRaw());
      const motor1Running = state.motor.channels.M1.running;
      const motor2Running = state.motor.channels.M2.running;
      const fr1Overload = state.operation.protections.primary === "overload";
      const fr2Overload = state.operation.protections.secondary === "overload";
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "断开", tone: state.operation.power === "closed" ? "on" : "off" },
          { id: "primaryContactor", label: "KM1", value: state.devices.primaryContactor.energized ? "得电 / 吸合" : "失电 / 释放", tone: state.devices.primaryContactor.energized ? "forward" : "off" },
          { id: "primaryMotor", label: "1M", value: motor1Running ? "运行" : "停止", tone: motor1Running ? "forward" : "off" },
          { id: "primaryProtection", label: "FR1", value: fr1Overload ? "已过载" : "正常", tone: fr1Overload ? "error" : "on" },
          { id: "secondaryContactor", label: "KM2", value: state.devices.secondaryContactor.energized ? "得电 / 吸合" : "失电 / 释放", tone: state.devices.secondaryContactor.energized ? "forward" : "off" },
          { id: "secondaryMotor", label: "2M", value: motor2Running ? "运行" : "停止", tone: motor2Running ? "forward" : "off" },
          { id: "secondaryProtection", label: "FR2", value: fr2Overload ? "已过载" : "正常", tone: fr2Overload ? "error" : "on" },
          { id: "mode", label: "模式", value: playback.current() ? "Playback" : "Live", tone: playback.current() ? "forward" : "on" }
        ]
      };
    }

    function buildTeachingFeedback() {
      const step = playback.current();
      if (step) return { title: step.title, text: step.text, tone: "info" };
      const snapshot = getStateSnapshot();
      const motor = snapshot.motor.state;
      if (snapshot.operation.protections.primary === "overload" || snapshot.operation.protections.secondary === "overload") return { title: "过载保护", text: "FR 常闭控制触点打开，接触器线圈失电，主触点释放，电机停止。复位只恢复启动条件，不会自动重启。", tone: "error" };
      if (motor === "primary-running" || motor === "secondary-running" || motor === "both-running") return { title: "主电路与控制电路", text: "控制按钮只使接触器线圈得电；线圈吸合主触点后，三相主电路才向对应电机供电。自锁辅助触点保持线圈，按钮不直接承载主电流。", tone: "info" };
      return { title: "主电路与控制电路", text: "左侧主电路承载三相电机电流，右侧控制电路通过按钮、FR 常闭触点和接触器线圈间接控制主触点。", tone: "info" };
    }

    function buildReplaySteps() {
      return clone(playback.view().step ? playback.view().step : playback.view());
    }

    function displayState() {
      const raw = playback.current()?.displayState.raw || readRaw();
      const snapshot = getStateSnapshot(raw), solverResult = normalizeSolverResult(raw);
      return { source: playback.current() ? "Playback" : "Live", snapshot, solverResult,
        visualState: platform.bindCh02MainControlVisualState(circuitData, snapshot, solverResult),
        teachingFocus: playback.current()?.displayState.teachingFocus || [] };
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      playback.cancel();
      lastLiveAction = action.type;
      const current = getStateSnapshot();
      const button = {
        START_PRIMARY_PRESS: "sb1",
        STOP_PRIMARY_PRESS: "sb2",
        START_SECONDARY_PRESS: "sb3",
        STOP_SECONDARY_PRESS: "sb4"
      }[action.type];
      if (button) {
        const phase = action.payload.phase || "pulse";
        if (!["press", "release", "pulse"].includes(phase)) throw new Error("Invalid button phase: " + phase);
        if (phase !== "release") port.setOperationState({ [button]: "pressed" }, button + " press");
        if (phase !== "press") port.setOperationState({ [button]: "released" }, button + " release");
      } else switch (action.type) {
        case "POWER_CLOSE":
          if (current.operation.power !== "closed") port.togglePower();
          break;
        case "POWER_OPEN":
          if (current.operation.power === "closed") port.togglePower();
          break;
        case "PROTECTION_TOGGLE":
          port.toggleProtection();
          break;
        case "PROTECTION_RESET":
          port.resetProtection();
          break;
        case "PROTECTION_SECONDARY_TOGGLE":
          port.toggleSecondaryProtection();
          break;
        case "PROTECTION_SECONDARY_RESET":
          port.resetSecondaryProtection();
          break;
        case "RESET_MODULE":
          port.reset();
          port.render();
          break;
        default:
          throw new Error(`${MODULE_ID} does not support ${action.type}`);
      }
      context.services.renderShell();
      return {
        action,
        state: getStateSnapshot(),
        solverResult: normalizeSolverResult(),
        operationViewModel: getOperationViewModel(),
        statusViewModel: getStatusViewModel(),
        feedback: buildTeachingFeedback()
      };
    }

    function solve(actionMessage = "main control facade solve") {
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
      getPlaybackViewModel: () => ({ ...playback.view(), displayState: displayState() }),
      dispatchPlayback: (command, value) => { renderer.releaseButtons(); return playback.command(command, value); },
      mount: () => { mounted = true; document.body.classList.add("ch02-main-control-active"); context.services.renderShell(); },
      render: () => { if (!mounted) return; const display = displayState(); renderer.render({ root: context.mountRoot, visualState: display.visualState, teachingFocus: display.teachingFocus, source: display.source, onAction: (id, phase) => {
        const map = { sb1: "START_PRIMARY_PRESS", sb2: "STOP_PRIMARY_PRESS", sb3: "START_SECONDARY_PRESS", sb4: "STOP_SECONDARY_PRESS" };
        const type = map[id] || (id === "qf1" ? (getStateSnapshot().operation.power === "closed" ? "POWER_OPEN" : "POWER_CLOSE") : id === "fr1_main" || id === "fr1_nc" ? "PROTECTION_TOGGLE" : id === "fr2_main" || id === "fr2_nc" ? "PROTECTION_SECONDARY_TOGGLE" : "RESET_MODULE");
        dispatchAction(contracts.createAction(type, { phase }, "main-control-canvas"));
      }}); },
      reset: () => { playback.cancel(); port.reset(); if (mounted) context.services.renderShell(); return getStateSnapshot(); },
      pause: () => { playback.cancel(); renderer.releaseButtons(); port.pause(); },
      resume: () => undefined,
      unmount: () => { mounted = false; playback.cancel(); document.body.classList.remove("ch02-main-control-active"); renderer.unmount({ root: context.mountRoot }); port.unmount(); },
      validateGeometry: () => port.validateGeometry(),
      runTests: () => port.runTests()
    });
  }

  platform.moduleFacades.createMainControlFacade = createMainControlFacade;
})(globalThis);
