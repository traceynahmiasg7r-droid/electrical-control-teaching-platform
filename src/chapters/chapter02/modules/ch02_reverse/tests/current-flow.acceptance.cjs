"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runActivePathChecks } = require("./active-path.acceptance.cjs");
const rawBaseline = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../../output/playwright/stage4-blocker-evidence.json"), "utf8"));

async function runCurrentFlowChecks(page) {
  await page.evaluate(() => platformApi.resetCurrent());
  const regression = await runActivePathChecks(page);
  const checks = [];
  const states = {};
  const check = (name, pass) => { checks.push({ name, pass: Boolean(pass) }); };
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) =>
    platformApi.dispatchAction(type, payload, "stage4-acceptance"), { type, payload });
  async function inspect(name, motor) {
    const result = await page.evaluate(() => {
      const data = ECTPPlatform.moduleCircuitData.ch02Reverse;
      const raw = platformApi.getCurrentSolverResult();
      const before = JSON.stringify(raw);
      const visual = ECTPPlatform.bindCh02ReverseVisualState(data, platformApi.getCurrentStateSnapshot(), raw);
      const board = document.querySelector(".ch02-reverse-board");
      const flows = [...board.querySelectorAll(".ch02-reverse-flow")];
      const wires = flows.filter((n) => n.hasAttribute("data-flow-wire-id"));
      const actives = [...board.querySelectorAll(".ch02-reverse-wire-active")];
      const activeEdges = new Set([...raw.extension.activeMainEdgeIds, ...raw.extension.activeControlEdgeIds]);
      const activeRawWires = new Set([...raw.activeMainWireIds, ...raw.activeControlWireIds]);
      const ids = (items, key) => items.map((n) => n.dataset[key]).sort();
      const noIndependentGeometry = flows.every((n) => n.tagName.toLowerCase() === "use"
        && ["d", "points", "x", "y", "transform", "pathLength", "marker-end"].every((a) => !n.hasAttribute(a)));
      const sameRefs = wires.every((n) => {
        const active = actives.find((a) => a.dataset.wireId === n.dataset.flowWireId);
        const base = document.getElementById(n.getAttribute("href").slice(1));
        return active?.getAttribute("href") === n.getAttribute("href") && base?.classList.contains("ch02-reverse-wire")
          && base.id === "ch02-reverse-wire-" + n.dataset.flowWireId
          && ["x", "y", "width", "height"].every((key) => n.getBBox()[key] === base.getBBox()[key]);
      });
      const allowed = flows.every((n) => {
        const target = document.getElementById(n.getAttribute("href").slice(1));
        if (!target || target.tagName.toLowerCase() !== "path") return false;
        if (n.dataset.flowWireId) return visual.visualActiveWireIds.includes(n.dataset.flowWireId);
        if (target.dataset.conductiveGeometry !== "true") return false;
        if (n.dataset.equivalentWireId) return activeRawWires.has(n.dataset.equivalentWireId)
          && n.dataset.flowComponent === "fu2";
        return activeEdges.has(n.dataset.edgeId) && raw.edgeStates[n.dataset.edgeId].conductive;
      });
      const noFrames = flows.every((n) => {
        const target = document.getElementById(n.getAttribute("href").slice(1));
        return target && !target.closest(".ch02-reverse-mechanical-layer,.ch02-reverse-label-layer")
          && !target.matches(".thermal-link,.ch02-reverse-hitbox")
          && !["motor", "source", "ki1_coil", "ki2_coil"].includes(target.closest("[data-component-id]")?.dataset.componentId);
      });
      const qfFlows = flows.filter((n) => n.dataset.flowComponent === "qf1");
      const noQfCrossbar = qfFlows.every((n) => {
        const p = document.getElementById(n.getAttribute("href").slice(1));
        return p.getPointAtLength(0).x === p.getPointAtLength(p.getTotalLength()).x;
      });
      const wireExact = data.wires.every((w) => document.getElementById("ch02-reverse-wire-" + w.wireId).getAttribute("d")
        === w.points.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" "));
      const mechanicalStatic = [...board.querySelectorAll(".ch02-reverse-mechanical-layer path,.thermal-link")].every((n) =>
        getComputedStyle(n).animationName === "none");
      return {
        rawUnchanged: before === JSON.stringify(raw), raw,
        operation: platformApi.getCurrentStateSnapshot().operation,
        derived: visual.derivedVisualActiveWireIds,
        membership: [...visual.visualActiveWireIds].sort(),
        active: ids(actives, "wireId"), flow: ids(wires, "flowWireId"),
        edgeFlowIds: [...new Set(flows.map((n) => n.dataset.edgeId).filter(Boolean))],
        flowCount: flows.length,
        noIndependentGeometry, sameRefs, allowed, noFrames, noQfCrossbar, wireExact, mechanicalStatic,
        qfHitboxStroke: getComputedStyle(board.querySelector('[data-component-id="qf1"] .ch02-reverse-hitbox')).stroke,
        qfHitboxFill: getComputedStyle(board.querySelector('[data-component-id="qf1"] .ch02-reverse-hitbox')).fill,
        uniqueRefs: new Set(flows.map((n) => n.getAttribute("href"))).size === flows.length,
        activeStatic: actives.every((n) => getComputedStyle(n).animationName === "none"),
        phase: raw.extension.activeMainWirePhaseMap,
        flowAnimations: board.getAnimations({ subtree: true }).filter((a) => a.animationName === "ch02ReverseFlow").length,
        scopes: platformApi.getDiagnostics().loader.currentScope,
        crossingsUnchanged: data.crossings.every((c) => board.querySelector('[data-crossing-id="' + c.crossingId + '"]').dataset.electricallyConnected === "false")
      };
    });
    states[name] = result;
    check(name + " motor", result.raw.motorStates.M.state === motor);
    for (const key of ["rawUnchanged", "noIndependentGeometry", "sameRefs", "allowed", "noFrames", "noQfCrossbar", "wireExact", "mechanicalStatic", "uniqueRefs", "activeStatic", "crossingsUnchanged"]) check(name + " " + key, result[key]);
    check(name + " Active = Flow = shared binding", JSON.stringify(result.active) === JSON.stringify(result.flow)
      && JSON.stringify(result.active) === JSON.stringify(result.membership));
    check(name + " QF hitbox invisible", result.qfHitboxStroke === "none" && result.qfHitboxFill === "rgba(0, 0, 0, 0)");
    check(name + " no scope timers", result.scopes.timeoutCount === 0 && result.scopes.intervalCount === 0);
    check(name + " one animation per overlay", result.flowAnimations === result.flowCount);
    if (motor === "stopped") check(name + " no ghost flow/derived members", result.flowCount === 0 && result.derived.length === 0);
    else {
      check(name + " three approved bridges only", JSON.stringify(result.derived) === JSON.stringify(["qf_fu_l1", "qf_fu_l2", "qf_fu_l3"]));
      check(name + " raw bridge IDs still absent", ["mw_02", "mw_05", "mw_08"].every((id) =>
        !result.raw.activeMainWireIds.includes(id) && !result.raw.activeControlWireIds.includes(id) && !(id in result.phase)));
      const on = motor === "forward" ? "ki1" : "ki2", off = motor === "forward" ? "ki2" : "ki1";
      check(name + " only correct contactor flow", ["a", "b", "c"].every((p) =>
        result.flow.includes(on + "_" + p + "_input") && !result.flow.includes(off + "_" + p + "_input")));
      check(name + " one coil terminal route", result.flow.includes(on + "_coil_input") && !result.flow.includes(off + "_coil_input")
        && result.flow.includes(on + "_coil_return") && !result.flow.includes(off + "_coil_return"));
      check(name + " all phase edges", ["l1", "l2", "l3"].every((p) =>
        result.edgeFlowIds.includes("qf1_edge_" + p) && result.edgeFlowIds.includes("fu1_edge_" + p)));
    }
    const old = rawBaseline.states.find((s) => s.label === name);
    if (old) for (const key of ["activeMainWireIds", "activeControlWireIds"]) {
      check(name + " frozen raw baseline " + key, JSON.stringify(result.raw[key]) === JSON.stringify(old[key]));
    }
    if (old) for (const key of ["activeMainEdgeIds", "activeControlEdgeIds", "activeMainWirePhaseMap"]) {
      check(name + " frozen raw baseline " + key, JSON.stringify(result.raw.extension[key]) === JSON.stringify(old[key]));
    }
    return result;
  }
  await page.evaluate(() => platformApi.resetCurrent());
  await inspect("QF open", "stopped");
  await action("POWER_CLOSE"); await inspect("standby", "stopped");
  await action("START_FORWARD_PRESS", { phase: "press" });
  const start = await inspect("SB2 pressed", "forward");
  check("SB2 branch used", start.flow.includes("sb2_input") && !start.flow.includes("ki1_hold_input"));
  await action("START_FORWARD_PRESS", { phase: "release" });
  const forward = await inspect("forward self-hold", "forward");
  check("KI1 hold replaces SB2", forward.flow.includes("ki1_hold_input") && !forward.flow.includes("sb2_input"));
  check("forward phase map", forward.phase.mw_24 === "l1" && forward.phase.mw_27 === "l2" && forward.phase.mw_30 === "l3");

  const motion = await page.evaluate(async () => {
    const board = document.querySelector(".ch02-reverse-board");
    const nodes = [...board.querySelectorAll(".ch02-reverse-flow")];
    const before = getComputedStyle(nodes[0]).strokeDashoffset;
    let mutations = 0;
    const observer = new MutationObserver((list) => mutations += list.length);
    observer.observe(board, { childList: true, subtree: true });
    await new Promise((resolve) => setTimeout(resolve, 260));
    observer.disconnect();
    return { before, after: getComputedStyle(nodes[0]).strokeDashoffset, mutations, sameNodes: nodes.every((n) => n.isConnected),
      speeds: [...new Set(nodes.map((n) => getComputedStyle(n).animationDuration))] };
  });
  check("CSS dash really moves", motion.before !== motion.after);
  check("no per-frame DOM rebuild", motion.mutations === 0 && motion.sameNodes);
  check("uniform speed", motion.speeds.length === 1 && motion.speeds[0] === "1.6s");
  const oldFlows = await page.evaluateHandle(() => [...document.querySelectorAll(".ch02-reverse-flow")]);
  await action("START_REVERSE_PRESS", { phase: "press" });
  check("previous Flow nodes removed", await oldFlows.evaluate((nodes) => nodes.every((n) => !n.isConnected && n.getAnimations().length === 0)));
  await oldFlows.dispose();
  await inspect("SB3 reversal pressed", "reverse");
  await action("START_REVERSE_PRESS", { phase: "release" });
  const reverse = await inspect("reverse self-hold", "reverse");
  check("KI2 hold replaces SB3", reverse.flow.includes("ki2_hold_input") && !reverse.flow.includes("sb3_input"));
  check("reverse phase swap", reverse.phase.mw_24 === "l3" && reverse.phase.mw_27 === "l2" && reverse.phase.mw_30 === "l1");
  check("reverse real crossed routes", ["ki2_a_to_w2", "ki2_b_to_v2", "ki2_c_to_u2"].every((id) => reverse.flow.includes(id) && !forward.flow.includes(id)));
  await action("START_FORWARD_PRESS", { phase: "press" }); await inspect("mirror reversal SB2", "forward");
  await action("START_REVERSE_PRESS", { phase: "press" }); await inspect("both buttons held", "stopped");
  await action("START_FORWARD_PRESS", { phase: "release" }); await inspect("only SB3 held", "reverse");
  await action("START_REVERSE_PRESS", { phase: "release" });
  await action("STOP_PRESS", { phase: "press" }); await inspect("SB1 held", "stopped");
  await action("STOP_PRESS", { phase: "release" }); await inspect("SB1 stop", "stopped");
  await action("START_FORWARD_PRESS"); await action("PROTECTION_TOGGLE"); await inspect("forward overload", "stopped");
  await action("START_FORWARD_PRESS"); await inspect("overload start blocked", "stopped");
  await action("PROTECTION_RESET"); await inspect("forward reset", "stopped");
  await action("START_REVERSE_PRESS"); await action("PROTECTION_TOGGLE"); await inspect("reverse overload", "stopped");
  await action("PROTECTION_RESET"); await inspect("FR1 reset", "stopped");
  await action("START_FORWARD_PRESS"); await action("POWER_OPEN"); await inspect("running QF open", "stopped");
  await action("POWER_CLOSE"); await inspect("reclosed no restart", "stopped");
  await action("START_FORWARD_PRESS");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => ({
    running: platformApi.getCurrentSolverResult().motorStates.M.state === "forward",
    activeCount: document.querySelectorAll(".ch02-reverse-wire-active").length,
    visibleFlow: [...document.querySelectorAll(".ch02-reverse-flow")].some((n) => getComputedStyle(n).display !== "none"),
    animations: document.getAnimations().filter((a) => a.animationName === "ch02ReverseFlow").length
  }));
  check("reduced motion preserves active/logic, no animation", reduced.running && reduced.activeCount > 0 && !reduced.visibleFlow && reduced.animations === 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (let i = 0; i < 3; i++) {
    const old = await page.evaluateHandle(() => [...document.querySelectorAll(".ch02-reverse-flow")]);
    await page.evaluate(() => platformApi.switchModule("multisite-control"));
    check("switch cleanup " + i, await page.evaluate(() =>
      document.querySelectorAll(".ch02-reverse-flow").length === 0
      && document.getAnimations().filter((a) => a.animationName === "ch02ReverseFlow").length === 0));
    check("detached animation cleanup " + i, await old.evaluate((nodes) => nodes.every((n) => !n.isConnected && n.getAnimations().length === 0)));
    await old.dispose();
    await page.evaluate(() => platformApi.switchModule("forward-reverse"));
    // A real mouse interaction catches duplicate root listeners after remount.
    await page.locator('[data-component-id="qf1"] .ch02-reverse-hitbox').click();
    check("one QF action after remount " + i, await page.evaluate(() => platformApi.getCurrentStateSnapshot().operation.power === "closed"));
    await action("START_FORWARD_PRESS"); await inspect("remount running " + i, "forward");
  }
  await page.evaluate(() => platformApi.resetCurrent());
  const final = await inspect("final reset", "stopped");
  assert.deepEqual(checks.filter((c) => !c.pass), [], "Current Flow acceptance failures");
  return {
    passed: checks.length, checks, states, motion, reduced,
    cleanup: { flowCount: final.flowCount, animationCount: final.flowAnimations, timeoutCount: final.scopes.timeoutCount, intervalCount: final.scopes.intervalCount },
    regression: { activePathPassed: regression.passed, electricalPassed: regression.electrical.passed, combinations: regression.electrical.combinations, geometryHash: regression.electrical.geometryHash }
  };
}
module.exports = { runCurrentFlowChecks };
if (require.main === module) (async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto((process.env.ECTP_TEST_URL || "http://127.0.0.1:8765") + "/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    const report = await runCurrentFlowChecks(page);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: report.passed, regression: report.regression, cleanup: report.cleanup, browserErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
