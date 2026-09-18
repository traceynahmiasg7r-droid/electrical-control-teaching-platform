"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const { runActivePathChecks } = require("../../src/chapters/chapter02/modules/ch02_reverse/tests/active-path.acceptance.cjs");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8765/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const activePath = await runActivePathChecks(page);
    await page.evaluate(() => platformApi.resetCurrent());
    const data = await page.evaluate(() => ECTPPlatform.moduleCircuitData.ch02Reverse);
    const states = {};

    async function action(type, payload = {}) {
      await page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "stage3-capture"), { type, payload });
    }

    async function capture(name, crop = [0, 0, 1435, 610]) {
      const actual = await page.evaluate(() => {
        const solver = platformApi.getCurrentSolverResult();
        const snapshot = platformApi.getCurrentStateSnapshot();
        const board = document.querySelector(".ch02-reverse-board");
        const overlays = [...board.querySelectorAll(".ch02-reverse-wire-active")];
        const activeComponents = [...board.querySelectorAll(".is-active-edge")].map((item) => item.dataset.componentId);
        return {
          operation: snapshot.operation,
          motor: solver.motorStates.M.state,
          coils: solver.stableDeviceStates,
          activeMainWireIds: solver.activeMainWireIds,
          activeControlWireIds: solver.activeControlWireIds,
          activeMainEdgeIds: solver.extension.activeMainEdgeIds,
          activeControlEdgeIds: solver.extension.activeControlEdgeIds,
          overlayWireIds: overlays.map((item) => item.dataset.wireId),
          activeComponents,
          overlayCount: overlays.length,
          browserSvgCount: document.querySelectorAll("#chapterModuleCanvas svg").length
        };
      });
      const clip = await page.evaluate((crop) => {
        const board = document.querySelector(".ch02-reverse-board");
        const rect = board.getBoundingClientRect();
        const scale = rect.width / 1435;
        return { x: rect.left + crop[0] * scale, y: rect.top + crop[1] * scale, width: crop[2] * scale, height: crop[3] * scale };
      }, crop);
      await page.screenshot({ path: path.join(__dirname, name + ".png"), clip });
      states[name] = actual;
      return actual;
    }

    await capture("stage3-A-qf1-open");
    await action("POWER_CLOSE");
    await capture("stage3-B-qf1-closed-standby");
    await action("START_FORWARD_PRESS", { phase: "press" });
    await capture("stage3-C-sb2-pressed");
    await action("START_FORWARD_PRESS", { phase: "release" });
    await capture("stage3-D-forward-self-hold");
    await capture("stage3-E-forward-stable-main-closeup", [0, 250, 480, 300]);
    await capture("stage3-F-forward-stable-control-closeup", [350, 90, 1085, 340]);
    await action("START_REVERSE_PRESS", { phase: "press" });
    await capture("stage3-G-sb3-pressed");
    await action("START_REVERSE_PRESS", { phase: "release" });
    await capture("stage3-H-reverse-self-hold");
    await capture("stage3-I-reverse-stable-main-closeup", [0, 250, 480, 300]);
    await capture("stage3-J-reverse-stable-control-closeup", [350, 90, 1085, 340]);
    await action("STOP_PRESS", { phase: "pulse" });
    await capture("stage3-K-sb1-stop");
    await action("START_FORWARD_PRESS", { phase: "pulse" });
    await action("PROTECTION_TOGGLE");
    await capture("stage3-L-forward-fr1-overload");
    await action("PROTECTION_RESET");
    await action("START_REVERSE_PRESS", { phase: "pulse" });
    await action("PROTECTION_TOGGLE");
    await capture("stage3-M-reverse-fr1-overload");
    await action("PROTECTION_RESET");
    await capture("stage3-N-fr1-reset");
    await action("START_FORWARD_PRESS", { phase: "pulse" });
    await capture("stage3-O-ki1-ki2-phase-change-area", [0, 170, 480, 330]);
    await capture("stage3-P-sb2-sb3-interlock-area", [580, 95, 740, 330]);
    await capture("stage3-Q-fr1-node7-return-path", [1160, 180, 275, 275]);

    assert.deepEqual(errors, [], "Browser errors");
    assert.equal(states["stage3-A-qf1-open"].overlayCount, 0);
    assert.equal(states["stage3-B-qf1-closed-standby"].overlayCount, 0);
    assert.equal(states["stage3-D-forward-self-hold"].motor, "forward");
    assert.equal(states["stage3-H-reverse-self-hold"].motor, "reverse");
    assert.equal(states["stage3-K-sb1-stop"].overlayCount, 0);
    assert.equal(states["stage3-L-forward-fr1-overload"].overlayCount, 0);
    assert.equal(states["stage3-M-reverse-fr1-overload"].overlayCount, 0);
    assert.equal(states["stage3-N-fr1-reset"].overlayCount, 0);
    const result = { activePath: { passed: activePath.passed, electricalPassed: activePath.electrical.passed }, states, browserErrors: errors };
    fs.writeFileSync(path.join(__dirname, "stage3-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ activePath: result.activePath, stateCount: Object.keys(states).length, browserErrors: errors, screenshots: Object.keys(states).map((name) => name + ".png") }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
