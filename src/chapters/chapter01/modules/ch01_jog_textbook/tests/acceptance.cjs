"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const base = path.resolve(__dirname, ".."), repo = path.resolve(__dirname, "../../../../../.."), output = path.join(repo, "output/playwright");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = `${process.env.ECTP_TEST_URL || "http://127.0.0.1:4173"}/index.html`;
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), imagePage = await browser.newPage();
  const reports = [], errors = [], screenshots = [], states = [];
  const check = (id, pass, evidence = null) => reports.push({ id, pass: Boolean(pass), evidence });
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (e) => { if (e.type() === "error") errors.push(e.text()); });
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "ch01-jog-browser-acceptance"), { type, payload });
  const replay = (command, value) => page.evaluate(({ command, value }) => platformApi.dispatchPlayback(command, value), { command, value });
  const read = () => page.evaluate(() => ({ snapshot: platformApi.getCurrentStateSnapshot(), solver: platformApi.getCurrentSolverResult(), playback: platformApi.getCurrentPlaybackViewModel(), feedback: platformApi.getCurrentTeachingFeedback(), operation: platformApi.getCurrentOperationViewModel() }));
  const remember = async (name) => { const value = await read(); states.push({ name, ...value }); return value; };
  const down = async (selector = '[data-component-id="sb1"] .ch01-jog-textbook-hitbox') => { const box = await page.locator(selector).boundingBox(); assert(box, `visible ${selector}`); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); };
  const up = async () => { await page.mouse.move(4, 4); await page.mouse.up(); };
  const reset = async (powered = true) => { await action("RESET_MODULE"); if (powered) await action("POWER_CLOSE"); };
  async function screenshot(name, box) {
    const filename = `ch01-jog-${name}.png`;
    if (box) {
      const svg = await page.locator(".ch01-jog-textbook-board").evaluate((el) => el.outerHTML);
      await imagePage.setViewportSize({ width: box.width, height: box.height });
      await imagePage.setContent(`<html><head><style>body{margin:0}${fs.readFileSync(path.join(base, "styles.css"), "utf8")}</style></head><body>${svg}</body></html>`);
      await imagePage.locator("svg").evaluate((el, box) => { el.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`); el.style.width = `${box.width}px`; el.style.height = `${box.height}px`; }, box);
      await imagePage.screenshot({ path: path.join(output, filename), animations: "disabled" });
    } else await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" });
    screenshots.push(filename);
  }
  async function visualCheck(name) {
    const evidence = await page.evaluate(() => {
      const player = platformApi.getCurrentPlaybackViewModel(), result = player.mode === "Playback" ? player.displayState.solverResult : platformApi.getCurrentSolverResult();
      const svg = document.querySelector(".ch01-jog-textbook-board"), list = (s, a) => [...svg.querySelectorAll(s)].map((el) => el.getAttribute(a)).sort();
      const active = list(".ch01-jog-textbook-active", "data-wire-id"), wireFlow = list("[data-flow-wire-id]", "data-flow-wire-id"), activeEdges = list(".ch01-jog-textbook-conductor.is-active", "data-edge-id"), edgeFlow = list("[data-flow-edge-id]", "data-flow-edge-id");
      const expectedWires = [...new Set(result.activeWireIds || [...result.activeMainWireIds, ...result.activeControlWireIds])].sort();
      const expectedEdges = result.activeEdgeIds.filter((id) => id !== "km_coil").sort();
      const badRefs = [...svg.querySelectorAll(".ch01-jog-textbook-flow,.ch01-jog-textbook-active,.ch01-jog-textbook-conductor.is-active")].filter((el) => {
        const wire = el.dataset.wireId || el.dataset.flowWireId, edge = el.dataset.edgeId || el.dataset.flowEdgeId;
        const base = wire ? svg.querySelector(`.ch01-jog-textbook-wire[data-wire-id="${wire}"]`) : svg.querySelector(`.ch01-jog-textbook-conductor[data-edge-id="${edge}"]`);
        return !base || base.getAttribute("href") !== el.getAttribute("href") || !svg.querySelector(el.getAttribute("href"))?.closest("defs") || (edge && !result.edgeStates[edge]?.conductive);
      }).map((el) => el.outerHTML);
      return { expectedWires, expectedEdges, active, wireFlow, activeEdges, edgeFlow, badRefs, motorDOM: svg.querySelector('[data-component-id="motor"]').dataset.running, motorSolver: Boolean(result.motorStates.M.running), coilDOM: svg.querySelector('[data-component-id="km_coil"]').dataset.energized, coilSolver: Boolean(result.stableDeviceStates.KM), mechanicsFlow: svg.querySelectorAll(".ch01-jog-textbook-actuator .ch01-jog-textbook-flow,.ch01-jog-textbook-source .ch01-jog-textbook-flow,[data-flow-wire-id*='source'],[data-flow-wire-id*='symbol']").length };
    });
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(`${name}: Solver geometry active/flow and component state agree`, same(evidence.expectedWires, evidence.active) && same(evidence.expectedWires, evidence.wireFlow) && same(evidence.expectedEdges, evidence.activeEdges) && same(evidence.expectedEdges, evidence.edgeFlow) && !evidence.badRefs.length && !evidence.mechanicsFlow && evidence.motorDOM === String(evidence.motorSolver) && evidence.coilDOM === String(evidence.coilSolver), evidence);
  }
  try {
    await page.goto(url); await page.waitForFunction(() => window.platformApi);
    await page.evaluate(() => {
      const runtime = ECTPPlatform.runtime; window.__jogScopes = [];
      ECTPPlatform.runtime = Object.freeze({ ...runtime, createRuntimeScope(id) { const scope = runtime.createRuntimeScope(id); if (id === "ch01_jog") window.__jogScopes.push(scope); return scope; } });
      platformApi.switchModule("ch01-jog-control");
    });
    await page.locator(".ch01-jog-textbook-board").waitFor();
    let current = await remember("initial");
    const metadata = await page.evaluate(() => {
      const svg = document.querySelector(".ch01-jog-textbook-board"), labels = [...svg.querySelectorAll("text")];
      const red = (paint) => { const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(paint); return match && Number(match[1]) > 160 && Number(match[2]) < 110 && Number(match[3]) < 110; };
      return { contract: platformApi.getCurrentContractReport(), data: ECTPPlatform.moduleCircuitData.ch01JogTextbook.reference, box: ECTPPlatform.moduleCircuitData.ch01JogTextbook.viewBox, geometry: ECTPPlatform.moduleCircuitData.ch01JogTextbook.validateGeometry(), active: svg.querySelectorAll(".ch01-jog-textbook-active,.ch01-jog-textbook-flow,.ch01-jog-textbook-conductor.is-active").length, debug: svg.querySelectorAll("[data-port-id],[data-debug]").length, computed: { labelsNoStroke: labels.every((el) => getComputedStyle(el).stroke === "none"), backgroundNoStroke: getComputedStyle(svg.querySelector(".ch01-jog-textbook-background")).stroke === "none", redElements: [...svg.querySelectorAll("*")].filter((el) => { const css = getComputedStyle(el); return red(css.fill) || red(css.stroke); }).map((el) => el.outerHTML) } };
    });
    check("public route and facade contract", current.snapshot.moduleId === "ch01_jog" && metadata.contract.valid && metadata.geometry.valid, metadata);
    check("initial is black with all NO contacts open", !metadata.active && !metadata.debug && !current.solver.edgeStates.sb1_no.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    check("integrated CSS preserves black text and border-free white board", metadata.computed.labelsNoStroke && metadata.computed.backgroundNoStroke && !metadata.computed.redElements.length, metadata.computed);
    check("no invented QF or FR controls", !(current.operation.protections || []).some((x) => x.visible !== false) && !(await page.locator("#operationControlCard button:visible").allTextContents()).some((label) => /QF|FR|过载/.test(label)));
    fs.copyFileSync(metadata.data.path, path.join(output, "ch01-jog-source-reference.png")); screenshots.push("ch01-jog-source-reference.png");
    await screenshot("static-full", metadata.box); await screenshot("static-platform"); await visualCheck("initial");
    await down(); current = await read(); check("unpowered SB press changes contact but cannot run motor", current.solver.edgeStates.sb1_no.conductive && !current.solver.motorStates.M.running); await up();
    await action("POWER_CLOSE"); current = await read(); check("external supply alone cannot energize KM", !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running); await visualCheck("supply only");
    const before = await page.locator("#ch01-jog-edge-sb1_no").getAttribute("d"), mainBefore = await page.locator("#ch01-jog-edge-km_main_a").getAttribute("d");
    await down(); await page.waitForTimeout(400); current = await remember("canvas-pressed");
    check("true held SB1 drives KM and M", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running);
    check("button blade, actuator and main poles physically move", before !== await page.locator("#ch01-jog-edge-sb1_no").getAttribute("d") && mainBefore !== await page.locator("#ch01-jog-edge-km_main_a").getAttribute("d") && await page.locator(".ch01-jog-textbook-actuator").getAttribute("transform") === "translate(0 9)");
    await screenshot("key-interaction"); await screenshot("conducting-full", metadata.box); await visualCheck("held");
    await up(); current = await remember("released"); check("outside pointer release drops KM and motor without self hold", current.snapshot.operation.controls.sb1 === "released" && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running && before === await page.locator("#ch01-jog-edge-sb1_no").getAttribute("d")); await visualCheck("released");
    await page.locator('[data-component-id="sb1"]').focus(); await page.keyboard.down("Space"); current = await read(); check("canvas keyboard holds real contact", current.solver.motorStates.M.running); await down(); await page.keyboard.up("Space"); current = await read(); check("canvas remaining pointer owner retains hold", current.solver.motorStates.M.running); await up(); current = await read(); check("last canvas owner releases", !current.solver.motorStates.M.running);
    await down("#pressSb1"); await page.waitForTimeout(400); current = await read(); check("shell primary supports sustained hold", current.solver.motorStates.M.running); await up(); current = await read(); check("shell outside release stops motor", !current.solver.motorStates.M.running);
    await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); await down("#pressSb1"); await up(); current = await read(); check("shell keyboard survives pointer release", current.solver.motorStates.M.running); await page.keyboard.up("Space"); current = await read(); check("last shell owner stops motor", !current.solver.motorStates.M.running);
    await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); await page.keyboard.down("Enter"); await page.keyboard.up("Space"); current = await read(); check("independent shell keyboard owners", current.solver.motorStates.M.running); await page.keyboard.up("Enter");
    await down(); await page.evaluate(() => window.dispatchEvent(new Event("blur"))); current = await read(); check("window blur releases canvas hold", !current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "released"); await up();
    await down("#pressSb1"); await action("POWER_OPEN"); current = await read(); check("external disconnection drops KM/M but preserves physical press", !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "pressed");
    await action("POWER_CLOSE"); current = await read(); check("restoring supply while physically held follows the actual closed SB circuit", current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "pressed"); await up(); await action("POWER_OPEN"); await action("POWER_CLOSE"); current = await read(); check("supply restoration after release does not start motor", !current.solver.motorStates.M.running);
    await down(); await action("RESET_MODULE"); current = await read(); check("reset clears renderer input ownership and contacts", current.snapshot.operation.controls.sb1 === "released" && !current.solver.motorStates.M.running); await up(); await action("POWER_CLOSE"); await down(); current = await read(); check("fresh canvas hold works after reset boundary", current.solver.motorStates.M.running); await up();
    await down(); const physicalLive = (await read()).snapshot; await replay("restart"); await replay("toggle"); current = await read(); check("entering Playback preserves a physically held Live button", JSON.stringify(current.snapshot) === JSON.stringify(physicalLive)); await up(); current = await read(); check("actual release during Playback returns to released Live", current.playback.mode === "Live" && !current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "released");
    await action("JOG_PRESS", { command: "jog" }); const live = (await read()).snapshot;
    await replay("restart"); await replay("toggle"); current = await read(); check("Playback begins in isolated display state", current.playback.mode === "Playback" && JSON.stringify(current.snapshot) === JSON.stringify(live));
    let replayRunning = false;
    for (let i = 0; i < current.playback.count; i++) { current = await read(); if (current.playback.displayState.solverResult.motorStates.M.running) { replayRunning = true; break; } await replay("next"); }
    check("Playback includes actual energized Solver frame", replayRunning); await screenshot("playback"); await visualCheck("Playback");
    await replay("next"); current = await read(); check("Playback steps preserve held Live state", JSON.stringify(current.snapshot) === JSON.stringify(live));
    await replay("exit"); current = await read(); check("exit restores Live held motor", current.playback.mode === "Live" && current.solver.motorStates.M.running); await action("JOG_RELEASE", { command: "jog" });
    const controls = await page.locator("#operationControlCard button:visible").allTextContents(); check("Chinese controls and teaching explain momentary behavior", controls.every((s) => /[\u3400-\u9fff]/.test(s)) && /释放|松开|点动/.test(JSON.stringify((await read()).feedback)), controls);
    await screenshot("status-buttons");
    await page.setViewportSize({ width: 1366, height: 768 }); check("1366 no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await screenshot("platform-1366");
    await page.setViewportSize({ width: 390, height: 844 }); check("mobile no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await screenshot("mobile-390");
    await page.setViewportSize({ width: 1600, height: 1000 }); await replay("restart");
    check("runtime cleanup exercise has active playback timer", await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope.timeoutCount > 0));
    await page.evaluate(() => platformApi.switchModule("forward-reverse"));
    await page.waitForTimeout(1900);
    const cleanup = await page.evaluate(() => ({ scopes: window.__jogScopes.map((s) => s.diagnostics()), node: document.querySelectorAll(".ch01-jog-textbook-module").length, classLeft: document.body.classList.contains("ch01-jog-textbook-active") }));
    check("unmount disposes timers, listeners and old board", cleanup.scopes.every((s) => s.disposed && !s.timeoutCount && !s.intervalCount && !s.cleanupCount) && !cleanup.node && !cleanup.classLeft, cleanup);
    await page.evaluate(() => platformApi.switchModule("ch01-jog-control")); current = await read(); check("reentry is neutral", !current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "released" && current.playback.mode === "Live");
  } catch (error) { check("acceptance reaches final stage", false, error.stack || String(error)); try { await screenshot("failure"); } catch (_) {} }
  finally {
    const result = { passed: reports.every((r) => r.pass) && !errors.length, checks: reports.length, reports, browserErrors: errors, screenshots, states };
    fs.writeFileSync(path.join(output, "ch01-jog-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: result.passed, checks: result.checks, failures: reports.filter((r) => !r.pass), browserErrors: errors, screenshots }, null, 2));
    await browser.close(); if (!result.passed) process.exitCode = 1;
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
