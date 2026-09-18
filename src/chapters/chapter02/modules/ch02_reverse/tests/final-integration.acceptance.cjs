"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { runCurrentFlowChecks } = require("./current-flow.acceptance.cjs");
const repo = path.resolve(__dirname, "../../../../../..");
const output = path.join(repo, "output/playwright");

async function runFinalChecks(page) {
  const checks = [], scenarios = {}, layouts = [];
  function check(name, passed) { checks.push({ name, passed: Boolean(passed) }); assert.ok(passed, name); }
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload), { type, payload });
  const command = (command, value) => page.evaluate(({ command, value }) => platformApi.dispatchPlayback(command, value), { command, value });
  const live = () => page.evaluate(() => JSON.stringify([platformApi.getCurrentStateSnapshot(), platformApi.getCurrentSolverResult()]));
  const view = () => page.evaluate(() => platformApi.getCurrentPlaybackViewModel());
  const reset = () => page.evaluate(() => platformApi.resetCurrent());
  const shot = (name) => page.screenshot({ path: path.join(output, "final-" + name + ".png"), fullPage: true });
  async function inspect(name) {
    const result = await page.evaluate(() => {
      const view = platformApi.getCurrentPlaybackViewModel(), display = view.displayState;
      const s = display.solverResult, v = display.visualState;
      const board = document.querySelector(".ch02-reverse-board");
      const ids = (selector, key) => [...board.querySelectorAll(selector)].map((e) => e.dataset[key]).sort();
      const edges = new Set([...s.extension.activeMainEdgeIds, ...s.extension.activeControlEdgeIds]);
      const wires = new Set([...s.activeMainWireIds, ...s.activeControlWireIds]);
      return {
        view, source: board.dataset.stateSource, mode: document.getElementById("statusMode").textContent,
        motor: document.getElementById("statusMotor").textContent,
        operation: platformApi.getCurrentOperationViewModel(),
        active: ids(".ch02-reverse-wire-active", "wireId"), flow: ids(".ch02-reverse-flow[data-flow-wire-id]", "flowWireId"),
        focus: ids(".is-teaching-focus", "componentId"),
        componentMatch: [...board.querySelectorAll("[data-component-id]")].every((e) =>
          e.dataset.closed === v.components[e.dataset.componentId].closed.join(" ") && e.dataset.energized === String(v.components[e.dataset.componentId].energized)),
        flowAllowed: [...board.querySelectorAll(".ch02-reverse-flow")].every((e) => e.dataset.flowWireId
          ? v.visualActiveWireIds.includes(e.dataset.flowWireId)
          : e.dataset.equivalentWireId ? wires.has(e.dataset.equivalentWireId)
            : edges.has(e.dataset.edgeId) && s.edgeStates[e.dataset.edgeId].conductive),
        sameGeometry: [...board.querySelectorAll(".ch02-reverse-flow")].every((e) => {
          const target = document.getElementById(e.getAttribute("href").slice(1));
          return target && !e.hasAttribute("d") && ["x", "y", "width", "height"].every((key) => e.getBBox()[key] === target.getBBox()[key]);
        }),
        textMatch: !view.step || document.getElementById("teachText").textContent === view.step.text,
        scope: platformApi.getDiagnostics().loader.currentScope
      };
    });
    const { view: vm } = result, ds = vm.displayState, s = ds.solverResult;
    check(name + " unified source", result.source === vm.mode && result.mode === vm.mode);
    check(name + " contactor exclusion", !(s.stableDeviceStates.KM1 && s.stableDeviceStates.KM2));
    check(name + " components from Solver", result.componentMatch);
    check(name + " Active = Flow = binding", JSON.stringify(result.active) === JSON.stringify(result.flow)
      && JSON.stringify(result.active) === JSON.stringify([...ds.visualState.visualActiveWireIds].sort()));
    check(name + " only conductive flow / same geometry", result.flowAllowed && result.sameGeometry);
    check(name + " principle synchronized", result.textMatch);
    check(name + " focus synchronized", JSON.stringify(result.focus) === JSON.stringify([...ds.teachingFocus].sort()));
    check(name + " operation state synchronized", result.operation.power.closed === (ds.snapshot.operation.power === "closed")
      && result.operation.protection.tripped === ds.solverResult.protectionStates.FR1.tripped);
    check(name + " one scope timer maximum", result.scope.timeoutCount <= 1 && result.scope.intervalCount === 0);
    if (s.motorStates.M.running) check(name + " phase sequence", JSON.stringify(s.extension.motorPhases)
      === JSON.stringify(s.motorStates.M.state === "forward" ? { U: "l1", V: "l2", W: "l3" } : { U: "l3", V: "l2", W: "l1" }));
    else check(name + " no ghost flow", result.flow.length === 0);
    return vm;
  }

  await reset(); await shot("A-platform");
  // Exercise the original operation panel, not only the public API.
  await page.locator("#toggleQf").click(); await page.locator("#pressSb2").click();
  check("Live forward", (await inspect("Live forward")).displayState.snapshot.motor.state === "forward"); await shot("B-live-forward");
  await page.locator("#pressSb3").click();
  check("Live forward to reverse", (await inspect("Live reverse")).displayState.snapshot.motor.state === "reverse"); await shot("C-live-reverse");
  await page.locator("#pressSb2").click();
  check("Live reverse to forward", (await view()).displayState.snapshot.motor.state === "forward");
  await page.locator("#pressSb1").click();
  check("Live SB1 stop explanation", (await inspect("Live stop")).displayState.snapshot.motor.state === "stopped"
    && (await page.locator("#teachText").innerText()).includes("不直接承载"));
  await page.locator("#pressSb3").click(); await page.locator("#tripFr").click();
  check("Live overload", (await inspect("Live overload")).displayState.solverResult.protectionStates.FR1.tripped);
  await page.locator("#pressSb2").click();
  check("unreset cannot start", (await view()).displayState.snapshot.motor.state === "stopped");
  await page.locator("#resetFr").click();
  check("reset never auto restarts", (await inspect("Live reset")).displayState.snapshot.motor.state === "stopped");
  await page.locator("#resetDemo").click();
  check("original system reset", (await view()).displayState.snapshot.operation.power === "open");
  await action("POWER_CLOSE");
  await action("START_FORWARD_PRESS", { phase: "press" });
  await action("START_REVERSE_PRESS", { phase: "press" });
  check("simultaneous held buttons safe", (await inspect("both pressed")).displayState.snapshot.motor.state === "stopped");
  await reset(); await action("POWER_CLOSE");
  await page.locator("#pressSb2").click();
  const originalLive = await live();
  const list = (await view()).scenarios;
  for (const scenario of list) {
    await page.locator("#reverseScenario").selectOption(scenario.id);
    const count = (await view()).count, states = [];
    for (let i = 0; i < count; i++) {
      await page.locator("#playbackNext").click();
      const vm = await inspect(scenario.id + " step " + (i + 1));
      check(scenario.id + " live untouched " + i, (await live()) === originalLive);
      states.push({ index: i, title: vm.step.title, motor: vm.displayState.snapshot.motor.state,
        coils: vm.displayState.solverResult.stableDeviceStates, phase: vm.step.displayState.electricalPhase });
      if (scenario.id === "forward-reverse" && i === 2) await shot("D-reversal-release");
      if (scenario.id === "forward-start" && i === 7) {
        await shot("E-self-hold");
        await page.locator(".inspector").screenshot({ path: path.join(output, "final-H-status-principle.png") });
        await page.locator(".footerbar").screenshot({ path: path.join(output, "final-I-playback.png") });
      }
      if (scenario.id === "overload" && i === 1) await shot("F-overload");
      if (scenario.id === "reset" && i === 3) await shot("G-fr1-reset");
    }
    scenarios[scenario.id] = states;
    check(scenario.id + " final direction", states.at(-1).motor === (scenario.id === "forward-start" || scenario.id === "reverse-forward" ? "forward"
      : scenario.id === "reverse-start" || scenario.id === "forward-reverse" ? "reverse" : "stopped"));
    if (["forward-reverse", "reverse-forward"].includes(scenario.id)) {
      const off = states.filter((s) => s.phase === "solver-iteration-release");
      check(scenario.id + " Solver-proven release before pickup", off.length === 5 && off.every((s) => !s.coils.KM1 && !s.coils.KM2 && s.motor === "stopped"));
    }
  }
  await page.locator("#playbackPrev").click();
  check("previous", (await view()).index === scenarios.reset.length - 2);
  await page.locator("#playbackNext").click();
  await page.locator("#playbackSpeed15").click();
  await page.locator("#playbackToggle").click();
  await page.waitForFunction(() => platformApi.getCurrentPlaybackViewModel().mode === "Live");
  check("completion restores exact live state", (await live()) === originalLive);
  check("completion no override/focus/timers", (await inspect("completion")).displayState.teachingFocus.length === 0);
  await page.locator("#showPrinciplePlayback").click();
  check("restart", (await view()).running && (await view()).index === 0);
  await page.locator("#playbackToggle").click();
  const paused = await view(); await page.waitForTimeout(1400);
  check("pause stable", (await view()).index === paused.index && !(await view()).running);
  check("paused timer cleared", await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope.timeoutCount === 0));
  await page.locator("#playbackToggle").click();
  await page.waitForFunction(() => platformApi.getCurrentPlaybackViewModel().index === 1);
  await page.locator("#pressSb3").click();
  check("manual action exits Playback first", (await inspect("manual interrupt")).mode === "Live"
    && (await view()).displayState.snapshot.motor.state === "reverse");
  await command("restart");
  await page.locator("#reverseScenario").selectOption("forward-start");
  check("scenario cleanup", (await inspect("scenario switch")).mode === "Live"
    && await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope.timeoutCount === 0));
  await command("restart"); await command("exit");
  check("explicit exit", (await view()).mode === "Live");
  await command("restart"); await reset();
  check("module reset cancels playback", (await inspect("reset playback")).mode === "Live");
  // Complete every scenario on a controlled browser clock, including natural finish.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const scenario of list) {
    const original = await live();
    await command("scenario", scenario.id); await command("speed", 1); await command("restart");
    const steps = [];
    while ((await view()).mode === "Playback") {
      const vm = await view(); steps.push(vm.index);
      await page.clock.runFor(vm.step.duration);
    }
    check(scenario.id + " natural full autoplay", steps.length === scenarios[scenario.id].length
      && steps.every((step, i) => step === i) && (await view()).completed);
    check(scenario.id + " natural end restores live", (await live()) === original
      && await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope.timeoutCount === 0));
  }
  await page.clock.resume();
  // Retain a test-only reference to the scope to assert actual disposal, not only DOM cleanup.
  await page.evaluate(() => {
    const original = ECTPPlatform.runtime.createRuntimeScope;
    globalThis.finalTestScopes = [];
    globalThis.finalTestOriginalRuntime = ECTPPlatform.runtime;
    ECTPPlatform.runtime = { createRuntimeScope: (id) => { const scope = original(id); finalTestScopes.push(scope); return scope; } };
  });
  for (let i = 0; i < 3; i++) {
    await command("scenario", "forward-reverse"); await command("next"); await command("toggle");
    const old = await page.evaluateHandle(() => [...document.querySelectorAll(".ch02-reverse-flow")]);
    await page.evaluate(() => platformApi.switchModule("multisite-control"));
    await page.waitForTimeout(1300);
    check("module cleanup " + i, await page.evaluate(() => !document.body.classList.contains("ch02-reverse-active")
      && document.querySelectorAll(".ch02-reverse-flow,.is-teaching-focus").length === 0
      && document.getAnimations().filter((a) => a.animationName === "ch02ReverseFlow").length === 0
      && document.getElementById("reverseScenarioLabel").classList.contains("hidden")));
    check("detached animations canceled " + i, await old.evaluate((nodes) => nodes.every((n) => !n.isConnected && !n.getAnimations().length)));
    await old.dispose();
    await page.evaluate(() => platformApi.switchModule("forward-reverse"));
    await page.locator('[data-component-id="qf1"] .ch02-reverse-hitbox').click();
    check("reentry one input handler " + i, (await view()).displayState.snapshot.operation.power === "closed");
    check("reentry zero timers " + i, await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope.timeoutCount === 0));
  }
  // Optional facade extension must not commandeer legacy Chapter 2 players.
  for (const route of ["jog-control", "self-lock", "main-control"]) {
    await page.evaluate((route) => platformApi.switchModule(route), route);
    check(route + " original contract", await page.evaluate(() => platformApi.getCurrentContractReport().valid && !platformApi.getCurrentPlaybackViewModel()));
    await page.locator("#toggleQf").click();
    check(route + " original power action", await page.evaluate(() => platformApi.getCurrentOperationViewModel().power.closed));
  }
  check("disposed scope resources empty", await page.evaluate(() => finalTestScopes.slice(0, -1).every((scope) => {
    const d = scope.diagnostics(); return d.disposed && !d.timeoutCount && !d.intervalCount && !d.cleanupCount;
  })));
  await page.evaluate(() => { ECTPPlatform.runtime = finalTestOriginalRuntime; delete globalThis.finalTestScopes; delete globalThis.finalTestOriginalRuntime; });
  await page.evaluate(() => platformApi.switchModule("forward-reverse"));
  await action("POWER_CLOSE"); await action("START_FORWARD_PRESS");
  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const rect = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
        board: rect(".ch02-reverse-board"), inspector: rect(".inspector"), footer: rect(".footerbar"),
        ai: rect("#aiPlaceholderCard"), labelPx: 18 * document.querySelector(".ch02-reverse-board").getBoundingClientRect().width / 1435 };
    });
    layouts.push(layout);
    check(width + " no horizontal overflow", layout.scrollWidth <= width);
    check(width + " no overlapping panels", layout.board.right <= layout.inspector.x && layout.board.bottom <= layout.footer.y);
    check(width + " Playback visible", layout.footer.bottom <= height + 1);
    check(width + " component labels readable", layout.labelPx >= 10);
    check(width + " right cards never internally clipped", await page.evaluate(() =>
      [...document.querySelectorAll(".inspector > section:not(.hidden)")].every((node) => node.scrollHeight <= node.clientHeight + 1)));
    await shot(width === 1366 ? "J-1366x768" : "layout-" + width + "x" + height);
  }
  await reset();
  const cleanup = await page.evaluate(() => ({ ...platformApi.getDiagnostics().loader.currentScope,
    flows: document.querySelectorAll(".ch02-reverse-flow").length, focus: document.querySelectorAll(".is-teaching-focus").length }));
  check("final clean state", cleanup.timeoutCount === 0 && cleanup.intervalCount === 0 && cleanup.flows === 0 && cleanup.focus === 0);
  return { passed: checks.length, checks, scenarios, layouts, cleanup };
}
module.exports = { runFinalChecks };
if (require.main === module) (async () => {
  const source = fs.readFileSync(path.join(repo, "index.html"), "utf8");
  const core = source.slice(source.indexOf("    const deviceEdgeDefs ="), source.indexOf("    function getSolverDebugData()"));
  const solverHash = crypto.createHash("sha256").update(core).digest("hex");
  assert.equal(solverHash, "257603bc758841a5764556c06f5443209936d04b7f2a7448423ee2ea2879959e", "Stage 2 Solver frozen");
  const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto((process.env.ECTP_TEST_URL || "http://127.0.0.1:8765") + "/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    const regression = await runCurrentFlowChecks(page);
    const report = await runFinalChecks(page);
    assert.deepEqual(errors, [], "Browser console errors");
    const result = { ...report, solverHash, browserErrors: errors,
      stage1to4: { ...regression.regression, currentFlowPassed: regression.passed } };
    fs.writeFileSync(path.join(output, "final-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, checks: undefined, scenarios: undefined }, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
