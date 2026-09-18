"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const { runCurrentFlowChecks } = require("../../src/chapters/chapter02/modules/ch02_reverse/tests/current-flow.acceptance.cjs");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("http://127.0.0.1:8765/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const acceptance = await runCurrentFlowChecks(page);
    const states = {}, pairs = {};
    const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "stage4-capture"), { type, payload });
    const full = [0, 0, 1435, 610], control = [365, 90, 1070, 355], main = [0, 0, 440, 610];
    const sb2 = [595, 110, 365, 160], sb3 = [595, 260, 365, 150], swap = [0, 210, 440, 315], ret = [280, 115, 1155, 330];
    async function capture(name, crop = full) {
      // No animation freezing: these are real successive frames.
      const record = await page.evaluate(() => {
        const raw = platformApi.getCurrentSolverResult();
        const board = document.querySelector(".ch02-reverse-board");
        const visual = ECTPPlatform.bindCh02ReverseVisualState(ECTPPlatform.moduleCircuitData.ch02Reverse, platformApi.getCurrentStateSnapshot(), raw);
        return {
          time: performance.now(), operation: platformApi.getCurrentStateSnapshot().operation,
          motor: raw.motorStates.M.state, raw,
          derived: visual.derivedVisualActiveWireIds,
          flowRefs: [...board.querySelectorAll(".ch02-reverse-flow")].map((n) => n.getAttribute("href")),
          offsets: [...board.querySelectorAll(".ch02-reverse-flow")].map((n) => getComputedStyle(n).strokeDashoffset),
          hitboxStroke: getComputedStyle(board.querySelector('[data-component-id="qf1"] .ch02-reverse-hitbox')).stroke
        };
      });
      const clip = await page.evaluate((crop) => {
        const svg = document.querySelector(".ch02-reverse-board");
        const r = svg.getBoundingClientRect(), scale = r.width / svg.viewBox.baseVal.width;
        return { x: r.x + crop[0] * scale, y: r.y + crop[1] * scale, width: crop[2] * scale, height: crop[3] * scale };
      }, crop);
      const buffer = await page.screenshot({ clip, animations: "allow", path: path.join(__dirname, "stage4-" + name + ".png") });
      record.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      states[name] = record;
    }
    async function pair(letter, crop, label) {
      await capture(letter + "1", crop);
      await page.waitForTimeout(420);
      await capture(letter + "2", crop);
      assert.notEqual(states[letter + "1"].sha256, states[letter + "2"].sha256, letter + " real frames must differ");
      assert.notDeepEqual(states[letter + "1"].offsets, states[letter + "2"].offsets, letter + " dash must move");
      assert.deepEqual(states[letter + "1"].flowRefs, states[letter + "2"].flowRefs, letter + " stable geometry references");
      pairs[letter] = { label, gapMs: states[letter + "2"].time - states[letter + "1"].time, differentPixels: true, sameGeometry: true };
    }
    await page.evaluate(() => platformApi.resetCurrent());
    await action("POWER_CLOSE");
    await action("START_FORWARD_PRESS", { phase: "press" });
    await pair("A", control, "SB2 按下控制回路");
    await capture("K1", sb2);
    await action("START_FORWARD_PRESS", { phase: "release" });
    await capture("K2", sb2);
    await pair("B", control, "KI1 正转自锁控制回路");
    await pair("C", main, "正转三相主回路");
    await action("START_REVERSE_PRESS", { phase: "press" });
    await pair("D", full, "按住 SB3 换向");
    await capture("L1", sb3);
    await action("START_REVERSE_PRESS", { phase: "release" });
    await capture("L2", sb3);
    await pair("E", control, "KI2 反转自锁控制回路");
    await pair("F", main, "反转三相换相主回路");
    await pair("M", swap, "KI1/KI2 换相区域（反转稳定）");
    await pair("N", ret, "FR1 / 节点7 / 完整返回线路");
    await action("STOP_PRESS", { phase: "press" }); await capture("G");
    await action("STOP_PRESS", { phase: "release" });
    await action("START_FORWARD_PRESS"); await action("PROTECTION_TOGGLE"); await capture("H");
    await action("PROTECTION_RESET"); await action("START_REVERSE_PRESS");
    await action("PROTECTION_TOGGLE"); await capture("I");
    await action("PROTECTION_RESET"); await capture("J");
    for (const letter of ["G", "H", "I", "J"]) {
      assert.equal(states[letter].flowRefs.length, 0);
      assert.equal(states[letter].motor, "stopped");
    }
    assert.ok(states.K1.flowRefs.includes("#ch02-reverse-wire-sb2_input") && !states.K2.flowRefs.includes("#ch02-reverse-wire-sb2_input"));
    assert.ok(states.K2.flowRefs.includes("#ch02-reverse-wire-ki1_hold_input"));
    assert.ok(states.L1.flowRefs.includes("#ch02-reverse-wire-sb3_input") && !states.L2.flowRefs.includes("#ch02-reverse-wire-sb3_input"));
    assert.ok(states.L2.flowRefs.includes("#ch02-reverse-wire-ki2_hold_input"));
    assert.deepEqual(errors, []);
    const report = { acceptance, pairs, states, browserErrors: errors };
    fs.writeFileSync(path.join(__dirname, "stage4-validation.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ flowPassed: acceptance.passed, regression: acceptance.regression, cleanup: acceptance.cleanup, screenshotCount: Object.keys(states).length, pairs, browserErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
