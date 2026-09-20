(function installCh01JogTextbookFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch01_jog", ROUTE_ID = "ch01-jog-control";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  platform.moduleFacades.createCh01JogTextbookFacade = ({ context, circuitData }) => {
    const contracts = platform.contracts, solver = platform.moduleSolvers.ch01JogTextbook;
    const teaching = platform.ch01JogTextbookTeaching, renderer = platform.moduleRenderers.createCh01JogTextbookRenderer(circuitData);
    let state = solver.createInitialState(), result, mounted = false, paused = false, inputController = null;
    const pointerOwners = new Set(), keyOwners = new Set(); let canvasHeld = false;
    const playback = platform.createReversePlayback({ scope: context.scope, teaching,
      evaluate(spec) {
        let solved = solver.solve(solver.createInitialState());
        for (const item of spec.actions) solved = solver.solve(solver.reduce(solved.state, item.command, item.payload || {}));
        return clone(solved);
      }, onChange() { refresh(); } });
    const solveNow = () => { const solved = solver.solve(state); state = solved.state; result = solved.solverResult; return result; };
    const solvedRaw = (raw) => raw?.state && raw?.solverResult ? raw : { state, solverResult: result };
    const displayed = () => solvedRaw(playback.current()?.displayState?.raw);
    const ownCount = () => pointerOwners.size + keyOwners.size + (canvasHeld ? 1 : 0);
    function snapshot(raw) {
      const solved = solvedRaw(raw), op = solved.state.operationState, electrical = solved.solverResult, motor = electrical.motorStates.M;
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, routeId: ROUTE_ID,
        operation: { power: op.power, scene: "jog", controls: clone(op.buttons), protections: {} },
        devices: { KM: { id: "KM", energized: Boolean(electrical.stableDeviceStates.KM) }, SB1: { id: "SB1", pressed: op.buttons.sb1 === "pressed" } },
        motor: { id: "M", state: motor.running ? "running" : "stopped", running: motor.running, direction: motor.direction, extension: { M: clone(motor) } } };
    }
    function normalized(raw) {
      const electrical = solvedRaw(raw).solverResult;
      return { ...contracts.createEmptySolverResult(MODULE_ID), ...clone(electrical), schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID,
        activeWireIds: [...new Set([...(electrical.activeMainWireIds || []), ...(electrical.activeControlWireIds || [])])] };
    }
    function visual(raw) {
      const solved = solvedRaw(raw), electrical = solved.solverResult;
      return { ...normalized(raw), pressed: { sb1: solved.state.operationState.buttons.sb1 === "pressed" }, stableDeviceStates: clone(electrical.stableDeviceStates), motorStates: clone(electrical.motorStates), edgeStates: clone(electrical.edgeStates) };
    }
    function operationView() {
      const op = displayed().state.operationState;
      // Local capture owns all phases; the old Shell's secondary-only release
      // listener must not receive a releaseAction for this primary control.
      const control = { slot: "primary", visible: true, label: "按住点动 · SB1", stateText: op.buttons.sb1 === "pressed" ? "按住中 · 松开停止" : "按住运行 · 松开停止", buttonClass: "forward", action: "JOG_PRESS", payload: { command: "jog" }, momentary: true };
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID,
        power: { deviceId: "SUPPLY", layout: "single-toggle", closed: op.power === "closed", closeLabel: "接通电源", openLabel: "断开电源", closeEnabled: op.power !== "closed", openEnabled: op.power === "closed" },
        controls: [control], protections: [], protection: { visible: false },
        actionStates: [{ id: "jog", label: control.label, currentState: control.stateText, availableTransitions: ["JOG_PRESS", "JOG_RELEASE"], onAction: "JOG_PRESS", feedbackText: "按住 SB1，KM 得电；松开 SB1，KM 立即释放。" }],
        extension: { powerMeaning: "外部供电环境，教材中未画电源开关", hasSelfHold: false } };
    }
    function statusView() {
      const solved = displayed(), op = solved.state.operationState, electrical = solved.solverResult, running = electrical.motorStates.M.running;
      const row = (id, label, value, active) => ({ id, label, value, tone: active ? "on" : "off" });
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, rows: [
        row("supply", "外部电源", op.power === "closed" ? "已接通" : "已断开", op.power === "closed"),
        row("sb1", "点动按钮 SB1", op.buttons.sb1 === "pressed" ? "按下 · NO 闭合" : "释放 · NO 断开", op.buttons.sb1 === "pressed"),
        row("km", "KM 线圈", electrical.stableDeviceStates.KM ? "得电吸合" : "失电释放", electrical.stableDeviceStates.KM),
        row("contacts", "KM 三相主触点", electrical.stableDeviceStates.KM ? "同步闭合" : "同步断开", electrical.stableDeviceStates.KM),
        row("motor", "电动机 M", running ? "点动运行" : "已停止", running),
        row("phase", "U / V / W 相序", running ? electrical.motorStates.M.phaseSequence.join(" / ") : "无完整三相通路", running),
        row("hold", "保持方式", "无自锁 · 松手即停", false)
      ] };
    }
    function feedback() {
      const current = playback.current();
      return current ? { title: current.title, text: current.text, tone: "info", source: "Playback" } : { ...teaching.liveFeedback(snapshot(), result), source: "Solver" };
    }
    function playbackView() {
      const current = playback.current(), raw = current?.displayState?.raw;
      return { ...clone(playback.view()), displayState: { source: current ? "Playback" : "Live", visualState: visual(raw), solverResult: normalized(raw), snapshot: snapshot(raw), teachingFocus: current?.displayState?.teachingFocus || [] } };
    }
    function refresh() { if (mounted && !paused) { render(); context.services?.renderShell?.(); } }
    function clearOwners() { pointerOwners.clear(); keyOwners.clear(); canvasHeld = false; }
    function releaseAll() { clearOwners(); state = solver.reduce(state, "release"); solveNow(); }
    function releaseLast(source) { if (!ownCount()) dispatch(contracts.createAction("JOG_RELEASE", { command: "jog" }, source)); }
    function render() {
      if (!mounted || paused || !context.mountRoot) return;
      const view = playbackView().displayState;
      renderer.render({ root: context.mountRoot, visualState: view.visualState, source: view.source, teachingFocus: view.teachingFocus,
        onAction(id) {
          if (id === "pressControl") { canvasHeld = true; dispatch(contracts.createAction("JOG_PRESS", { command: "jog" }, "module-canvas")); }
          if (id === "releaseControl") { canvasHeld = false; releaseLast("module-canvas"); }
        } });
      context.services?.onModuleRender?.(MODULE_ID);
    }
    function dispatch(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input, report = contracts.validateAction(action);
      if (!report.valid) throw new Error(report.errors.join("; "));
      const command = action.payload.command || ({ POWER_CLOSE: "powerClose", POWER_OPEN: "powerOpen", JOG_PRESS: "jog", JOG_RELEASE: "release", START_PRIMARY_PRESS: "jog", STOP_PRIMARY_PRESS: "release", RESET_MODULE: "reset" })[action.type];
      const actual = action.type === "JOG_RELEASE" ? "release" : command;
      if (!["powerClose", "powerOpen", "powerToggle", "jog", "release", "reset"].includes(actual)) throw new Error(`Unsupported textbook jog action: ${action.type}`);
      playback.cancel();
      // Supply switching does not release a physically held SB1. Restoring
      // power while held therefore runs exactly as the textbook graph does.
      if (actual === "reset") { clearOwners(); renderer.resetInput?.(); }
      state = solver.reduce(state, actual, action.payload); solveNow(); refresh();
      const output = { action, state: snapshot(), solverResult: normalized(), operationViewModel: operationView(), statusViewModel: statusView(), feedback: feedback() };
      contracts.assertFacadeOutputs({ meta: { moduleId: MODULE_ID }, getStateSnapshot: () => output.state, normalizeSolverResult: () => output.solverResult, getOperationViewModel: () => output.operationViewModel, getStatusViewModel: () => output.statusViewModel });
      return output;
    }
    function attachInputs() {
      inputController?.abort(); inputController = new AbortController();
      const doc = global.document; if (!doc) return;
      const options = { capture: true, signal: inputController.signal };
      const isControl = (target) => Boolean(target?.closest?.("#pressSb1:not(.hidden):not(:disabled)"));
      const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      const press = (source) => dispatch(contracts.createAction("JOG_PRESS", { command: "jog" }, source));
      doc.addEventListener("pointerdown", (event) => {
        if (!mounted || paused || event.button !== 0 || !isControl(event.target)) return;
        swallow(event); pointerOwners.add(event.pointerId); press("module-shell-pointer");
      }, options);
      const pointerEnd = (event) => { if (!pointerOwners.delete(event.pointerId)) return; swallow(event); releaseLast("module-shell-pointer"); };
      doc.addEventListener("pointerup", pointerEnd, options); doc.addEventListener("pointercancel", pointerEnd, options);
      doc.addEventListener("keydown", (event) => {
        if (!mounted || paused || ![" ", "Enter"].includes(event.key) || !isControl(event.target)) return;
        swallow(event); if (event.repeat) return; keyOwners.add(event.key); press("module-shell-keyboard");
      }, options);
      doc.addEventListener("keyup", (event) => { if (!keyOwners.delete(event.key)) return; swallow(event); releaseLast("module-shell-keyboard"); }, options);
      doc.addEventListener("click", (event) => {
        if (!mounted || paused || !isControl(event.target)) return;
        swallow(event); if (event.detail === 0 && !ownCount()) { press("module-shell-tap"); releaseLast("module-shell-tap"); }
      }, options);
      global.addEventListener?.("blur", () => { if (ownCount()) { releaseAll(); refresh(); } }, { signal: inputController.signal });
    }
    context.scope?.addCleanup(() => { inputController?.abort(); clearOwners(); });
    solveNow();
    return Object.freeze({
      createInitialState(seed = {}) { playback.cancel(); clearOwners(); renderer.resetInput?.(); state = solver.createInitialState(seed); solveNow(); return snapshot(); },
      getStateSnapshot: snapshot, dispatchAction: dispatch, normalizeSolverResult: normalized, getOperationViewModel: operationView, getStatusViewModel: statusView, buildTeachingFeedback: feedback,
      getPlaybackViewModel: playbackView, buildReplaySteps: () => clone(playback.steps()),
      dispatchPlayback(command, value) { const view = playback.command(command, value); refresh(); return view; },
      solve() { playback.cancel(); solveNow(); return normalized(); },
      mount() { mounted = true; paused = false; global.document?.body?.classList.add("ch01-jog-textbook-active"); attachInputs(); }, render,
      reset() { playback.cancel(); clearOwners(); renderer.resetInput?.(); state = solver.createInitialState(); solveNow(); refresh(); return snapshot(); },
      pause() { paused = true; playback.cancel(); releaseAll(); renderer.resetInput?.(); },
      resume() { paused = false; refresh(); },
      unmount() { mounted = false; paused = false; playback.cancel(); inputController?.abort(); inputController = null; releaseAll(); global.document?.body?.classList.remove("ch01-jog-textbook-active"); renderer.unmount({ root: context.mountRoot }); },
      validateGeometry: () => circuitData.validateGeometry(), runTests: () => solver.runTests()
    });
  };
})(globalThis);
