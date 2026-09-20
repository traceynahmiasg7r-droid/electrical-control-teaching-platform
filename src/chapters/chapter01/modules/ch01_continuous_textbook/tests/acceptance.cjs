"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const repo = path.resolve(__dirname, "../../../../../.."), output = path.join(repo, "output/playwright");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = `${process.env.ECTP_TEST_URL || "http://127.0.0.1:4173"}/index.html`;

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const reports = [], errors = [], screenshots = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => { if (e.type() === "error") errors.push(e.text()); });
  const check = (id, pass, evidence = null) => reports.push({ id, pass: Boolean(pass), evidence });
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "ch01-continuous-browser-acceptance"), { type, payload });
  const read = () => page.evaluate(() => ({ snapshot: platformApi.getCurrentStateSnapshot(), solver: platformApi.getCurrentSolverResult(), playback: platformApi.getCurrentPlaybackViewModel(), operation: platformApi.getCurrentOperationViewModel(), feedback: platformApi.getCurrentTeachingFeedback() }));
  const reset = async (power = true) => { await action("RESET_MODULE"); if (power) await action("POWER_CLOSE"); };
  const pressCanvas = async (id) => { const box = await page.locator(`[data-component-id="${id}"] .ch01-continuous-textbook-hitbox`).boundingBox(); assert(box, `visible ${id} hitbox`); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); };
  const releasePointer = async () => { await page.mouse.move(4, 4); await page.mouse.up(); };
  const screenshot = async (name) => { const filename = `ch01-continuous-${name}.png`; await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" }); screenshots.push(filename); };
  const visualBinding = async (name) => {
    const evidence = await page.evaluate(() => {
      const result = platformApi.getCurrentSolverResult(), svg = document.querySelector(".ch01-continuous-textbook-board");
      const expectedWires = [...new Set(result.activeWireIds || [...(result.activeMainWireIds || []), ...(result.activeControlWireIds || [])])].sort();
      const expectedEdges = [...(result.activeEdgeIds || [])].filter((id) => id !== "km_coil").sort();
      const activeWires = [...svg.querySelectorAll(".ch01-continuous-textbook-active")].map((el) => el.dataset.wireId).sort();
      const flowWires = [...svg.querySelectorAll("[data-flow-wire-id]")].map((el) => el.dataset.flowWireId).sort();
      const activeEdges = [...svg.querySelectorAll(".ch01-continuous-textbook-conductor.is-active")].map((el) => el.dataset.edgeId).sort();
      const flowEdges = [...svg.querySelectorAll("[data-flow-edge-id]")].map((el) => el.dataset.flowEdgeId).sort();
      const badMechanics = svg.querySelectorAll("[data-flow-source-symbol],.ch01-continuous-textbook-actuator [data-flow-wire-id],.ch01-continuous-textbook-teaching-decoration[data-flow-wire-id]").length;
      return { expectedWires, expectedEdges, activeWires, flowWires, activeEdges, flowEdges, badMechanics, km: svg.querySelector('[data-component-id="km_coil"]').dataset.energized, motor: svg.querySelector('[data-component-id="motor"]').dataset.running, solverKm: Boolean(result.stableDeviceStates.KM), solverMotor: Boolean(result.motorStates.M.running) };
    });
    check(`${name}: active wires and conductive edges bind Solver`, JSON.stringify(evidence.expectedWires) === JSON.stringify(evidence.activeWires) && JSON.stringify(evidence.expectedWires) === JSON.stringify(evidence.flowWires) && JSON.stringify(evidence.expectedEdges) === JSON.stringify(evidence.activeEdges) && JSON.stringify(evidence.expectedEdges) === JSON.stringify(evidence.flowEdges) && !evidence.badMechanics && evidence.km === String(evidence.solverKm) && evidence.motor === String(evidence.solverMotor), evidence);
  };
  try {
    await page.goto(url); await page.waitForFunction(() => window.platformApi);
    await page.evaluate(() => platformApi.switchModule("ch01-continuous-control"));
    await page.locator(".ch01-continuous-textbook-board").waitFor();
    let current = await read();
    const metadata = await page.evaluate(() => {
      const d = ECTPPlatform.moduleCircuitData.ch01ContinuousTextbook, svg = document.querySelector(".ch01-continuous-textbook-board"), labels = [...svg.querySelectorAll("text")];
      const red = (paint) => { const m = /^rgb\\((\\d+), (\\d+), (\\d+)\\)$/.exec(paint); return m && Number(m[1]) > 160 && Number(m[2]) < 110 && Number(m[3]) < 110; };
      return { reference: d.reference, geometry: d.validateGeometry(), counts: { wires: d.wires.length, edges: d.deviceEdges.length, ports: d.ports.length, components: d.components.length }, debug: svg.querySelectorAll("[data-port-id],[data-debug]").length, red: [...svg.querySelectorAll("*")].filter((el) => { const c = getComputedStyle(el); return red(c.fill) || red(c.stroke); }).length, labelsNoStroke: labels.every((el) => getComputedStyle(el).stroke === "none") };
    });
    check("route, source identity, geometry and module contract", current.snapshot.moduleId === "ch01_continuous" && metadata.reference.sha256 === "E6150D4C6C330B6C4CCB7A4B8D13DF6A31FCADE7C4986D182EED9ECDA56FA75C" && metadata.reference.width === 1798 && metadata.reference.height === 1219 && metadata.geometry.valid && JSON.stringify(metadata.counts) === JSON.stringify({ wires: 14, edges: 7, ports: 24, components: 6 }) && !metadata.debug, metadata);
    check("static black source tracing has no active red path", !metadata.red && metadata.labelsNoStroke && !current.solver.activeEdgeIds.length && !current.solver.activeWireIds.length, metadata);
    await screenshot("static-platform"); await visualBinding("initial");

    await action("POWER_CLOSE"); current = await read(); check("external supply alone does not energize KM", !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running && current.solver.edgeStates.sb2_nc.conductive);
    await action("JOG_PRESS", { command: "start" }); current = await read(); check("SB1 start energizes KM and motor", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running && current.solver.edgeStates.sb1_no.conductive); await visualBinding("start-held"); await screenshot("start-held");
    await action("JOG_RELEASE", { command: "start" }); current = await read(); check("SB1 release keeps self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running && current.solver.edgeStates.km_self_no.conductive); await visualBinding("self-hold");
    await action("JOG_PRESS", { command: "stop" }); current = await read(); check("SB2 press opens NC and stops motor", current.snapshot.operation.controls.sb2 === "pressed" && !current.solver.motorStates.M.running && !current.solver.stableDeviceStates.KM && !current.solver.edgeStates.sb2_nc.conductive); await visualBinding("stop-held"); await screenshot("stop-held");
    await action("JOG_RELEASE", { command: "stop" }); current = await read(); check("SB2 release closes NC without auto restart", current.snapshot.operation.controls.sb2 === "released" && current.solver.edgeStates.sb2_nc.conductive && !current.solver.motorStates.M.running);

    await reset(true); await action("JOG_PRESS", { command: "start" }); await action("JOG_PRESS", { command: "stop" }); current = await read(); check("simultaneous SB1 and SB2 gives stop priority", current.solver.edgeStates.sb2_nc.conductive === false && !current.solver.motorStates.M.running); await action("JOG_RELEASE", { command: "stop" }); await action("JOG_RELEASE", { command: "start" });
    await reset(false); await action("JOG_PRESS", { command: "start" }); current = await read(); check("held SB1 remains physically pressed while unpowered", current.snapshot.operation.controls.sb1 === "pressed" && !current.solver.motorStates.M.running); await action("POWER_CLOSE"); current = await read(); check("power restore while SB1 held resumes real circuit", current.solver.motorStates.M.running); await action("POWER_OPEN"); current = await read(); check("power open drops KM while preserving hold", !current.solver.motorStates.M.running && current.snapshot.operation.controls.sb1 === "pressed"); await action("JOG_RELEASE", { command: "start" }); await action("POWER_CLOSE"); current = await read(); check("release before restore prevents auto restart", !current.solver.motorStates.M.running);

    await reset(true); await pressCanvas("sb1"); current = await read(); check("canvas pointer press starts", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running); await releasePointer(); current = await read(); check("canvas pointer release preserves self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running); await pressCanvas("sb2"); current = await read(); check("canvas SB2 pointer opens NC", current.snapshot.operation.controls.sb2 === "pressed" && !current.solver.motorStates.M.running); await releasePointer();
    await reset(true); await page.locator('[data-component-id="sb1"]').focus(); await page.keyboard.down("Space"); current = await read(); check("canvas keyboard press starts", current.solver.motorStates.M.running); await page.keyboard.up("Space"); current = await read(); check("canvas keyboard release self-holds", current.solver.motorStates.M.running); await page.locator('[data-component-id="sb2"]').focus(); await page.keyboard.down("Enter"); current = await read(); check("canvas keyboard SB2 stop", current.snapshot.operation.controls.sb2 === "pressed" && !current.solver.motorStates.M.running); await page.keyboard.up("Enter");

    await reset(true); await action("JOG_PRESS", { command: "start" }); await action("JOG_RELEASE", { command: "start" }); const live = await read(); await page.evaluate(() => platformApi.dispatchPlayback("restart")); await page.evaluate(() => platformApi.dispatchPlayback("toggle")); current = await read(); check("Playback isolates live display", current.playback.mode === "Playback" && JSON.stringify(current.snapshot) === JSON.stringify(live.snapshot)); await screenshot("playback"); await page.evaluate(() => platformApi.dispatchPlayback("exit")); current = await read(); check("Playback exit restores Live self-hold", current.playback.mode === "Live" && current.solver.motorStates.M.running);
    await page.evaluate(() => platformApi.switchModule("ch01-jog-control")); await page.waitForTimeout(40); await page.evaluate(() => platformApi.switchModule("ch01-continuous-control")); await page.locator(".ch01-continuous-textbook-board").waitFor(); current = await read(); const reentryDom = await page.evaluate(() => Boolean(document.querySelector(".ch01-jog-textbook-board"))); check("module cleanup and reentry resets safely", current.snapshot.moduleId === "ch01_continuous" && !current.solver.motorStates.M.running && !reentryDom);
    await page.setViewportSize({ width: 390, height: 844 }); check("mobile document does not overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await screenshot("mobile");
    const report = { passed: reports.every((item) => item.pass) && errors.length === 0, total: reports.length, passedChecks: reports.filter((item) => item.pass).length, reports, errors, screenshots };
    fs.writeFileSync(path.join(output, "ch01-continuous-validation.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
