(function installCh01LimitTextbookFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch01_limit";
  const ROUTE_ID = "ch01-limit-switch-control";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  platform.moduleFacades.createCh01LimitTextbookFacade = ({ context, circuitData }) => {
    const contracts = platform.contracts;
    const solver = platform.moduleSolvers.ch01LimitTextbook;
    const teaching = platform.ch01LimitTextbookTeaching;
    const renderer = platform.moduleRenderers.createCh01LimitTextbookRenderer(circuitData);
    let state = solver.createInitialState();
    let result = null;
    let mounted = false;
    let paused = false;
    let inputController = null;
    const pointerOwners = new Map();
    const keyOwners = new Map();
    const canvasOwners = new Map();
    const playback = platform.createReversePlayback({
      scope: context.scope,
      teaching,
      evaluate(spec) {
        let solved = solver.solve(solver.createInitialState());
        for (const item of spec.actions) solved = solver.solve(solver.reduce(solved.state, item.command, item.payload || {}));
        return clone(solved);
      },
      onChange() { refresh(); }
    });
    function solveNow() {
      const solved = solver.solve(state);
      state = solved.state;
      result = solved.solverResult;
      return result;
    }
    const solvedRaw = (raw) => raw?.state && raw?.solverResult ? raw : { state, solverResult: result || solver.solve(state).solverResult };
    const displayed = () => solvedRaw(playback.current()?.displayState?.raw);
    function snapshot(raw) {
      const solved = solvedRaw(raw);
      const op = solved.state.operationState;
      const out = solved.solverResult;
      const motor = out.motorStates.M;
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        routeId: ROUTE_ID,
        operation: { power: op.power, scene: "limit-switch", controls: clone(op.buttons), protections: { FR1: op.fr1, SQ: op.sq } },
        devices: {
          KM: { id: "KM1", energized: Boolean(out.stableDeviceStates.KM) },
          SB1: { id: "SB1", pressed: op.buttons.sb1 === "pressed" },
          SB2: { id: "SB2", pressed: op.buttons.sb2 === "pressed" },
          FR1: { id: "FR1", tripped: op.fr1 === "tripped" },
          SQ: { id: "SQ", triggered: op.sq === "triggered" }
        },
        motor: { id: "M", state: motor.running ? "running" : "stopped", running: motor.running, direction: motor.direction, extension: clone(motor) }
      };
    }
    function normalized(raw) {
      const out = solvedRaw(raw).solverResult;
      return {
        ...contracts.createEmptySolverResult(MODULE_ID),
        ...clone(out),
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        activeWireIds: [...new Set([...(out.activeMainWireIds || []), ...(out.activeControlWireIds || [])])]
      };
    }
    function visual(raw) {
      const solved = solvedRaw(raw);
      const out = solved.solverResult;
      return {
        ...normalized(raw),
        pressed: clone(solved.state.operationState.buttons),
        stableDeviceStates: clone(out.stableDeviceStates),
        motorStates: clone(out.motorStates),
        edgeStates: clone(out.edgeStates),
        protectionStates: clone(out.protectionStates),
        operation: clone(solved.state.operationState)
      };
    }
    function operationView() {
      const op = displayed().state.operationState;
      const controls = [
        { slot: "primary", visible: true, label: "启动按钮 SB1", stateText: op.buttons.sb1 === "pressed" ? "按下 · 常开闭合" : "释放 · 常开断开", buttonClass: "forward", action: "JOG_PRESS", payload: { command: "start" }, momentary: true },
        { slot: "secondary", visible: true, label: "停止按钮 SB2", stateText: op.buttons.sb2 === "pressed" ? "按下 · 常闭断开" : "释放 · 常闭闭合", buttonClass: "stop", action: "JOG_PRESS", payload: { command: "stop" }, momentary: true }
      ];
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        power: { deviceId: "SUPPLY", layout: "single-toggle", closed: op.power === "closed", closeLabel: "接通电源", openLabel: "断开电源", closeEnabled: op.power !== "closed", openEnabled: op.power === "closed" },
        controls,
        protections: [
          { slot: "primary", visible: true, label: op.fr1 === "tripped" ? "FR1 已过载动作" : "触发 FR1 过载", resetLabel: "复位 FR1", toggleAction: "PROTECTION_TOGGLE", togglePayload: { protection: "fr1" }, resetAction: "PROTECTION_RESET", resetPayload: { protection: "fr1" } },
          { slot: "secondary", visible: true, label: op.sq === "triggered" ? "SQ 已到达行程" : "触发 SQ 行程开关", resetLabel: "复位 SQ", toggleAction: "PROTECTION_SECONDARY_TOGGLE", togglePayload: { protection: "sq" }, resetAction: "PROTECTION_SECONDARY_RESET", resetPayload: { protection: "sq" } }
        ],
        actionStates: controls.map((item) => ({ id: item.payload.command, label: item.label, currentState: item.stateText, availableTransitions: ["JOG_PRESS", "JOG_RELEASE"], onAction: item.action, feedbackText: "SB1 启动，KM1 自锁；SB2、FR1、SQ 断开控制回路。" })),
        extension: { limitSwitch: op.sq === "triggered", overload: op.fr1 === "tripped", hasSelfHold: true }
      };
    }
    function statusView() {
      const solved = displayed();
      const op = solved.state.operationState;
      const out = solved.solverResult;
      const motor = out.motorStates.M;
      const row = (id, label, value, active) => ({ id, label, value, tone: active ? "on" : "off" });
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: MODULE_ID,
        rows: [
          row("supply", "外部电源", op.power === "closed" ? "已接通" : "已断开", op.power === "closed"),
          row("km", "KM1 线圈", out.stableDeviceStates.KM ? "得电吸合" : "失电释放", out.stableDeviceStates.KM),
          row("motor", "电动机 M", motor.running ? "三相运行" : "已停止", motor.running),
          row("protection", "FR1 / SQ", op.fr1 === "tripped" ? "FR1 过载动作" : op.sq === "triggered" ? "SQ 行程动作" : "常闭正常", op.fr1 !== "tripped" && op.sq !== "triggered"),
          row("mode", "控制方式", "SB1 自锁 + SQ 行程停止", true),
          row("phase", "相序", motor.running ? motor.phaseSequence.join(" → ") : "未建立三相通路", motor.running)
        ]
      };
    }
    function feedback() {
      const current = playback.current();
      if (current) return { title: current.title, text: current.text, tone: "info", source: "Playback" };
      return { ...(teaching?.liveFeedback ? teaching.liveFeedback(snapshot(), result) : { title: "行程开关控制", text: "接通电源后按 SB1 启动。", tone: "info" }), source: "Solver" };
    }
    function playbackView() {
      const current = playback.current();
      const raw = current?.displayState?.raw;
      return { ...clone(playback.view()), displayState: { source: current ? "Playback" : "Live", visualState: visual(raw), solverResult: normalized(raw), snapshot: snapshot(raw), teachingFocus: current?.displayState?.teachingFocus || [] } };
    }
    function refresh() { if (mounted && !paused) { render(); context.services?.renderShell?.(); } }
    function clearOwners() { pointerOwners.clear(); keyOwners.clear(); canvasOwners.clear(); }
    function ownerCount() { return pointerOwners.size + keyOwners.size + [...canvasOwners.values()].reduce((total, count) => total + count, 0); }
    function releaseAll() { clearOwners(); renderer.resetInput?.(); state = solver.reduce(state, "release"); solveNow(); }
    function ownersFor(command) { return [...pointerOwners.values(), ...keyOwners.values()].filter((value) => value === command).length + (canvasOwners.get(command) || 0); }
    function releaseOwned(command, source) { if (!ownersFor(command)) dispatch(contracts.createAction("JOG_RELEASE", { command }, source)); }
    function render() {
      if (!mounted || paused || !context.mountRoot) return;
      const view = playbackView().displayState;
      renderer.render({
        root: context.mountRoot,
        visualState: view.visualState,
        source: view.source,
        teachingFocus: view.teachingFocus,
        onAction(id, value) {
          const command = typeof value === "string" ? value : value?.command;
          if (id === "pressControl") {
            canvasOwners.set(command, (canvasOwners.get(command) || 0) + 1);
            dispatch(contracts.createAction("JOG_PRESS", { command }, "module-canvas"));
          } else if (id === "releaseControl") {
            const remaining = Math.max(0, (canvasOwners.get(command) || 0) - 1);
            if (remaining) canvasOwners.set(command, remaining); else canvasOwners.delete(command);
            releaseOwned(command, "module-canvas");
          } else if (id === "toggleProtection") {
            const op = state.operationState;
            const actionType = command === "sq"
              ? (op.sq === "triggered" ? "PROTECTION_SECONDARY_RESET" : "PROTECTION_SECONDARY_TOGGLE")
              : (op.fr1 === "tripped" ? "PROTECTION_RESET" : "PROTECTION_TOGGLE");
            dispatch(contracts.createAction(actionType, { protection: command }, "module-canvas"));
          }
        }
      });
      context.services?.onModuleRender?.(MODULE_ID);
    }
    function dispatch(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(report.errors.join("; "));
      const payload = action.payload || {};
      let command = payload.command;
      if (!command) command = ({ POWER_CLOSE: "powerClose", POWER_OPEN: "powerOpen", START_PRIMARY_PRESS: "start", STOP_PRIMARY_PRESS: "stop", STOP_PRESS: "stop", JOG_PRESS: "start", JOG_RELEASE: "release", PROTECTION_TOGGLE: payload.protection === "sq" ? "sqTrip" : "fr1Trip", PROTECTION_RESET: payload.protection === "sq" ? "sqReset" : "fr1Reset", PROTECTION_SECONDARY_TOGGLE: "sqTrip", PROTECTION_SECONDARY_RESET: "sqReset", RESET_MODULE: "reset" })[action.type];
      if (action.type === "JOG_PRESS" && payload.command === "stop") command = "stop";
      if (action.type === "JOG_RELEASE") command = "release";
      if (!["powerClose", "powerOpen", "start", "stop", "release", "sqTrip", "sqReset", "fr1Trip", "fr1Reset", "reset"].includes(command)) throw new Error(`Unsupported textbook limit action: ${action.type}`);
      playback.cancel();
      if (command === "reset") { clearOwners(); renderer.resetInput?.(); }
      state = solver.reduce(state, command, payload);
      solveNow();
      refresh();
      const output = { action, state: snapshot(), solverResult: normalized(), operationViewModel: operationView(), statusViewModel: statusView(), feedback: feedback() };
      contracts.assertFacadeOutputs({ meta: { moduleId: MODULE_ID }, getStateSnapshot: () => output.state, normalizeSolverResult: () => output.solverResult, getOperationViewModel: () => output.operationViewModel, getStatusViewModel: () => output.statusViewModel });
      return output;
    }
    function attachInputs() {
      inputController?.abort();
      inputController = new AbortController();
      const doc = global.document;
      if (!doc) return;
      const options = { capture: true, signal: inputController.signal };
      const controlAt = (target) => {
        const el = target?.closest?.("#pressSb1:not(.hidden):not(:disabled), #pressSb2:not(.hidden):not(:disabled)");
        return el ? (el.id === "pressSb1" ? "start" : "stop") : null;
      };
      const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      doc.addEventListener("pointerdown", (event) => { const command = controlAt(event.target); if (!mounted || paused || event.button !== 0 || !command) return; swallow(event); pointerOwners.set(event.pointerId, command); dispatch(contracts.createAction("JOG_PRESS", { command }, "module-shell-pointer")); }, options);
      const end = (event) => { const command = pointerOwners.get(event.pointerId); if (!command) return; swallow(event); pointerOwners.delete(event.pointerId); releaseOwned(command, "module-shell-pointer"); };
      doc.addEventListener("pointerup", end, options); doc.addEventListener("pointercancel", end, options);
      doc.addEventListener("keydown", (event) => { const command = controlAt(event.target); if (!mounted || paused || !command || ![" ", "Enter"].includes(event.key) || event.repeat) return; swallow(event); keyOwners.set(event.key, command); dispatch(contracts.createAction("JOG_PRESS", { command }, "module-shell-keyboard")); }, options);
      doc.addEventListener("keyup", (event) => { const command = keyOwners.get(event.key); if (!command) return; swallow(event); keyOwners.delete(event.key); releaseOwned(command, "module-shell-keyboard"); }, options);
      doc.addEventListener("click", (event) => {
        const command = controlAt(event.target);
        if (!mounted || paused || !command) return;
        swallow(event);
        if (event.detail === 0 && !ownerCount()) {
          dispatch(contracts.createAction("JOG_PRESS", { command }, "module-shell-keyboard-click"));
          releaseOwned(command, "module-shell-keyboard-click");
        }
      }, options);
      global.addEventListener?.("blur", () => { if (ownerCount()) { releaseAll(); refresh(); } }, { signal: inputController.signal });
    }
    context.scope?.addCleanup(() => { inputController?.abort(); clearOwners(); });
    solveNow();
    return Object.freeze({
      createInitialState(seed = {}) { playback.cancel(); clearOwners(); renderer.resetInput?.(); state = solver.createInitialState(seed); solveNow(); return snapshot(); },
      getStateSnapshot: snapshot,
      dispatchAction: dispatch,
      normalizeSolverResult: normalized,
      getOperationViewModel: operationView,
      getStatusViewModel: statusView,
      buildTeachingFeedback: feedback,
      getPlaybackViewModel: playbackView,
      buildReplaySteps: () => clone(playback.steps()),
      dispatchPlayback(command, value) {
        if (["restart", "toggle", "prev", "next"].includes(command)
          && (ownerCount() || Object.values(state.operationState.buttons).includes("pressed"))) releaseAll();
        return playback.command(command, value);
      },
      solve() { playback.cancel(); solveNow(); return normalized(); },
      mount() { mounted = true; paused = false; global.document?.body?.classList.add("ch01-limit-textbook-active"); attachInputs(); },
      render,
      reset() { playback.cancel(); clearOwners(); renderer.resetInput?.(); state = solver.createInitialState(); solveNow(); refresh(); return snapshot(); },
      pause() { paused = true; playback.cancel(); releaseAll(); renderer.resetInput?.(); },
      resume() { paused = false; refresh(); },
      unmount() { mounted = false; paused = false; playback.cancel(); inputController?.abort(); inputController = null; releaseAll(); renderer.unmount({ root: context.mountRoot }); global.document?.body?.classList.remove("ch01-limit-textbook-active"); },
      validateGeometry: () => circuitData.validateGeometry(),
      runTests: () => solver.runTests()
    });
  };
})(globalThis);
