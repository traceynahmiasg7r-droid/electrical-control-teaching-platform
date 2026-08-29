(function installMixedControlFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_mixed_control";
  const ROUTE_ID = "mixed-control";
  const DEV = (localId) => `${MODULE_ID}__dev__${localId}`;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createMixedControlFacade(options) {
    const { context, circuitData } = options;
    const contracts = platform.contracts;
    const solver = platform.moduleSolvers.createMixedControlSolver(circuitData);
    const renderer = platform.moduleRenderers.createMixedControlRenderer();
    let mounted = false;

    function getStateSnapshot() {
      const raw = solver.getState();
      const result = solver.getSolverResult();
      const motor = result.motorStates[DEV("m1")];
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: {
          power: raw.operation.power,
          controls: {
            scheme: raw.operation.scheme,
            saMode: raw.operation.saMode,
            start: raw.operation.start,
            stop: raw.operation.stop,
            jog: raw.operation.jog
          },
          protections: { overload: raw.operation.protection }
        },
        devices: {
          primaryContactor: { id: DEV("km1"), label: "KM1", energized: Boolean(result.stableDeviceStates[DEV("km1")]) },
          modeRelay: { id: DEV("k"), label: "K", energized: Boolean(result.stableDeviceStates[DEV("k")]) }
        },
        motor: {
          id: DEV("m1"),
          label: "M",
          state: motor.state,
          running: motor.running,
          direction: motor.direction
        }
      };
    }

    function normalizeSolverResult() {
      return clone(solver.getSolverResult());
    }

    function getOperationViewModel() {
      const state = getStateSnapshot();
      const controls = state.operation.controls;
      const powerClosed = state.operation.power === "closed";
      const overload = state.operation.protections.overload === "overload";
      const schemeName = { one: "方式一", two: "方式二", three: "方式三" }[controls.scheme];
      const startVisible = controls.scheme !== "one" || controls.saMode === "continuous";
      const jogLabel = controls.scheme === "one" ? "SB1 点动" : "SB3 点动";
      const protection = {
        slot: "primary",
        visible: true,
        label: "FR1 过载",
        resetLabel: "FR1 复位",
        tripped: overload,
        toggleAction: "PROTECTION_TOGGLE",
        resetAction: "PROTECTION_RESET"
      };
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: {
          deviceId: DEV("qf1"),
          closed: powerClosed,
          closeLabel: "QF1 合闸",
          openLabel: "QF1 分闸",
          closeEnabled: !powerClosed,
          openEnabled: powerClosed
        },
        controls: [
          { slot: "primary", visible: startVisible, label: "SB1 长动启动", stateText: state.motor.running ? "运行中" : "待命", buttonClass: "forward", action: "START_PRIMARY_PRESS" },
          { slot: "secondary", visible: true, label: jogLabel, stateText: "按住运行 / 松开停止", buttonClass: "forward", pressAction: "JOG_PRESS", releaseAction: "JOG_RELEASE" },
          { slot: "tertiary", visible: true, label: "SB2 停止", stateText: state.motor.running ? "可停止" : "已停止", buttonClass: "stop", action: "STOP_PRIMARY_PRESS" },
          { slot: "quaternary", visible: false }
        ],
        protection,
        protections: [protection],
        actionStates: [
          { id: "scheme", label: "当前接线", currentState: controls.scheme, availableTransitions: ["one", "two", "three"], onAction: "START_SECONDARY_PRESS", feedbackText: `${schemeName}由模块画布顶部切换，切换时安全复位。` },
          { id: "power", label: "QF1", currentState: powerClosed ? "closed" : "open", availableTransitions: [powerClosed ? "open" : "close"], onAction: powerClosed ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: "QF1 三极联动，分闸后所有保持状态清除。" },
          { id: "jog", label: jogLabel, currentState: controls.jog, availableTransitions: [controls.jog === "pressed" ? "release" : "press"], onAction: controls.jog === "pressed" ? "JOG_RELEASE" : "JOG_PRESS", feedbackText: "点动按钮遵循按下导通、松开断开的瞬时逻辑。" },
          { id: "stop", label: "SB2", currentState: state.motor.running ? "running" : "stopped", availableTransitions: ["stop"], onAction: "STOP_PRIMARY_PRESS", feedbackText: "SB2 切断保持路径，不直接写入电机状态。" },
          { id: "protection", label: "FR1", currentState: overload ? "overload" : "normal", availableTransitions: [overload ? "reset" : "trip"], onAction: overload ? "PROTECTION_RESET" : "PROTECTION_TOGGLE", feedbackText: "FR1 动作后控制 NC 断开；复位不会自动启动。" }
        ]
      };
    }

    function getStatusViewModel() {
      const state = getStateSnapshot();
      const controls = state.operation.controls;
      const overload = state.operation.protections.overload === "overload";
      const schemeName = { one: "方式一", two: "方式二", three: "方式三" }[controls.scheme];
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          { id: "scheme", label: "接线方式", value: schemeName, tone: "on" },
          { id: "power", label: "QF1", value: state.operation.power === "closed" ? "已合闸" : "分闸", tone: state.operation.power === "closed" ? "on" : "off" },
          { id: "km1", label: "KM1", value: state.devices.primaryContactor.energized ? "吸合" : "释放", tone: state.devices.primaryContactor.energized ? "forward" : "off" },
          { id: "relayK", label: "继电器 K", value: controls.scheme === "three" ? state.devices.modeRelay.energized ? "得电" : "失电" : "本方式未使用", tone: state.devices.modeRelay.energized ? "forward" : "off" },
          { id: "motor", label: "M", value: state.motor.running ? "运行" : overload ? "保护停止" : "停止", tone: overload ? "error" : state.motor.running ? "forward" : "off" },
          { id: "protection", label: "FR1", value: overload ? "已过载" : "正常", tone: overload ? "error" : "on" }
        ]
      };
    }

    function buildTeachingFeedback() {
      const state = getStateSnapshot();
      const raw = solver.getState();
      const schemeName = { one: "方式一", two: "方式二", three: "方式三" }[state.operation.controls.scheme];
      const steps = state.motor.running
        ? state.operation.controls.scheme === "three"
          ? ["控制电源与 FR1 保护路径完整", state.devices.modeRelay.energized ? "K 得电并保持" : "SB3 点动路径闭合", "KM1 线圈得电", "KM1 主触点闭合", "三相电源到达 M"]
          : ["控制电源与 FR1 保护路径完整", state.operation.controls.jog === "pressed" ? "点动按钮保持导通" : "KM1 辅助触点建立自锁", "KM1 线圈得电", "KM1 主触点闭合", "M 运行"]
        : ["当前没有完整的 KM1 线圈通路", "KM1 主触点保持断开", "M 停止"];
      return {
        title: `${schemeName}｜${state.motor.running ? "电机运行" : "电机停止"}`,
        text: raw.lastAction.message,
        steps,
        source: "Solver stableDeviceStates / activeWireIds"
      };
    }

    function buildReplaySteps() {
      const scheme = getStateSnapshot().operation.controls.scheme;
      const prepare = [
        { label: "复位模块", action: "RESET_MODULE", payload: {} },
        { label: "选择接线方式", action: "START_SECONDARY_PRESS", payload: { scheme } },
        { label: "QF1 合闸", action: "POWER_CLOSE", payload: {} }
      ];
      if (scheme === "one") {
        return [...prepare,
          { label: "SA 切换长动", action: "START_SECONDARY_PRESS", payload: { kind: "sa", position: "continuous" } },
          { label: "SB1 启动并建立自锁", action: "START_PRIMARY_PRESS", payload: {} },
          { label: "SB2 停止", action: "STOP_PRIMARY_PRESS", payload: {} }
        ];
      }
      return [...prepare,
        { label: "SB1 长动启动", action: "START_PRIMARY_PRESS", payload: {} },
        { label: "SB2 停止", action: "STOP_PRIMARY_PRESS", payload: {} },
        { label: "按住点动按钮", action: "JOG_PRESS", payload: {} },
        { label: "松开点动按钮", action: "JOG_RELEASE", payload: {} }
      ];
    }

    function render() {
      if (!mounted || !context.mountRoot) return;
      renderer.render({
        root: context.mountRoot,
        circuitData,
        internalState: solver.getState(),
        solverResult: solver.getSolverResult(),
        dispatch: (type, payload = {}) => dispatchAction(contracts.createAction(type, payload, "module-canvas"))
      });
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${MODULE_ID} action: ${report.errors.join("; ")}`);
      solver.dispatch(action);
      render();
      context.services?.renderShell?.();
      return {
        action,
        state: getStateSnapshot(),
        solverResult: normalizeSolverResult(),
        operationViewModel: getOperationViewModel(),
        statusViewModel: getStatusViewModel(),
        feedback: buildTeachingFeedback()
      };
    }

    function reset() {
      solver.reset();
      render();
      return getStateSnapshot();
    }

    return Object.freeze({
      createInitialState: () => { solver.reset(); return getStateSnapshot(); },
      getStateSnapshot,
      dispatchAction,
      solve: (message = "mixed control facade solve") => { solver.solve(message); return normalizeSolverResult(); },
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

  platform.moduleFacades.createMixedControlFacade = createMixedControlFacade;
})(globalThis);
