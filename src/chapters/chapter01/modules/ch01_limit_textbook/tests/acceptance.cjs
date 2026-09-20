"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const base = path.resolve(__dirname, "..");
const repo = path.resolve(__dirname, "../../../../../..");
const output = path.join(repo, "output/playwright");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = `${process.env.ECTP_TEST_URL || "http://127.0.0.1:4173"}/index.html`;

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const imagePage = await browser.newPage({ viewport: { width: 1030, height: 670 } });
  const reports = [], browserErrors = [], screenshots = [], states = [];
  let fatal = null;

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const check = (id, pass, evidence = null) => reports.push({ id, pass: Boolean(pass), evidence });
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "ch01-limit-browser-acceptance"), { type, payload });
  const replay = (command, value) => page.evaluate(({ command, value }) => platformApi.dispatchPlayback(command, value), { command, value });
  const read = () => page.evaluate(() => ({
    snapshot: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    operation: platformApi.getCurrentOperationViewModel(),
    status: platformApi.getCurrentStatusViewModel(),
    feedback: platformApi.getCurrentTeachingFeedback(),
    diagnostics: platformApi.getDiagnostics()
  }));
  const remember = async (name) => { const value = await read(); states.push({ name, ...value }); return value; };
  const reset = async (powered = true) => { await action("RESET_MODULE"); if (powered) await action("POWER_CLOSE"); };
  const pressCanvas = async (command) => {
    const selector = `.ch01-limit-textbook-hitbox[data-action-command="${command}"]`;
    const box = await page.locator(selector).boundingBox();
    assert(box, `visible ${selector}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  };
  const releasePointer = async () => { await page.mouse.move(4, 4); await page.mouse.up(); };
  const edgePath = (edgeId) => page.evaluate((id) => {
    const svg = document.querySelector(".ch01-limit-textbook-board");
    const use = svg.querySelector(`.ch01-limit-textbook-conductor[data-edge-id="${id}"]`);
    const definition = use?.getAttribute("href") && svg.querySelector(use.getAttribute("href"));
    return definition?.getAttribute("d") || null;
  }, edgeId);

  async function screenshot(name, svgOnly = false) {
    const filename = `ch01-limit-${name}.png`;
    if (!svgOnly) {
      await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" });
    } else {
      const svg = await page.locator(".ch01-limit-textbook-board").evaluate((node) => node.outerHTML);
      const box = await page.evaluate(() => ECTPPlatform.moduleCircuitData.ch01LimitTextbook.viewBox);
      const styles = fs.readFileSync(path.join(base, "styles.css"), "utf8");
      await imagePage.setViewportSize({ width: box.width, height: box.height });
      await imagePage.setContent(`<html><head><style>html,body{margin:0;width:${box.width}px;height:${box.height}px;overflow:hidden}${styles}</style></head><body>${svg}</body></html>`);
      await imagePage.locator("svg").evaluate((node, size) => { node.style.width = `${size.width}px`; node.style.height = `${size.height}px`; }, box);
      await imagePage.screenshot({ path: path.join(output, filename), animations: "disabled" });
    }
    screenshots.push(filename);
  }

  async function visualBinding(name) {
    const evidence = await page.evaluate(() => {
      const playback = platformApi.getCurrentPlaybackViewModel();
      const result = playback.mode === "Playback" ? playback.displayState.solverResult : platformApi.getCurrentSolverResult();
      const svg = document.querySelector(".ch01-limit-textbook-board");
      const list = (selector, attribute) => [...svg.querySelectorAll(selector)].map((node) => node.getAttribute(attribute)).sort();
      const expectedWires = [...new Set(result.activeWireIds || [...(result.activeMainWireIds || []), ...(result.activeControlWireIds || [])])].sort();
      const expectedEdges = [...new Set(result.activeEdgeIds || [])].filter((id) => id !== "km_coil").sort();
      const activeWires = list(".ch01-limit-textbook-active", "data-wire-id");
      const flowWires = list("[data-flow-wire-id]", "data-flow-wire-id");
      const activeEdges = list(".ch01-limit-textbook-conductor.is-active", "data-edge-id");
      const flowEdges = list("[data-flow-edge-id]", "data-flow-edge-id");
      const badGeometryRefs = [...svg.querySelectorAll(".ch01-limit-textbook-active,.ch01-limit-textbook-flow,.ch01-limit-textbook-conductor.is-active")].filter((node) => {
        const wireId = node.dataset.wireId || node.dataset.flowWireId;
        const edgeId = node.dataset.edgeId || node.dataset.flowEdgeId;
        const base = wireId
          ? svg.querySelector(`.ch01-limit-textbook-wire[data-wire-id="${wireId}"]`)
          : svg.querySelector(`.ch01-limit-textbook-conductor[data-edge-id="${edgeId}"]`);
        const definition = node.getAttribute("href") && svg.querySelector(node.getAttribute("href"));
        return !base || base.getAttribute("href") !== node.getAttribute("href") || !definition?.closest("defs") || (edgeId && !result.edgeStates?.[edgeId]?.conductive);
      }).map((node) => node.outerHTML);
      const component = (id, key) => svg.querySelector(`[data-component-id="${id}"]`)?.dataset[key];
      const edgeGeometry = Object.fromEntries(["sb1_no", "km_self_no", "sb2_nc", "fr1_nc", "sq_nc", "km_main_a", "km_main_b", "km_main_c"].map((id) => {
        const use = svg.querySelector(`.ch01-limit-textbook-conductor[data-edge-id="${id}"]`);
        const def = use?.getAttribute("href") && svg.querySelector(use.getAttribute("href"));
        return [id, { conductive: use?.dataset.conductive, expectedConductive: String(Boolean(result.edgeStates?.[id]?.conductive)), path: def?.getAttribute("d") }];
      }));
      return {
        expectedWires, expectedEdges, activeWires, flowWires, activeEdges, flowEdges,
        badGeometryRefs,
        mechanicsFlow: svg.querySelectorAll(".ch01-limit-textbook-symbol[data-flow-wire-id],.ch01-limit-textbook-label[data-flow-wire-id],.ch01-limit-textbook-component.is-teaching-focus [data-flow-wire-id]").length,
        kmMainDOM: component("km_main", "energized"), coilDOM: component("km_coil", "energized"), motorDOM: component("motor", "running"),
        kmSolver: Boolean(result.stableDeviceStates.KM), motorSolver: Boolean(result.motorStates.M.running), edgeGeometry
      };
    });
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const physicalMatches = Object.values(evidence.edgeGeometry).every((item) => item.conductive === item.expectedConductive && Boolean(item.path));
    check(`${name}: Solver wires/edges/current flow bind exact geometry`,
      same(evidence.expectedWires, evidence.activeWires)
      && same(evidence.expectedWires, evidence.flowWires)
      && same(evidence.expectedEdges, evidence.activeEdges)
      && same(evidence.expectedEdges, evidence.flowEdges)
      && !evidence.badGeometryRefs.length && !evidence.mechanicsFlow
      && evidence.kmMainDOM === String(evidence.kmSolver)
      && evidence.coilDOM === String(evidence.kmSolver)
      && evidence.motorDOM === String(evidence.motorSolver)
      && physicalMatches,
    evidence);
  }

  async function componentState(name) {
    const evidence = await page.evaluate(() => {
      const playback = platformApi.getCurrentPlaybackViewModel();
      const result = playback.mode === "Playback" ? playback.displayState.solverResult : platformApi.getCurrentSolverResult();
      const svg = document.querySelector(".ch01-limit-textbook-board");
      const info = (id, edgeId) => {
        const node = svg.querySelector(`[data-component-id="${id}"]`);
        const use = edgeId && svg.querySelector(`.ch01-limit-textbook-conductor[data-edge-id="${edgeId}"]`);
        const definition = use?.getAttribute("href") && svg.querySelector(use.getAttribute("href"));
        return { closed: node?.dataset.closed, conductive: edgeId ? String(Boolean(result.edgeStates[edgeId].conductive)) : null, path: definition?.getAttribute("d") || null };
      };
      return {
        sb1: info("sb1", "sb1_no"), self: info("km_self", "km_self_no"), sb2: info("sb2", "sb2_nc"),
        fr1: info("fr1_nc", "fr1_nc"), sq: info("sq", "sq_nc"),
        mainClosed: ["a", "b", "c"].map((phase) => svg.querySelector(`[data-pole-id="km_main_${phase}"]`)?.dataset.closed),
        mainExpected: String(Boolean(result.stableDeviceStates.KM)),
        coil: svg.querySelector('[data-component-id="km_coil"]')?.dataset.energized,
        motor: svg.querySelector('[data-component-id="motor"]')?.dataset.running,
        solverMotor: String(Boolean(result.motorStates.M.running))
      };
    });
    const contacts = [evidence.sb1, evidence.self, evidence.sb2, evidence.fr1, evidence.sq];
    check(`${name}: component data state and physical contact geometry follow Solver`, contacts.every((item) => item.closed === item.conductive && item.path) && evidence.mainClosed.every((value) => value === evidence.mainExpected) && evidence.coil === evidence.mainExpected && evidence.motor === evidence.solverMotor, evidence);
  }

  try {
    await page.goto(url);
    await page.waitForFunction(() => window.platformApi);
    await page.evaluate(() => {
      const runtime = ECTPPlatform.runtime;
      window.__limitScopes = [];
      ECTPPlatform.runtime = Object.freeze({ ...runtime, createRuntimeScope(id) { const scope = runtime.createRuntimeScope(id); if (id === "ch01_limit") window.__limitScopes.push(scope); return scope; } });
      platformApi.switchModule("ch01-limit-switch-control");
    });
    await page.locator(".ch01-limit-textbook-board").waitFor();

    let current = await remember("initial");
    const metadata = await page.evaluate(() => {
      const data = ECTPPlatform.moduleCircuitData.ch01LimitTextbook;
      const svg = document.querySelector(".ch01-limit-textbook-board");
      const red = (paint) => { const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(paint); return match && Number(match[1]) > 160 && Number(match[2]) < 110 && Number(match[3]) < 110; };
      return {
        contract: platformApi.getCurrentContractReport(), reference: data.reference, box: data.viewBox,
        geometry: data.validateGeometry(), counts: { wires: data.wires.length, edges: data.deviceEdges.length, ports: data.ports.length, components: data.components.length, junctions: data.junctions.length, crossings: data.crossings.length },
        viewBox: svg.getAttribute("viewBox"), debug: svg.querySelectorAll("[data-port-id],[data-debug],.debug-marker").length,
        renderedWires: [...svg.querySelectorAll(".ch01-limit-textbook-wire[data-wire-id]")].map((node) => node.dataset.wireId).sort(),
        expectedWires: data.wires.map((wire) => wire.wireId).sort(),
        renderedEdges: [...svg.querySelectorAll(".ch01-limit-textbook-conductor[data-edge-id]")].map((node) => node.dataset.edgeId).sort(),
        expectedEdges: data.deviceEdges.map((edge) => edge.edgeId).filter((id) => id !== "km_coil").sort(),
        redElements: [...svg.querySelectorAll("*")].filter((node) => { const style = getComputedStyle(node); return red(style.fill) || red(style.stroke); }).map((node) => node.outerHTML),
        labelsNoStroke: [...svg.querySelectorAll("text")].every((node) => getComputedStyle(node).stroke === "none"),
        hitboxesInvisible: [...svg.querySelectorAll(".ch01-limit-textbook-hitbox")].every((node) => getComputedStyle(node).fill === "rgba(0, 0, 0, 0)" || Number(getComputedStyle(node).fillOpacity) === 0)
      };
    });
    const bytes = fs.readFileSync(metadata.reference.path);
    const source = { sha256: crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    check("route, source identity, module contract and geometry", current.snapshot.moduleId === "ch01_limit" && metadata.contract.valid && metadata.geometry.valid && source.sha256 === "D5CB8C85112FDAFBF9A1B12F3FF4FBD0BDE34784AF305DD26E8409402259F357" && source.width === 1713 && source.height === 1186 && metadata.reference.sha256 === source.sha256 && metadata.viewBox === `${metadata.box.x} ${metadata.box.y} ${metadata.box.width} ${metadata.box.height}`, { metadata, source });
    check("initial SVG is clean black source tracing with one base geometry per electrical segment", !metadata.debug && !metadata.redElements.length && metadata.labelsNoStroke && metadata.hitboxesInvisible && !current.solver.activeWireIds.length && !current.solver.activeEdgeIds.length && JSON.stringify(metadata.renderedWires) === JSON.stringify(metadata.expectedWires) && JSON.stringify(metadata.renderedEdges) === JSON.stringify(metadata.expectedEdges), metadata);
    check("initial contact and motor state", !current.solver.edgeStates.sb1_no.conductive && current.solver.edgeStates.sb2_nc.conductive && current.solver.edgeStates.sq_nc.conductive && current.solver.edgeStates.fr1_nc.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    fs.copyFileSync(metadata.reference.path, path.join(output, "ch01-limit-source-reference.png")); screenshots.push("ch01-limit-source-reference.png");
    await screenshot("static-full", true); await screenshot("static-platform"); await visualBinding("initial"); await componentState("initial");
    const openGeometry = {
      sb1: await edgePath("sb1_no"), self: await edgePath("km_self_no"), sb2: await edgePath("sb2_nc"),
      fr1: await edgePath("fr1_nc"), sq: await edgePath("sq_nc"), main: await edgePath("km_main_a")
    };

    await action("POWER_CLOSE"); current = await remember("power-only");
    check("power alone keeps KM and motor released", current.snapshot.operation.power === "closed" && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    await pressCanvas("start"); current = await remember("start-held");
    check("SVG SB1 press energizes KM and three-phase motor", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.edgeStates.sb1_no.conductive && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running && current.solver.motorStates.M.phaseSequence.join(",") === "A,B,C");
    check("SB1, self-hold and main pole geometry physically closes", openGeometry.sb1 !== await edgePath("sb1_no") && openGeometry.self !== await edgePath("km_self_no") && openGeometry.main !== await edgePath("km_main_a"));
    await screenshot("start-held"); await visualBinding("start held"); await componentState("start held");
    await releasePointer(); current = await remember("self-hold");
    check("SB1 release keeps KM self-hold", current.snapshot.operation.controls.sb1 === "released" && !current.solver.edgeStates.sb1_no.conductive && current.solver.edgeStates.km_self_no.conductive && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running);
    await screenshot("selfhold"); await visualBinding("self hold");
    await pressCanvas("stop"); current = await remember("sb2-held");
    check("SVG SB2 NC opens and stops immediately", current.snapshot.operation.controls.sb2 === "pressed" && !current.solver.edgeStates.sb2_nc.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    check("SB2 blade physically moves from its normal NC geometry", openGeometry.sb2 !== await edgePath("sb2_nc"));
    await screenshot("sb2"); await componentState("SB2 held");
    await releasePointer(); current = await read();
    check("SB2 release recloses NC without automatic restart", current.snapshot.operation.controls.sb2 === "released" && current.solver.edgeStates.sb2_nc.conductive && !current.solver.motorStates.M.running);

    await action("POWER_OPEN"); await action("POWER_CLOSE"); current = await read();
    check("ordinary supply restoration cannot bypass released SB1", !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    await action("POWER_OPEN"); await action("JOG_PRESS", { command: "start" }); current = await read();
    check("SB1 can remain physically held without an external supply", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.edgeStates.sb1_no.conductive && !current.solver.motorStates.M.running);
    await action("POWER_CLOSE"); current = await read();
    check("restoring supply while SB1 is still held follows the real closed circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await action("POWER_OPEN"); current = await read();
    check("opening supply drops KM/M without fabricating button release", current.snapshot.operation.controls.sb1 === "pressed" && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    await action("JOG_RELEASE", { command: "start" }); await action("POWER_CLOSE"); current = await read();
    check("releasing SB1 before supply restoration prevents restart", current.snapshot.operation.controls.sb1 === "released" && !current.solver.motorStates.M.running);

    await reset(true);
    const canvasStart = page.locator('.ch01-limit-textbook-hitbox[data-action-command="start"]');
    const canvasFocusable = await canvasStart.evaluate((node) => { node.focus(); return document.activeElement === node; });
    check("SVG controls are keyboard focusable", canvasFocusable);
    if (canvasFocusable) await page.keyboard.down("Space"); else await canvasStart.dispatchEvent("keydown", { key: " ", code: "Space" });
    current = await read();
    check("SVG keyboard press starts real circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    if (canvasFocusable) await page.keyboard.up("Space"); else await canvasStart.dispatchEvent("keyup", { key: " ", code: "Space" });
    current = await read();
    check("SVG keyboard release leaves only electrical self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await pressCanvas("stop"); await releasePointer();

    await reset(true); const shellBox = await page.locator("#pressSb1").boundingBox(); assert(shellBox, "visible shell SB1");
    await page.mouse.move(shellBox.x + shellBox.width / 2, shellBox.y + shellBox.height / 2); await page.mouse.down(); current = await read();
    check("shell pointer hold starts real circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await releasePointer(); current = await read();
    check("shell pointer release leaves only electrical self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);

    await reset(true); await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); current = await read();
    check("shell keyboard press starts real circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await pressCanvas("start"); await page.keyboard.up("Space"); current = await read();
    check("mixed shell and SVG ownership keeps SB1 pressed", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await releasePointer(); current = await read();
    check("last mixed owner release preserves only electrical self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await page.locator("#pressSb2").focus(); await page.keyboard.down("Enter"); current = await read();
    check("shell keyboard SB2 holds NC open", current.snapshot.operation.controls.sb2 === "pressed" && !current.solver.edgeStates.sb2_nc.conductive && !current.solver.motorStates.M.running);
    await page.keyboard.up("Enter");
    await reset(true); await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); await page.evaluate(() => window.dispatchEvent(new Event("blur"))); current = await read();
    check("window blur releases owned momentary input without breaking electrical self-hold", current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await page.keyboard.up("Space");

    await reset(true);
    await page.evaluate(() => {
      window.__limitPointerId = null;
      document.addEventListener("pointerdown", (event) => { window.__limitPointerId = event.pointerId; }, { capture: true, once: true });
    });
    await pressCanvas("start");
    const pointerCancelEvidence = await page.evaluate(() => {
      const pointerId = window.__limitPointerId;
      const owner = document.querySelector("#chapterModuleCanvas");
      const hadCapture = Boolean(pointerId != null && owner?.hasPointerCapture?.(pointerId));
      document.dispatchEvent(new PointerEvent("pointercancel", { pointerId, pointerType: "mouse", isPrimary: true, bubbles: true }));
      return { pointerId, hadCapture };
    });
    await page.waitForFunction(() => platformApi.getCurrentStateSnapshot().operation.controls.sb1 === "released");
    current = await read();
    check("document pointercancel releases a real SVG pointer owner", pointerCancelEvidence.hadCapture && current.snapshot.operation.controls.sb1 === "released" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running, pointerCancelEvidence);
    await page.mouse.up();

    await reset(true);
    await page.evaluate(() => {
      window.__limitPointerId = null;
      document.addEventListener("pointerdown", (event) => { window.__limitPointerId = event.pointerId; }, { capture: true, once: true });
    });
    await pressCanvas("start");
    const lostCaptureEvidence = await page.evaluate(() => {
      const pointerId = window.__limitPointerId;
      const owner = document.querySelector("#chapterModuleCanvas");
      const hadCapture = Boolean(pointerId != null && owner?.hasPointerCapture?.(pointerId));
      if (hadCapture) owner.releasePointerCapture(pointerId);
      return { pointerId, hadCapture };
    });
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => platformApi.getCurrentStateSnapshot().operation.controls.sb1 === "released", null, { timeout: 5000 });
    current = await read();
    check("lostpointercapture releases a real SVG pointer owner", lostCaptureEvidence.hadCapture && current.snapshot.operation.controls.sb1 === "released" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running, lostCaptureEvidence);
    await page.mouse.up();

    const svgSq = '.ch01-limit-textbook-hitbox[data-protection-command="sq"]';
    const svgFr1 = '.ch01-limit-textbook-hitbox[data-protection-command="fr1"]';
    await reset(true); await pressCanvas("start"); await releasePointer();
    await page.locator(svgSq).click(); current = await read();
    check("SVG SQ pointer click triggers the real series protection", current.snapshot.operation.protections.SQ === "triggered" && !current.solver.edgeStates.sq_nc.conductive && !current.solver.motorStates.M.running);
    await page.locator(svgSq).click(); current = await read();
    check("SVG SQ second pointer click resets without automatic restart", current.snapshot.operation.protections.SQ === "normal" && current.solver.edgeStates.sq_nc.conductive && !current.solver.motorStates.M.running);

    await reset(true); await pressCanvas("start"); await releasePointer();
    const svgFrFocusable = await page.locator(svgFr1).evaluate((node) => { node.focus(); return document.activeElement === node; });
    check("SVG FR1 protection is keyboard focusable", svgFrFocusable);
    await page.keyboard.press("Enter"); current = await read();
    check("SVG FR1 Enter key triggers the real series protection", current.snapshot.operation.protections.FR1 === "tripped" && !current.solver.edgeStates.fr1_nc.conductive && !current.solver.motorStates.M.running);
    await page.keyboard.press("Space"); current = await read();
    check("SVG FR1 Space key resets without automatic restart", current.snapshot.operation.protections.FR1 === "normal" && current.solver.edgeStates.fr1_nc.conductive && !current.solver.motorStates.M.running);

    const shellProtectionLabels = await page.evaluate(() => ({
      fr1Trip: document.querySelector("#tripFr")?.textContent?.trim(),
      fr1Reset: document.querySelector("#resetFr")?.textContent?.trim(),
      sqTrip: document.querySelector("#tripFr2")?.textContent?.trim(),
      sqReset: document.querySelector("#resetFr2")?.textContent?.trim(),
      visible: ["tripFr", "resetFr", "tripFr2", "resetFr2"].every((id) => {
        const node = document.getElementById(id);
        return node && !node.classList.contains("hidden") && !node.disabled;
      })
    }));
    check("shell exposes enabled Chinese FR1 and SQ protection controls", shellProtectionLabels.visible && /FR1/.test(shellProtectionLabels.fr1Trip) && /FR1/.test(shellProtectionLabels.fr1Reset) && /SQ/.test(shellProtectionLabels.sqTrip) && /SQ/.test(shellProtectionLabels.sqReset), shellProtectionLabels);
    await reset(true); await pressCanvas("start"); await releasePointer();
    await page.locator("#tripFr").click(); current = await read();
    check("shell FR1 trigger button opens the real NC and stops", current.snapshot.operation.protections.FR1 === "tripped" && !current.solver.edgeStates.fr1_nc.conductive && !current.solver.motorStates.M.running);
    await page.locator("#resetFr").click(); current = await read();
    check("shell FR1 reset button restores only protection", current.snapshot.operation.protections.FR1 === "normal" && current.solver.edgeStates.fr1_nc.conductive && !current.solver.motorStates.M.running);
    await pressCanvas("start"); await releasePointer();
    await page.locator("#tripFr2").click(); current = await read();
    check("shell SQ trigger button opens the real NC and stops", current.snapshot.operation.protections.SQ === "triggered" && !current.solver.edgeStates.sq_nc.conductive && !current.solver.motorStates.M.running);
    await page.locator("#resetFr2").click(); current = await read();
    check("shell SQ reset button restores only protection", current.snapshot.operation.protections.SQ === "normal" && current.solver.edgeStates.sq_nc.conductive && !current.solver.motorStates.M.running);

    await reset(true); await action("JOG_PRESS", { command: "start" }); await action("JOG_RELEASE", { command: "start" });
    await action("PROTECTION_SECONDARY_TOGGLE", { protection: "sq" }); current = await remember("sq-triggered");
    check("SQ trigger opens the real series NC and drops KM/M", current.snapshot.operation.protections.SQ === "triggered" && current.solver.protectionStates.SQ.triggered && !current.solver.edgeStates.sq_nc.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    check("SQ live feedback remains Chinese teaching feedback", current.feedback.source === "Solver" && /[\u3400-\u9fff]/.test(`${current.feedback.title} ${current.feedback.text}`) && /SQ/.test(`${current.feedback.title} ${current.feedback.text}`), current.feedback);
    check("SQ blade physically moves when the limit is reached", openGeometry.sq !== await edgePath("sq_nc"));
    await screenshot("sq"); await visualBinding("SQ triggered"); await componentState("SQ triggered");
    await action("PROTECTION_SECONDARY_RESET", { protection: "sq" }); current = await read();
    check("SQ reset restores only the NC and never auto-restarts", current.snapshot.operation.protections.SQ === "normal" && current.solver.edgeStates.sq_nc.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    await action("JOG_PRESS", { command: "start" }); await action("PROTECTION_SECONDARY_TOGGLE", { protection: "sq" }); current = await read();
    check("SQ trip preserves a physically held SB1 while interrupting the circuit", current.snapshot.operation.controls.sb1 === "pressed" && !current.solver.motorStates.M.running);
    await action("PROTECTION_SECONDARY_RESET", { protection: "sq" }); current = await read();
    check("SQ reset with SB1 still physically held re-establishes the real circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running);
    await action("JOG_RELEASE", { command: "start" }); await action("JOG_PRESS", { command: "stop" }); await action("JOG_RELEASE", { command: "stop" });
    await action("PROTECTION_SECONDARY_TOGGLE", { protection: "sq" }); await action("PROTECTION_RESET", { protection: "sq" }); current = await read();
    check("primary reset action honors an explicit SQ protection payload", current.snapshot.operation.protections.SQ === "normal" && current.snapshot.operation.protections.FR1 === "normal" && current.solver.edgeStates.sq_nc.conductive);

    await action("JOG_PRESS", { command: "start" }); await action("JOG_RELEASE", { command: "start" });
    await action("PROTECTION_TOGGLE", { protection: "fr1" }); current = await remember("fr1-tripped");
    check("FR1 trip opens control NC but leaves thermal main elements conductive", current.snapshot.operation.protections.FR1 === "tripped" && current.solver.protectionStates.FR1.tripped && !current.solver.edgeStates.fr1_nc.conductive && ["a", "b", "c"].every((phase) => current.solver.edgeStates[`fr1_main_${phase}`].conductive) && !current.solver.motorStates.M.running);
    check("FR1 live feedback remains Chinese teaching feedback", current.feedback.source === "Solver" && /[\u3400-\u9fff]/.test(`${current.feedback.title} ${current.feedback.text}`) && /FR1/.test(`${current.feedback.title} ${current.feedback.text}`), current.feedback);
    check("FR1 NC blade physically moves on overload", openGeometry.fr1 !== await edgePath("fr1_nc"));
    await screenshot("fr"); await visualBinding("FR1 tripped"); await componentState("FR1 tripped");
    await action("PROTECTION_RESET", { protection: "fr1" }); current = await read();
    check("FR1 reset restores only protection and never auto-restarts", current.snapshot.operation.protections.FR1 === "normal" && current.solver.edgeStates.fr1_nc.conductive && !current.solver.stableDeviceStates.KM && !current.solver.motorStates.M.running);
    await action("JOG_PRESS", { command: "start" }); await action("PROTECTION_TOGGLE", { protection: "fr1" }); current = await read();
    check("FR1 trip preserves a physically held SB1 while interrupting the circuit", current.snapshot.operation.controls.sb1 === "pressed" && !current.solver.motorStates.M.running);
    await action("PROTECTION_RESET", { protection: "fr1" }); current = await read();
    check("FR1 reset with SB1 still physically held re-establishes the real circuit", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.stableDeviceStates.KM && current.solver.motorStates.M.running);
    await action("JOG_RELEASE", { command: "start" }); await action("JOG_PRESS", { command: "stop" }); await action("JOG_RELEASE", { command: "stop" });

    const chineseControls = await page.locator("#operationControlCard button:visible").allTextContents();
    check("visible controls are Chinese teaching operations", chineseControls.length >= 7 && chineseControls.every((label) => /[\u3400-\u9fff]/.test(label)), chineseControls);
    await screenshot("status");

    await reset(true); await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); current = await read();
    check("Playback ownership setup holds shell SB1", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await replay("restart"); current = await read();
    check("entering Playback releases shell owner into real self-hold", current.playback.mode === "Playback" && current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await page.keyboard.up("Space"); await replay("exit"); current = await read();
    check("Playback exit cannot restore a stale shell press", current.playback.mode === "Live" && current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await action("JOG_PRESS", { command: "stop" }); await action("JOG_RELEASE", { command: "stop" });

    await reset(true); await pressCanvas("start"); current = await read();
    check("Playback ownership setup holds SVG SB1", current.snapshot.operation.controls.sb1 === "pressed" && current.solver.motorStates.M.running);
    await replay("restart"); current = await read();
    check("entering Playback releases SVG owner into real self-hold", current.playback.mode === "Playback" && current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await releasePointer(); await replay("exit"); current = await read();
    check("Playback exit cannot restore a stale SVG press", current.playback.mode === "Live" && current.snapshot.operation.controls.sb1 === "released" && current.solver.motorStates.M.running);
    await action("JOG_PRESS", { command: "stop" }); await action("JOG_RELEASE", { command: "stop" });

    for (const scenario of ["limit_trip", "overload_trip"]) {
      await reset(true); await action("JOG_PRESS", { command: "start" }); await action("JOG_RELEASE", { command: "start" });
      const live = await read();
      await replay("scenario", scenario); await replay("restart"); await replay("toggle");
      let playback = await read();
      const frames = [];
      for (let index = 0; index < playback.playback.count; index += 1) {
        playback = await read();
        const domSource = await page.locator(".ch01-limit-textbook-board").getAttribute("data-state-source");
        const display = playback.playback.displayState;
        frames.push({
          index,
          source: display.source,
          domSource,
          snapshot: display.snapshot,
          solverModuleId: display.solverResult?.moduleId,
          visualModuleId: display.visualState?.moduleId,
          displayConsistent: display.snapshot?.motor?.running === display.solverResult?.motorStates?.M?.running
            && display.visualState?.motorStates?.M?.running === display.solverResult?.motorStates?.M?.running
            && display.snapshot?.devices?.KM?.energized === display.solverResult?.stableDeviceStates?.KM,
          liveUnchanged: JSON.stringify(playback.snapshot) === JSON.stringify(live.snapshot)
        });
        await visualBinding(`Playback ${scenario} frame ${index + 1}`); await componentState(`Playback ${scenario} frame ${index + 1}`);
        if (index + 1 < playback.playback.count) await replay("next");
      }
      check(`Playback ${scenario} uses evaluated raw state on every isolated frame`, frames.length === playback.playback.count && frames.every((frame) => frame.source === "Playback" && frame.domSource === "Playback" && frame.snapshot && frame.solverModuleId === "ch01_limit" && frame.visualModuleId === "ch01_limit" && frame.displayConsistent && frame.liveUnchanged), frames);
      const semanticSequence = frames.map((frame) => ({
        power: frame.snapshot.operation.power,
        sb1: frame.snapshot.operation.controls.sb1,
        fr1: frame.snapshot.operation.protections.FR1,
        sq: frame.snapshot.operation.protections.SQ,
        km: frame.snapshot.devices.KM.energized,
        motor: frame.snapshot.motor.running
      }));
      const semanticsValid = scenario === "limit_trip"
        ? semanticSequence.length === 5
          && semanticSequence[0].power === "closed" && !semanticSequence[0].motor
          && semanticSequence[1].sb1 === "pressed" && semanticSequence[1].motor
          && semanticSequence[2].sb1 === "released" && semanticSequence[2].km && semanticSequence[2].motor
          && semanticSequence[3].sq === "triggered" && !semanticSequence[3].km && !semanticSequence[3].motor
          && semanticSequence[4].sq === "normal" && !semanticSequence[4].km && !semanticSequence[4].motor
        : semanticSequence.length === 3
          && semanticSequence[0].sb1 === "released" && semanticSequence[0].km && semanticSequence[0].motor
          && semanticSequence[1].fr1 === "tripped" && !semanticSequence[1].km && !semanticSequence[1].motor
          && semanticSequence[2].fr1 === "normal" && !semanticSequence[2].km && !semanticSequence[2].motor;
      check(`Playback ${scenario} follows the textbook action sequence`, semanticsValid, semanticSequence);
      if (scenario === "limit_trip") await screenshot("playback");
      await replay("exit"); current = await read();
      check(`Playback ${scenario} exit restores untouched Live self-hold`, current.playback.mode === "Live" && JSON.stringify(current.snapshot) === JSON.stringify(live.snapshot) && current.solver.motorStates.M.running);
    }

    await replay("restart");
    check("cleanup exercise has an active Playback timer", (await read()).diagnostics.loader.currentScope.timeoutCount > 0);
    await page.evaluate(() => platformApi.switchModule("ch01-continuous-control")); await page.waitForTimeout(80);
    const cleanup = await page.evaluate(() => ({ scopes: window.__limitScopes.map((scope) => scope.diagnostics()), nodes: document.querySelectorAll(".ch01-limit-textbook-module").length, classLeft: document.body.classList.contains("ch01-limit-textbook-active") }));
    check("module unmount disposes scope, listeners and board", cleanup.scopes.every((scope) => scope.disposed && !scope.timeoutCount && !scope.intervalCount && !scope.cleanupCount) && !cleanup.nodes && !cleanup.classLeft, cleanup);
    await page.evaluate(() => platformApi.switchModule("ch01-limit-switch-control")); await page.locator(".ch01-limit-textbook-board").waitFor(); current = await read();
    check("module reentry starts neutral and Live", current.snapshot.moduleId === "ch01_limit" && current.snapshot.operation.power === "open" && current.snapshot.operation.controls.sb1 === "released" && current.snapshot.operation.controls.sb2 === "released" && current.snapshot.operation.protections.FR1 === "normal" && current.snapshot.operation.protections.SQ === "normal" && !current.solver.motorStates.M.running && current.playback.mode === "Live");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, board: document.querySelector(".ch01-limit-textbook-board")?.getBoundingClientRect().toJSON(), card: document.querySelector("#operationControlCard")?.getBoundingClientRect().toJSON() }));
    check("390px mobile layout has no horizontal overflow", mobile.document <= mobile.viewport + 1, mobile);
    await screenshot("mobile");
  } catch (error) {
    fatal = error.stack || String(error);
    check("acceptance completes all required stages", false, fatal);
    try { await screenshot("failure"); } catch (_) { /* Keep the original error. */ }
  } finally {
    const result = { passed: !fatal && reports.every((item) => item.pass) && browserErrors.length === 0, checks: reports.length, passedChecks: reports.filter((item) => item.pass).length, reports, browserErrors, screenshots, states };
    fs.writeFileSync(path.join(output, "ch01-limit-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ passed: result.passed, checks: result.checks, failures: reports.filter((item) => !item.pass), browserErrors, screenshots, states: states.length, report: "output/playwright/ch01-limit-validation.json" }, null, 2));
    await browser.close();
    if (!result.passed) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
