"use strict";
// PLAYWRIGHT_CORE_PATH points to the CLI's installed playwright-core when it is not a project dependency.
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8765/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const d = ECTPPlatform.moduleCircuitData.ch02Reverse;
      const op = { qf1: "closed", sb1: "released", sb2: "released", sb3: "pressed", fr1: "normal" };
      const forwardWithReversePressed = solveControlCircuit(op, { ki1: true, ki2: false });
      const reverseWithForwardPressed = solveControlCircuit({ ...op, sb2: "pressed", sb3: "released" }, { ki1: false, ki2: true });
      const paths = (result, target) => {
        const adjacency = buildElectricalGraph({ wireFilter: () => true, edgeFilter: (e) => result.edgeStates[e.edgeId]?.conductive && ["supply", "control"].includes(e.domain) });
        return findPathItems(adjacency, getPortCoordKey(CONTROL_SUPPLY_SOURCE_PORT), getPortCoordKey(target));
      };
      const svg = document.querySelector(".ch02-reverse-board");
      const realPorts = new Set(Object.keys(calibrationPortMap));
      const realWires = new Set(calibrationWires.map((w) => w.wireId));
      const realEdges = new Set(deviceEdgeDefs.map((e) => e.edgeId));
      return {
        geometry: d.validateGeometry(), solverTests: solverApi.runTests(), contract: platformApi.getCurrentContractReport(),
        mappings: {
          unknownPorts: d.ports.filter((p) => p.electricalPortId && !realPorts.has(p.electricalPortId)),
          unknownWires: d.wires.flatMap((w) => w.electricalWireIds).filter((id) => !realWires.has(id)),
          unknownEdges: d.components.flatMap((c) => c.electricalEdgeIds).filter((id) => !realEdges.has(id))
        },
        pendingDynamicMapping: {
          forwardWithSB3Pressed: { coils: forwardWithReversePressed.coils, converged: forwardWithReversePressed.converged, path: paths(forwardWithReversePressed, "coil_ki1_l") },
          reverseWithSB2Pressed: { coils: reverseWithForwardPressed.coils, converged: reverseWithForwardPressed.converged, path: paths(reverseWithForwardPressed, "coil_ki2_l") }
        },
        render: {
          svgCount: document.querySelectorAll('#chapterModuleCanvas svg').length,
          wirePathCount: svg.querySelectorAll('.ch02-reverse-wire').length,
          dataWireCount: d.wires.length,
          exactPaths: d.wires.every((w) => svg.querySelector('[data-wire-id="' + w.wireId + '"]').getAttribute("d") === w.points.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ")),
          images: svg.querySelectorAll("image,img,foreignObject").length,
          activeOrFlow: svg.querySelectorAll(".active,.current-flow-path,animate,animateTransform").length,
          animations: svg.getAnimations({ subtree: true }).length,
          transforms: svg.querySelectorAll("[transform]").length,
          legacyVisible: getComputedStyle(document.getElementById("forwardReverseCanvas")).display !== "none"
        }
      };
    });
    assert.equal(report.geometry.valid, true);
    assert.equal(report.contract.valid, true);
    assert.equal(report.solverTests.length, 14);
    assert.ok(report.solverTests.every((t) => t.pass));
    Object.values(report.mappings).forEach((v) => assert.equal(v.length, 0));
    assert.equal(report.render.exactPaths, true);
    assert.equal(report.render.svgCount, 1);
    assert.equal(report.render.dataWireCount, report.render.wirePathCount);
    for (const key of ["images", "activeOrFlow", "animations", "transforms"]) assert.equal(report.render[key], 0);
    assert.equal(report.render.legacyVisible, false);

    // Check mount/unmount and reload through the public module API; do not modify the DOM for screenshots.
    for (const route of ["jog-control", "forward-reverse", "self-lock", "forward-reverse", "main-control", "forward-reverse"]) {
      await page.evaluate((route) => platformApi.switchModule(route), route);
    }
    assert.equal(await page.locator(".ch02-reverse-board").isVisible(), true);
    await page.locator(".ch02-reverse-board").screenshot({ path: path.join(__dirname, "stage1-A-full-circuit.png") });
    async function crop(name, box) {
      const clip = await page.evaluate((box) => {
        const m = document.querySelector(".ch02-reverse-board").getScreenCTM();
        return { x: m.e + m.a * box.x, y: m.f + m.d * box.y, width: m.a * box.width, height: m.d * box.height };
      }, box);
      await page.screenshot({ path: path.join(__dirname, name), clip });
    }
    await crop("stage1-B-main-upper.png", { x: 5, y: 0, width: 380, height: 445 });
    await crop("stage1-C-main-lower.png", { x: 5, y: 290, width: 380, height: 315 });
    await crop("stage1-D-control-circuit.png", { x: 350, y: 100, width: 1084, height: 340 });
    await crop("stage1-E-fr1-return.png", { x: 1220, y: 208, width: 214, height: 232 });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, "stage1-validation.json"), JSON.stringify({ ...report, browserErrors: errors }, null, 2));
    console.log(JSON.stringify({ geometry: report.geometry, solverPassed: report.solverTests.filter((t) => t.pass).length, render: report.render, browserErrors: errors, dynamicAudit: report.pendingDynamicMapping }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
