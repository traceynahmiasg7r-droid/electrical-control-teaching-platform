(function installCh01ForwardReverseFacade(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  const M = "ch01_forward_reverse";
  const R = "ch01-forward-reverse";
  const id = (kind, name) => `${M}__${kind}__${name}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  platform.moduleFacades.createCh01ForwardReverseFacade = ({ context, circuitData }) => {
    const contracts = platform.contracts;
    const solver = platform.moduleSolvers.createCh01ForwardReverseSolver(circuitData);
    const renderer = platform.moduleRenderers.createCh01ForwardReverseRenderer(circuitData);
    let mounted = false;
    let replayIndex = -1;
    let replayTimer = null;
    let replaySpeed = 1;

    function snapshot() {
      const state = solver.getState();
      const result = solver.getSolverResult();
      const motor = result.motorStates[id("dev", "motor")];
      return {
        schemaVersion: "1.0", moduleId: M, routeId: R,
        operation: { power: state.power, controls: { forward: "released", reverse: "released", stop: "released" }, protections: {} },
        devices: {
          forwardContactor: { id: "KM1", energized: Boolean(result.stableDeviceStates[id("dev", "km1")]) },
          reverseContactor: { id: "KM2", energized: Boolean(result.stableDeviceStates[id("dev", "km2")]) }
        },
        motor: { id: "M", state: motor.state, running: motor.running, direction: motor.direction }
      };
    }

    function operation() {
      const state = solver.getState();
      const running = state.direction !== "stopped" && state.power === "closed";
      return {
        schemaVersion: "1.0", moduleId: M,
        power: {
          layout: "single-toggle", deviceId: id("dev", "control_supply"), closed: state.power === "closed",
          closeLabel: "接通 A—N 电源", openLabel: "断开 A—N 电源",
          closeEnabled: state.power !== "closed", openEnabled: state.power === "closed"
        },
        controls: [
          { slot: "primary", visible: true, label: "SB1 正转", stateText: state.direction === "forward" ? "KM1 已自锁" : "绿色路线", buttonClass: "forward", action: "START_FORWARD_PRESS" },
          { slot: "secondary", visible: true, label: "SB2 反转", stateText: state.direction === "reverse" ? "KM2 已自锁" : "蓝色路线", buttonClass: "reverse", action: "START_REVERSE_PRESS" },
          { slot: "tertiary", visible: true, label: "SB3 停止", stateText: running ? "断开公共控制回路" : "已停止", buttonClass: "stop", action: "STOP_PRESS" },
          { slot: "quaternary", visible: false }
        ],
        actionStates: [
          { id: "power", label: "A—N控制电源", currentState: state.power, availableTransitions: [state.power === "closed" ? "open" : "close"], onAction: state.power === "closed" ? "POWER_OPEN" : "POWER_CLOSE", feedbackText: "第一章第61页控制回路使用A相与N线形成220V电源。" },
          { id: "sb1", label: "SB1 正转", currentState: state.direction, availableTransitions: state.direction === "reverse" ? ["blocked_by_KM2_interlock"] : ["forward"], onAction: "START_FORWARD_PRESS", feedbackText: "SB1接通KM1线圈支路，KM1辅助常开触点完成自锁。" },
          { id: "sb2", label: "SB2 反转", currentState: state.direction, availableTransitions: state.direction === "forward" ? ["blocked_by_KM1_interlock"] : ["reverse"], onAction: "START_REVERSE_PRESS", feedbackText: "SB2接通KM2线圈支路，KM2主触点交换A、C两相。" },
          { id: "sb3", label: "SB3 停止", currentState: state.direction, availableTransitions: ["stopped"], onAction: "STOP_PRESS", feedbackText: "SB3是正反转两条支路共用的常闭停止按钮。" }
        ]
      };
    }

    function status() {
      const state = solver.getState();
      const result = solver.getSolverResult();
      const forward = state.direction === "forward" && state.power === "closed";
      const reverse = state.direction === "reverse" && state.power === "closed";
      const phase = result.extension.motorPhases;
      return { schemaVersion: "1.0", moduleId: M, rows: [
        { id: "power", label: "A—N电源", value: state.power === "closed" ? "220V 已接通" : "断开", tone: state.power === "closed" ? "on" : "off" },
        { id: "km1", label: "KM1", value: forward ? "吸合 / 自锁" : "释放", tone: forward ? "forward" : "off" },
        { id: "km2", label: "KM2", value: reverse ? "吸合 / 自锁" : "释放", tone: reverse ? "reverse" : "off" },
        { id: "motor", label: "M", value: forward ? "正转运行" : reverse ? "反转运行" : "停止", tone: forward ? "forward" : reverse ? "reverse" : "off" },
        { id: "interlock", label: "互锁状态", value: forward ? "KM1 阻断 KM2" : reverse ? "KM2 阻断 KM1" : "双方允许启动", tone: forward ? "forward" : reverse ? "reverse" : "on" },
        { id: "phase", label: "电机相序", value: phase.U ? `${phase.U}${phase.V}${phase.W}` : "未接通", tone: forward ? "forward" : reverse ? "reverse" : "off" }
      ] };
    }

    function feedback() {
      const state = solver.getState();
      return {
        title: state.direction === "forward" ? "KM1正转回路已建立" : state.direction === "reverse" ? "KM2反转回路已建立" : state.power === "closed" ? "正反转控制待命" : "A—N控制电源断开",
        text: state.lastAction.message,
        tone: state.direction === "forward" ? "success" : "info",
        steps: state.direction === "forward"
          ? ["SB1瞬时闭合", "KM1线圈得电", "KM1常开辅助触点自锁", "KM1主触点以ABC相序接通", "KM1常闭辅助触点阻断KM2支路"]
          : state.direction === "reverse"
            ? ["SB2瞬时闭合", "KM2线圈得电", "KM2常开辅助触点自锁", "KM2主触点形成CBA相序", "KM2常闭辅助触点阻断KM1支路"]
            : ["KM1与KM2均释放", "电动机停止"]
      };
    }

    const replay = () => [
      { label: "复位", action: "RESET_MODULE" }, { label: "接通A—N电源", action: "POWER_CLOSE" },
      { label: "SB1正转", action: "START_FORWARD_PRESS" }, { label: "SB3停止", action: "STOP_PRESS" },
      { label: "SB2反转", action: "START_REVERSE_PRESS" }
    ];

    function pausePlayback() {
      if (replayTimer !== null) context.scope.clearInterval(replayTimer);
      replayTimer = null;
    }

    function renderPlayback() {
      if (!mounted) return;
      const doc = context.mountRoot?.ownerDocument || global.document;
      const steps = replay();
      const list = doc?.getElementById("principleStepList");
      const show = doc?.getElementById("showPrinciplePlayback");
      const previous = doc?.getElementById("playbackPrev");
      const toggle = doc?.getElementById("playbackToggle");
      const next = doc?.getElementById("playbackNext");
      const note = doc?.getElementById("currentStepText");
      if (!list || !show || !previous || !toggle || !next || !note) return;
      show.disabled = false;
      previous.disabled = replayIndex <= 0;
      next.disabled = replayIndex < 0 || replayIndex >= steps.length - 1;
      toggle.disabled = false;
      toggle.textContent = replayTimer === null ? "播放" : "暂停";
      list.innerHTML = steps.map((step, index) => `<div class="principle-step-item ${index < replayIndex ? "complete" : index === replayIndex ? "active" : "pending"}"><span class="principle-step-marker">${index < replayIndex ? "✓" : index === replayIndex ? "●" : "○"}</span><span class="principle-step-text">${step.label}</span></div>`).join("");
      note.textContent = replayIndex >= 0 ? `当前步骤：${steps[replayIndex].label}` : "当前步骤：等待操作。";
      [[0.5, "05"], [1, "10"], [1.5, "15"]].forEach(([speed, suffix]) => {
        doc.getElementById(`playbackSpeed${suffix}`)?.classList.toggle("active", replaySpeed === speed);
      });
    }

    function applyReplayIndex(nextIndex) {
      const steps = replay();
      replayIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
      solver.reset();
      for (let index = 1; index <= replayIndex; index += 1) {
        solver.dispatch(contracts.createAction(steps[index].action, {}, "module-playback"));
      }
      if (replayIndex === steps.length - 1) pausePlayback();
      render();
      context.services?.renderShell?.();
      renderPlayback();
    }

    function togglePlayback() {
      if (replayTimer !== null) {
        pausePlayback();
        renderPlayback();
        return;
      }
      if (replayIndex < 0 || replayIndex >= replay().length - 1) applyReplayIndex(0);
      replayTimer = context.scope.interval(() => applyReplayIndex(replayIndex + 1), 1600 / replaySpeed);
      renderPlayback();
    }

    function bindPlayback() {
      const doc = context.mountRoot?.ownerDocument || global.document;
      const bind = (elementId, handler) => doc?.getElementById(elementId)?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        handler();
      }, { capture: true, signal: context.scope.signal });
      bind("showPrinciplePlayback", () => applyReplayIndex(0));
      bind("playbackPrev", () => applyReplayIndex(replayIndex - 1));
      bind("playbackToggle", togglePlayback);
      bind("playbackNext", () => applyReplayIndex(replayIndex + 1));
      [[0.5, "05"], [1, "10"], [1.5, "15"]].forEach(([speed, suffix]) => bind(`playbackSpeed${suffix}`, () => {
        replaySpeed = speed;
        pausePlayback();
        renderPlayback();
      }));
    }

    function render() {
      if (mounted && context.mountRoot) renderer.render({ root: context.mountRoot, internalState: solver.getState(), solverResult: solver.getSolverResult() });
      renderPlayback();
    }

    function dispatchAction(input) {
      const action = typeof input === "string" ? contracts.createAction(input) : input;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${M} action: ${report.errors.join("; ")}`);
      solver.dispatch(action);
      const currentState = solver.getState();
      replayIndex = currentState.power !== "closed"
        ? 0
        : currentState.direction === "forward"
          ? 2
          : currentState.direction === "reverse"
            ? 4
            : action.type === "STOP_PRESS" ? 3 : 1;
      render();
      context.services?.renderShell?.();
      renderPlayback();
      return { action, state: snapshot(), solverResult: clone(solver.getSolverResult()), operationViewModel: operation(), statusViewModel: status(), feedback: feedback() };
    }

    return Object.freeze({
      createInitialState: () => { solver.reset(); return snapshot(); }, getStateSnapshot: snapshot, dispatchAction,
      solve: (message) => clone(solver.solve(message)), normalizeSolverResult: () => clone(solver.getSolverResult()),
      getOperationViewModel: operation, getStatusViewModel: status, buildTeachingFeedback: feedback, buildReplaySteps: replay,
      mount: () => { mounted = true; bindPlayback(); }, render, reset: () => { pausePlayback(); replayIndex = -1; solver.reset(); render(); return snapshot(); },
      pause: pausePlayback, resume: () => undefined,
      unmount: () => { pausePlayback(); mounted = false; if (context.mountRoot) context.mountRoot.replaceChildren(); },
      validateGeometry: solver.validateGeometry, runTests: solver.runTests
    });
  };
})(globalThis);
