(function installReversePlayback(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.createReversePlayback = ({ scope, evaluate, onChange, teaching = platform.reverseTeaching }) => {
    // Same accepted player, with an optional module-owned teaching catalogue.
    let scenarioId = teaching.scenarios[0].id, steps = [], index = -1, running = false, speed = 1, timer = null, completed = false;
    const clearTimer = () => { if (timer !== null) scope.clearTimeout(timer); timer = null; };
    const ensureSteps = () => { if (!steps.length) steps = teaching.buildScenario(scenarioId, evaluate); };
    function schedule() {
      clearTimer();
      if (running && index >= 0) timer = scope.timeout(() => {
        timer = null;
        if (index + 1 >= steps.length) { index = -1; running = false; completed = true; }
        else index += 1;
        onChange(); schedule();
      }, steps[index].duration / speed);
    }
    function cancel() { clearTimer(); running = false; index = -1; completed = false; }
    scope.addCleanup(cancel);
    return Object.freeze({
      current: () => index < 0 ? null : steps[index],
      steps: () => { ensureSteps(); return steps; },
      view: () => ({ scenarioId, scenarios: teaching.scenarios, index, count: steps.length,
        running, speed, completed, step: index < 0 ? null : steps[index], mode: index < 0 ? "Live" : "Playback" }),
      cancel,
      command(command, value) {
        switch (command) {
          case "scenario":
            if (!teaching.scenarios.some((s) => s.id === value)) throw new Error("Unknown teaching scenario");
            cancel(); scenarioId = value; steps = []; ensureSteps(); break;
          case "restart": cancel(); ensureSteps(); index = 0; running = true; break;
          case "toggle": ensureSteps(); if (index < 0) index = 0; running = !running; completed = false; break;
          case "prev": case "next":
            ensureSteps(); clearTimer(); running = false; completed = false;
            index = index < 0 ? 0 : Math.max(0, Math.min(steps.length - 1, index + (command === "next" ? 1 : -1))); break;
          case "speed": if (![0.5, 1, 1.5].includes(value)) throw new Error("Invalid playback speed"); speed = value; break;
          case "exit": cancel(); break;
          default: throw new Error("Unknown playback command: " + command);
        }
        onChange(); schedule();
        return this.view();
      }
    });
  };
})(globalThis);
