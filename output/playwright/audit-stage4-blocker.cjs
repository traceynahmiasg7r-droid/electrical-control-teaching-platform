"use strict";
// Read-only runtime audit. Does not add paths, change active IDs or patch Solver.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const { runActivePathChecks } = require("../../src/chapters/chapter02/modules/ch02_reverse/tests/active-path.acceptance.cjs");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true, args: ["--no-sandbox", "--disable-gpu"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.goto((process.env.ECTP_TEST_URL || "http://127.0.0.1:8765") + "/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const regression = await runActivePathChecks(page);
    const states = await page.evaluate(() => {
      const data = ECTPPlatform.moduleCircuitData.ch02Reverse;
      const action = (type, payload = {}) => platformApi.dispatchAction(type, payload, "stage4-read-only-audit");
      function snapshot(label) {
        const solver = platformApi.getCurrentSolverResult();
        const board = document.querySelector(".ch02-reverse-board");
        const bridgeEvidence = ["l1", "l2", "l3"].map((phase, i) => {
          const id = "mw_" + String(2 + i * 3).padStart(2, "0");
          const raw = calibrationWires.find((wire) => wire.wireId === id);
          const visual = data.wires.find((wire) => wire.wireId === "qf_fu_" + phase);
          const node = board.querySelector("#ch02-reverse-wire-" + visual.wireId);
          return {
            electricalWireId: id, visualWireId: visual.wireId,
            fromPort: raw.fromPort, toPort: raw.toPort,
            solverFromNode: getPortCoordKey(raw.fromPort),
            solverToNode: getPortCoordKey(raw.toPort),
            solverRoutePoints: raw.routePoints,
            visualPoints: visual.points, visualPath: node.getAttribute("d"),
            visualLength: node.getTotalLength(),
            activeMain: solver.activeMainWireIds.includes(id),
            activeControl: solver.activeControlWireIds.includes(id),
            activePhase: solver.extension.activeMainWirePhaseMap[id] || null,
            adjoiningMainEdgesActive: ["qf1_edge_" + phase, "fu1_edge_" + phase].every((id) => solver.extension.activeMainEdgeIds.includes(id)),
            activeHighlightPresent: Boolean(board.querySelector('.ch02-reverse-wire-active[data-wire-id="' + visual.wireId + '"]'))
          };
        });
        return {
          label, operation: platformApi.getCurrentStateSnapshot().operation,
          motor: solver.motorStates.M.state,
          activeMainWireIds: solver.activeMainWireIds,
          activeControlWireIds: solver.activeControlWireIds,
          activeMainEdgeIds: solver.extension.activeMainEdgeIds,
          activeControlEdgeIds: solver.extension.activeControlEdgeIds,
          activeMainWirePhaseMap: solver.extension.activeMainWirePhaseMap,
          normalizedDirectionMapPresent: Boolean(solver.extension.controlFlowDirectionMap),
          legacyDirections: createSolverSnapshot().flowMeta,
          bridgeEvidence,
          flowCount: board.querySelectorAll(".current-flow-path,.ch02-reverse-wire-flow").length,
          flowAnimationCount: board.getAnimations({ subtree: true }).filter((a) => /flow/i.test(a.animationName || "")).length
        };
      }
      platformApi.resetCurrent();
      const records = [snapshot("QF open")];
      action("POWER_CLOSE");
      records.push(snapshot("standby"));
      action("START_FORWARD_PRESS", { phase: "press" });
      records.push(snapshot("SB2 pressed"));
      action("START_FORWARD_PRESS", { phase: "release" });
      records.push(snapshot("forward self-hold"));
      action("START_REVERSE_PRESS", { phase: "press" });
      records.push(snapshot("SB3 reversal pressed"));
      action("START_REVERSE_PRESS", { phase: "release" });
      records.push(snapshot("reverse self-hold"));
      action("STOP_PRESS");
      records.push(snapshot("SB1 stop"));
      action("START_FORWARD_PRESS");
      action("PROTECTION_TOGGLE");
      records.push(snapshot("forward overload"));
      action("PROTECTION_RESET");
      action("START_REVERSE_PRESS");
      action("PROTECTION_TOGGLE");
      records.push(snapshot("reverse overload"));
      action("PROTECTION_RESET");
      records.push(snapshot("FR1 reset"));
      return records;
    });
    const running = states.filter((s) => s.motor !== "stopped");
    assert.equal(running.length, 4);
    for (const state of running) for (const bridge of state.bridgeEvidence) {
      assert.equal(bridge.solverFromNode, bridge.solverToNode);
      assert.equal(bridge.visualLength, 12);
      assert.equal(bridge.activeMain, false);
      assert.equal(bridge.activeControl, false);
      assert.equal(bridge.activeHighlightPresent, false);
      assert.equal(bridge.adjoiningMainEdgesActive, true);
    }
    assert.ok(states.every((s) => s.flowCount === 0 && s.flowAnimationCount === 0));
    assert.deepEqual(browserErrors, []);
    await page.evaluate(() => platformApi.dispatchAction("START_FORWARD_PRESS", {}, "stage4-audit-evidence"));
    await page.locator(".ch02-reverse-board").screenshot({ path: path.join(__dirname, "stage4-blocker-forward-baseline.png") });
    await page.evaluate(() => platformApi.dispatchAction("START_REVERSE_PRESS", {}, "stage4-audit-evidence"));
    await page.locator(".ch02-reverse-board").screenshot({ path: path.join(__dirname, "stage4-blocker-reverse-baseline.png") });
    const cleanup = await page.evaluate(() => {
      platformApi.resetCurrent();
      return {
        flowNodes: document.querySelectorAll(".ch02-reverse-wire-flow").length,
        flowAnimations: document.getAnimations().filter((a) => /ch02ReverseCurrentFlow/.test(a.animationName || "")).length,
        scope: platformApi.getDiagnostics().loader.currentScope
      };
    });
    const report = {
      status: "BLOCKED", blocker: "FLOW_DATA_BLOCKER",
      classification: "visual subdivision versus Solver same-node wire membership; not an electrical topology mismatch",
      proposedChangeApplied: false, solverModified: false,
      regression: {
        activePathPassed: regression.passed, electricalPassed: regression.electrical.passed,
        combinations: regression.electrical.combinations, geometryHash: regression.electrical.geometryHash
      },
      states, cleanup, browserErrors
    };
    fs.writeFileSync(path.join(__dirname, "stage4-blocker-evidence.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, blocker: report.blocker, regression: report.regression, reproducedRunningStates: running.length, cleanup, browserErrors }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
