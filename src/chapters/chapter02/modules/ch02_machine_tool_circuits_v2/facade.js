(function installMachineToolV2Facade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const MODULE_ID = "ch02_machine_tool_circuits_v2", ROUTE_ID = "machine-tool-circuits";
  // The source specifies off-delay operation, but no numeric setting.
  // 1.5 seconds is an explicitly labelled classroom simulation interval.
  const OFF_DELAY_MS = 1500;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const buttonForCommand = Object.freeze({ spindleStop: "sb1", spindleStart: "sb2", rockerUp: "sb3", rockerDown: "sb4", loosen: "sb5", clamp: "sb6" });
  const slots = Object.freeze({ pressSb1: "primary", pressSb2: "secondary", pressSb3: "tertiary", pressSb4: "quaternary" });

  function createFacade({ context, circuitData }) {
    const contracts = platform.contracts, solver = platform.moduleSolvers?.ch02MachineToolCircuitsV2;
    const teaching = platform.machineToolV2Teaching, rendererFactory = platform.moduleRenderers?.createMachineToolCircuitsV2Renderer;
    if (!contracts || !solver || !teaching || !rendererFactory || !circuitData) throw new Error(`${MODULE_ID} dependencies did not load`);
    const renderer = rendererFactory(circuitData);
    let state = solver.createInitialState(), solverResult;
    let mounted = false, paused = false, lastAction = null, shellController = null;
    let ktTimer = null, ktDeadline = 0, ktRemaining = OFF_DELAY_MS, wasTiming = false;
    const heldPointers = new Map(), heldKeys = new Map(), heldCanvas = new Set();

    function evaluateScenario(spec) {
      let solved = solver.solve(solver.createInitialState({ operationState: { scene: spec.scene || "spindle" } }));
      for (const item of spec.actions || []) solved = solver.solve(solver.reduce(solved.state, item.command, item.payload || {}));
      return clone({ state: solved.state, solverResult: solved.solverResult });
    }
    const playback = platform.createMachineToolV2Playback({ scope: context.scope, teaching, evaluate: evaluateScenario,
      onChange() { syncTimer(); refresh(); } });

    function clearTimer(preserveRemaining = false) {
      if (ktTimer === null) return;
      if (preserveRemaining) ktRemaining = Math.max(0, ktDeadline - Date.now());
      if (context.scope?.clearTimeout) context.scope.clearTimeout(ktTimer); else global.clearTimeout(ktTimer);
      ktTimer = null;
    }
    function syncTimer() {
      if (state.operationState.kt !== "timing") { clearTimer(); wasTiming = false; ktRemaining = OFF_DELAY_MS; return; }
      if (!wasTiming) { wasTiming = true; ktRemaining = OFF_DELAY_MS; }
      if (!mounted || paused || playback.current()) { clearTimer(true); return; }
      // Re-rendering and another button never restart a pending off-delay.
      if (ktTimer !== null) return;
      ktDeadline = Date.now() + ktRemaining;
      const finish = () => {
        ktTimer = null;
        if (!mounted || paused || playback.current() || state.operationState.kt !== "timing") return;
        state = solver.reduce(state, "timerComplete");
        lastAction = { command: "timerComplete", message: "KT 断电延时结束（教学模拟 1.5 秒），延时触点恢复。" };
        recompute(); refresh();
      };
      ktTimer = context.scope?.timeout ? context.scope.timeout(finish, ktRemaining) : global.setTimeout(finish, ktRemaining);
    }
    function recompute() {
      const solved = solver.solve(state); state = solved.state; solverResult = solved.solverResult; syncTimer(); return solverResult;
    }
    function currentRaw() { return playback.current()?.displayState?.raw || null; }
    function solvedRaw(raw = null) { return raw?.state && raw?.solverResult ? raw : { state, solverResult }; }
    function visualState(raw = null) {
      const solved = solvedRaw(raw), result = solved.solverResult, op = solved.state.operationState;
      return {
        activeWireIds: [...new Set([...(result.activeMainWireIds || []), ...(result.activeControlWireIds || [])])],
        activeMainWireIds: [...(result.activeMainWireIds || [])], activeControlWireIds: [...(result.activeControlWireIds || [])],
        activeEdgeIds: [...(result.activeEdgeIds || result.extension?.activeEdgeIds || [])], partialWireIds: [...(result.partialWireIds || [])],
        edgeStates: clone(result.edgeStates || {}), stableDeviceStates: clone(result.stableDeviceStates || {}),
        motorStates: clone(result.motorStates || {}), protectionStates: clone(result.protectionStates || {}),
        pressed: Object.fromEntries(Object.entries(op.buttons).map(([id, value]) => [id, value === "pressed"])), lamps: clone(result.extension?.lamps || {})
      };
    }
    function getStateSnapshot(raw = null) {
      const solved = solvedRaw(raw), op = solved.state.operationState, result = solved.solverResult;
      const devices = Object.fromEntries(Object.entries(result.stableDeviceStates || {}).map(([id, energized]) => [id, { id, energized: Boolean(energized) }]));
      devices.FR1 = { id: "FR1", tripped: op.fr1 === "overload" }; devices.FR2 = { id: "FR2", tripped: op.fr2 === "overload" };
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, routeId: ROUTE_ID,
        operation: { power: op.qf, scene: op.scene, controls: clone(op.buttons), protections: { primary: op.fr1, secondary: op.fr2 },
          limits: { SQ1_UP: op.sq1Upper, SQ1_DOWN: op.sq1Lower, SQ2: op.sq2Loose, SQ3: op.sq3Clamped, SQ4: op.sq4 }, timer: op.kt, lighting: op.sa1, coolant: op.coolant },
        devices, motor: { id: "M1", state: result.motorStates?.M1?.running ? "running" : "stopped", running: Boolean(result.motorStates?.M1?.running), direction: result.motorStates?.M1?.direction || "none", extension: clone(result.motorStates || {}) } };
    }
    function normalizeSolverResult(raw = null) {
      const result = solvedRaw(raw).solverResult;
      return { ...contracts.createEmptySolverResult(MODULE_ID), ...clone(result), schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID,
        activeWireIds: [...new Set([...(result.activeMainWireIds || []), ...(result.activeControlWireIds || [])])], activeEdgeIds: [...(result.activeEdgeIds || result.extension?.activeEdgeIds || [])] };
    }
    function hold(slot, label, command, op, buttonClass = "forward") {
      // Scoped capture below owns both phases for every slot. Do not opt into
      // the old Shell's secondary-only global pointerup release listener.
      return { slot, visible: true, label, buttonClass, stateText: op.buttons[buttonForCommand[command]] === "pressed" ? "按住中 · 松开释放" : "按住操作 · 松开复位", action: "JOG_PRESS", payload: { command }, momentary: true };
    }
    function toggle(slot, label, command, active, action = "PROTECTION_SECONDARY_TOGGLE") {
      return { slot, visible: true, label, buttonClass: active ? "reverse" : "forward", stateText: active ? "已触发 · 点击复位" : "未触发 · 点击模拟", action, payload: { command, value: !active } };
    }
    function getOperationViewModel() {
      const op = solvedRaw(currentRaw()).state.operationState, scene = op.scene;
      const sq2 = (slot) => toggle(slot, "模拟松开到位 · SQ2", "looseLimit", op.sq2Loose);
      const sq3 = (slot) => toggle(slot, "模拟夹紧到位 · SQ3", "clampLimit", op.sq3Clamped);
      const controls = ({
        spindle: [hold("primary", "启动主轴 · SB2", "spindleStart", op), hold("secondary", "停止主轴 · SB1", "spindleStop", op, "stop"), sq3("tertiary")],
        up: [hold("primary", "按住摇臂上升 · SB3", "rockerUp", op), sq2("secondary"), toggle("tertiary", "模拟上限位 · SQ1-1", "upperLimit", op.sq1Upper), sq3("quaternary")],
        down: [hold("primary", "按住摇臂下降 · SB4", "rockerDown", op, "reverse"), sq2("secondary"), toggle("tertiary", "模拟下限位 · SQ1-2", "lowerLimit", op.sq1Lower), sq3("quaternary")],
        loosen: [hold("primary", "按住主轴箱松开 · SB5", "loosen", op), sq2("secondary"), hold("tertiary", "按住主轴箱夹紧 · SB6", "clamp", op, "reverse"), sq3("quaternary")],
        clamp: [hold("primary", "按住主轴箱夹紧 · SB6", "clamp", op, "reverse"), sq3("secondary"), hold("tertiary", "按住主轴箱松开 · SB5", "loosen", op), sq2("quaternary")],
        auxiliary: [toggle("primary", "照明开关 · SA1", "lighting", op.sa1, "START_PRIMARY_PRESS"), toggle("secondary", "冷却泵开关 · SA2", "coolant", op.coolant, "START_SECONDARY_PRESS"), toggle("tertiary", "切换位置指示 · SQ4", "indicator", op.sq4 === "upper", "START_SECONDARY_PRESS"), sq3("quaternary")]
      })[scene] || [];
      const protections = ["primary", "secondary"].map((slot, i) => ({ slot, visible: true, label: `${i ? "液压泵" : "主轴"}过载 · FR${i + 1}`, resetLabel: `复位 FR${i + 1}`, tripped: (i ? op.fr2 : op.fr1) === "overload", toggleAction: i ? "PROTECTION_SECONDARY_TOGGLE" : "PROTECTION_TOGGLE", resetAction: i ? "PROTECTION_SECONDARY_RESET" : "PROTECTION_RESET", togglePayload: { target: slot }, resetPayload: { target: slot } }));
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID,
        power: { deviceId: "QF", layout: "single-toggle", closed: op.qf === "closed", closeLabel: "合闸 · QF", openLabel: "分闸 · QF", closeEnabled: op.qf !== "closed", openEnabled: op.qf === "closed" },
        controls, protection: protections[0], protections,
        actionStates: controls.map((item) => ({ id: item.payload.command, label: item.label, currentState: item.stateText, availableTransitions: item.momentary ? ["JOG_PRESS", "JOG_RELEASE"] : [item.action], onAction: item.action, feedbackText: item.stateText })),
        extension: { activeScene: scene, scenes: clone(teaching.scenes), timerSimulationMs: OFF_DELAY_MS } };
    }
    function getStatusViewModel() {
      const solved = solvedRaw(currentRaw()), op = solved.state.operationState, result = solved.solverResult;
      const active = (id) => Boolean(result.stableDeviceStates?.[id]), lamps = result.extension?.lamps || {};
      const row = (id, label, value, on = false) => ({ id, label, value, tone: on ? "on" : "off" });
      const device = (id, label) => row(id, label, active(id) ? "得电吸合" : "失电释放", active(id));
      const motor = (id, label) => { const s = result.motorStates?.[id]; return row(id, label, s?.running ? ({ up: "上升运行", down: "下降运行", loosen: "松开运行", clamp: "夹紧运行" }[s.direction] || "运行中") : "已停止", s?.running); };
      const qf = row("power", "总电源 QF", op.qf === "closed" ? "已合闸" : "已分闸", op.qf === "closed");
      const fr = (n) => ({ id: `fr${n}`, label: `${n === 1 ? "主轴" : "液压泵"}保护 FR${n}`, value: op[`fr${n}`] === "overload" ? "已过载" : "正常", tone: op[`fr${n}`] === "overload" ? "error" : "on" });
      const timer = row("kt", "KT 断电延时", { idle: "已恢复", energized: "线圈得电", timing: "保持中（模拟 1.5 秒）" }[op.kt] || op.kt, op.kt !== "idle");
      const rocker = [qf, motor("M2", "摇臂电机 M2"), row("interlock", "上升 / 下降接触器", `KM2 ${active("KM2") ? "吸合" : "释放"} / KM3 ${active("KM3") ? "吸合" : "释放"}`, active("KM2") || active("KM3")), timer,
        row("limits", "松开 / 行程联锁", `SQ2 ${op.sq2Loose ? "到位" : "未到位"} · ${op.scene === "up" ? (op.sq1Upper ? "上限已触发" : "上限未触发") : (op.sq1Lower ? "下限已触发" : "下限未触发")}`, op.sq2Loose), motor("M3", "液压泵 M3"), fr(2)];
      const rows = ({
        spindle: [qf, motor("M1", "主轴电机 M1"), device("KM1", "主轴接触器 KM1"), row("sb1", "停止按钮 SB1", op.buttons.sb1 === "pressed" ? "按下 · NC 断开" : "释放 · NC 闭合"), row("sb2", "启动按钮 SB2", op.buttons.sb2 === "pressed" ? "按下 · NO 闭合" : "释放 · NO 断开"), fr(1), row("clamp", "夹紧联锁 SQ3", op.sq3Clamped ? "夹紧到位" : active("KM5") ? "未到位 · 正在自动夹紧" : "未夹紧到位", op.sq3Clamped)],
        up: rocker, down: rocker,
        loosen: [qf, motor("M3", "液压泵 M3"), device("KM4", "松开接触器 KM4"), device("KM5", "夹紧互锁 KM5"), row("sq2", "松开到位 SQ2", op.sq2Loose ? "已到位" : "未到位", op.sq2Loose), device("YV", "电磁阀 YV"), fr(2)],
        clamp: [qf, motor("M3", "液压泵 M3"), device("KM5", "夹紧接触器 KM5"), device("KM4", "松开互锁 KM4"), row("sq3", "夹紧到位 SQ3", op.sq3Clamped ? "已到位" : "未到位 · 自动夹紧许可", op.sq3Clamped), device("YV", "电磁阀 YV"), fr(2)],
        auxiliary: [qf, row("el", "照明灯 EL", lamps.EL ? "点亮" : "熄灭", lamps.EL), motor("M4", "冷却泵 M4"), ...["HL1", "HL2", "HL3"].map((id) => row(id, `指示灯 ${id}`, lamps[id] ? "点亮" : "熄灭", lamps[id])), row("sq4", "位置开关 SQ4", op.sq4 === "upper" ? "已切换" : "教材初始位置")]
      })[op.scene] || [qf];
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: MODULE_ID, rows };
    }
    function buildTeachingFeedback() {
      const current = playback.current();
      if (current) return { title: current.title, text: current.text, tone: "info", source: "Playback" };
      return { ...teaching.liveFeedback(getStateSnapshot(), lastAction, solverResult), source: "Solver" };
    }
    function getPlaybackViewModel() {
      const current = playback.current(), raw = current?.displayState?.raw || null;
      return { ...clone(playback.view()), displayState: { source: current ? "Playback" : "Live", visualState: visualState(raw), solverResult: normalizeSolverResult(raw), snapshot: getStateSnapshot(raw), teachingFocus: current?.displayState?.teachingFocus || [] } };
    }
    function refresh() { if (mounted && !paused) { render(); context.services?.renderShell?.(); } }
    function releaseAll() {
      heldPointers.clear(); heldKeys.clear(); heldCanvas.clear();
      if (Object.values(state.operationState.buttons).some((value) => value === "pressed")) { state = solver.reduce(state, "release"); recompute(); }
    }
    function releaseOwned(command, source) {
      // One physical command may have more than one input owner (two keys,
      // pointer plus key, or a canvas control plus a Shell control).
      if (heldCanvas.has(command) || [...heldPointers.values(), ...heldKeys.values()].includes(command)) return;
      dispatchAction(contracts.createAction("JOG_RELEASE", { command }, source));
    }
    function selectScene(id) {
      if (!teaching.scenes.some((scene) => scene.id === id)) return;
      playback.cancel(); releaseAll(); state = solver.reduce(state, "scene", { scene: id }); recompute();
      lastAction = { command: "scene", message: teaching.scenes.find((scene) => scene.id === id).description };
      playback.command("scenario", id); refresh();
    }
    function render() {
      if (!mounted || paused || !context.mountRoot) return;
      const display = getPlaybackViewModel().displayState;
      renderer.render({ root: context.mountRoot, visualState: display.visualState, activeScene: display.snapshot.operation.scene, teachingFocus: display.teachingFocus, source: display.source,
        onAction(id, value) {
          if (id === "scene") { selectScene(value); return; }
          if (id === "pressControl" || id === "releaseControl") {
            const command = typeof value === "string" ? value : value.command;
            if (id === "pressControl") { heldCanvas.add(command); dispatchAction(contracts.createAction("JOG_PRESS", { command }, "module-canvas")); }
            else { heldCanvas.delete(command); releaseOwned(command, "module-canvas"); }
            return;
          }
          const commands = { QF: "powerToggle", SA1: "lighting", SA2: "coolant", powerToggle: "powerToggle", lighting: "lighting", coolant: "coolant", indicator: "indicator", upperLimit: "upperLimit", lowerLimit: "lowerLimit", looseLimit: "looseLimit", clampLimit: "clampLimit", fr1Trip: "fr1Trip", fr2Trip: "fr2Trip" };
          const command = commands[id] || (buttonForCommand[id] ? id : null);
          if (command) {
            const position = { upperLimit: "sq1Upper", lowerLimit: "sq1Lower", looseLimit: "sq2Loose", clampLimit: "sq3Clamped" }[command];
            dispatchAction(contracts.createAction(buttonForCommand[command] ? "JOG_PRESS" : "START_PRIMARY_PRESS", { command, ...(position ? { value: !state.operationState[position] } : {}) }, "module-canvas"));
          }
        } });
      context.services?.onModuleRender?.(MODULE_ID);
    }
    function commandForAction(action) {
      const p = action.payload || {}; if (p.command) return p.command;
      return ({ POWER_CLOSE: "powerClose", POWER_OPEN: "powerOpen", STOP_PRESS: "spindleStop", STOP_PRIMARY_PRESS: "spindleStop", START_FORWARD_PRESS: "spindleStart", START_PRIMARY_PRESS: "spindleStart", START_REVERSE_PRESS: "rockerDown", START_SECONDARY_PRESS: "rockerDown", STOP_SECONDARY_PRESS: "hydraulicStop", PROTECTION_TOGGLE: p.target === "secondary" ? "fr2Trip" : "fr1Trip", PROTECTION_RESET: p.target === "secondary" ? "fr2Reset" : "fr1Reset", PROTECTION_SECONDARY_TOGGLE: "fr2Trip", PROTECTION_SECONDARY_RESET: "fr2Reset", RESET_MODULE: "reset" })[action.type];
    }
    function dispatchAction(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input, valid = contracts.validateAction(action);
      if (!valid.valid) throw new Error(`Invalid ${MODULE_ID} action: ${valid.errors.join("; ")}`);
      playback.cancel();
      const payload = action.payload || {}, command = commandForAction(action);
      if (action.type === "JOG_RELEASE") state = solver.reduce(state, "release", command ? { command } : {});
      else {
        if (!command) throw new Error(`Unsupported ${MODULE_ID} action: ${action.type}`);
        if (["powerOpen", "reset"].includes(command) || (command === "powerToggle" && state.operationState.qf === "closed")) { heldPointers.clear(); heldKeys.clear(); heldCanvas.clear(); }
        state = solver.reduce(state, command, payload);
      }
      lastAction = { type: action.type, command: action.type === "JOG_RELEASE" ? "release" : command, releasedCommand: action.type === "JOG_RELEASE" ? command : null, payload: clone(payload) };
      recompute(); refresh();
      const result = { action, state: getStateSnapshot(), solverResult: normalizeSolverResult(), operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: buildTeachingFeedback() };
      contracts.assertFacadeOutputs({ meta: { moduleId: MODULE_ID }, getStateSnapshot: () => result.state, normalizeSolverResult: () => result.solverResult, getOperationViewModel: () => result.operationViewModel, getStatusViewModel: () => result.statusViewModel });
      return result;
    }
    function attachShellControls() {
      shellController?.abort(); shellController = new AbortController();
      const doc = global.document; if (!doc) return;
      const options = { capture: true, signal: shellController.signal };
      const controlAt = (target) => {
        const element = target?.closest?.("#pressSb1, #pressSb2, #pressSb3, #pressSb4, [data-facade-slot]");
        if (!element || element.disabled || element.classList.contains("hidden")) return null;
        const slot = slots[element.id] || element.dataset.facadeSlot;
        return getOperationViewModel().controls.find((control) => control.slot === slot && control.momentary);
      };
      const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      const press = (command, source) => dispatchAction(contracts.createAction("JOG_PRESS", { command }, source));
      const release = releaseOwned;
      doc.addEventListener("pointerdown", (event) => {
        if (!mounted || paused || event.button !== 0) return;
        const control = controlAt(event.target); if (!control) return;
        swallow(event); heldPointers.set(event.pointerId, control.payload.command); press(control.payload.command, "module-shell-pointer");
      }, options);
      const endPointer = (event) => {
        const command = heldPointers.get(event.pointerId); if (!command) return;
        swallow(event); heldPointers.delete(event.pointerId); release(command, "module-shell-pointer");
      };
      doc.addEventListener("pointerup", endPointer, options); doc.addEventListener("pointercancel", endPointer, options);
      doc.addEventListener("keydown", (event) => {
        if (!mounted || paused || ![" ", "Enter"].includes(event.key)) return;
        const control = controlAt(event.target); if (!control) return;
        swallow(event); if (event.repeat) return;
        heldKeys.set(event.key, control.payload.command); press(control.payload.command, "module-shell-keyboard");
      }, options);
      doc.addEventListener("keyup", (event) => {
        const command = heldKeys.get(event.key); if (!command) return;
        swallow(event); heldKeys.delete(event.key); release(command, "module-shell-keyboard");
      }, options);
      doc.addEventListener("click", (event) => {
        if (!mounted || paused) return;
        const control = controlAt(event.target); if (!control) return;
        swallow(event);
        // Physical pointer/keyboard events already delivered press and release.
        // An accessibility/programmatic click is instead an atomic tap.
        if (event.detail === 0 && !heldKeys.size) { press(control.payload.command, "module-shell-tap"); release(control.payload.command, "module-shell-tap"); }
      }, options);
      global.addEventListener?.("blur", () => { if (heldPointers.size || heldKeys.size || heldCanvas.size) { releaseAll(); refresh(); } }, { signal: shellController.signal });
      // Keep a held keyboard command while the mouse operates a position
      // simulator. Document keyup releases it even after focus has moved.
    }
    context.scope?.addCleanup(() => { shellController?.abort(); clearTimer(); heldPointers.clear(); heldKeys.clear(); heldCanvas.clear(); });
    recompute();
    return Object.freeze({
      createInitialState(seed = {}) { playback.cancel(); clearTimer(); heldPointers.clear(); heldKeys.clear(); heldCanvas.clear(); wasTiming = false; state = solver.createInitialState(seed); lastAction = null; recompute(); return getStateSnapshot(); },
      getStateSnapshot, dispatchAction, normalizeSolverResult, getOperationViewModel, getStatusViewModel, buildTeachingFeedback, getPlaybackViewModel,
      buildReplaySteps: () => clone(playback.steps()),
      solve(message = "重新求解") { playback.cancel(); lastAction = { command: "solve", message }; recompute(); return normalizeSolverResult(); },
      dispatchPlayback(command, value) {
        if (command === "scenario") { return playback.command("scenario", value); }
        if (["restart", "toggle", "next", "prev"].includes(command)) clearTimer(true);
        const view = playback.command(command, value); syncTimer(); refresh(); return view;
      },
      mount() { mounted = true; paused = false; global.document?.body?.classList.add("ch02-machine-tool-v2-active"); attachShellControls(); syncTimer(); }, render,
      reset() { playback.cancel(); clearTimer(); releaseAll(); wasTiming = false; state = solver.createInitialState({ operationState: { scene: state.operationState.scene } }); lastAction = null; recompute(); refresh(); return getStateSnapshot(); },
      pause() { paused = true; releaseAll(); clearTimer(true); playback.cancel(); },
      resume() { paused = false; syncTimer(); refresh(); },
      unmount() { mounted = false; paused = false; playback.cancel(); shellController?.abort(); shellController = null; releaseAll(); clearTimer(); global.document?.body?.classList.remove("ch02-machine-tool-v2-active"); renderer.unmount({ root: context.mountRoot }); },
      validateGeometry: () => circuitData.validateGeometry(), runTests: () => solver.runTests()
    });
  }
  platform.moduleFacades.createMachineToolCircuitsV2Facade = createFacade;
})(globalThis);
