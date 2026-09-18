"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const { runElectricalChecks } = require("../../src/chapters/chapter02/modules/ch02_reverse/tests/electrical.acceptance.cjs");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8765/index.html?module=forward-reverse", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const electrical = await runElectricalChecks(page);

    async function reset() {
      await page.evaluate(() => platformApi.resetCurrent());
    }
    async function action(type, payload = {}) {
      await page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "stage2-capture"), { type, payload });
    }
    async function capture(name, expected) {
      const actual = await page.evaluate(() => {
        const snapshot = platformApi.getCurrentStateSnapshot();
        const solver = platformApi.getCurrentSolverResult();
        const board = document.querySelector(".ch02-reverse-board");
        const data = ECTPPlatform.moduleCircuitData.ch02Reverse;
        const components = Object.fromEntries(data.components.map((component) => {
          const dom = board.querySelector('[data-component-id="' + component.componentId + '"]');
          return [component.componentId, {
            closed: dom?.dataset.closed || "",
            energized: dom?.dataset.energized === "true",
            pressed: dom?.classList.contains("is-pressed") || false
          }];
        }));
        return {
          operation: snapshot.operation,
          coils: solver.stableDeviceStates,
          motor: solver.motorStates.M.state,
          components,
          render: {
            svgCount: document.querySelectorAll("#chapterModuleCanvas svg").length,
            wireCount: board.querySelectorAll(".ch02-reverse-wire").length,
            exactPaths: data.wires.every((wire) => board.querySelector('[data-wire-id="' + wire.wireId + '"]').getAttribute("d") === wire.points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ")),
            images: board.querySelectorAll("image,img,foreignObject").length,
            currentFlow: board.querySelectorAll(".active,.current-flow-path,animate,animateTransform").length,
            transforms: board.querySelectorAll("[transform]").length
          }
        };
      });
      assert.deepEqual(actual.coils, expected.coils, name + " coils");
      assert.equal(actual.motor, expected.motor, name + " motor");
      if (expected.pressed) assert.equal(actual.components[expected.pressed].pressed, true, name + " button press");
      assert.deepEqual(actual.render, { svgCount: 1, wireCount: 59, exactPaths: true, images: 0, currentFlow: 0, transforms: 0 }, name + " render");
      await page.locator(".ch02-reverse-board").screenshot({ path: path.join(__dirname, name + ".png") });
      return actual;
    }

    const states = {};
    await reset();
    states.A = await capture("stage2-A-qf-open-stopped", { coils: { KM1: false, KM2: false }, motor: "stopped" });
    await action("POWER_CLOSE");
    states.B = await capture("stage2-B-qf-closed-standby", { coils: { KM1: false, KM2: false }, motor: "stopped" });
    await action("START_FORWARD_PRESS", { phase: "press" });
    states.C = await capture("stage2-C-sb2-pressed", { coils: { KM1: true, KM2: false }, motor: "forward", pressed: "sb2" });
    await action("START_FORWARD_PRESS", { phase: "release" });
    states.D = await capture("stage2-D-forward-self-hold", { coils: { KM1: true, KM2: false }, motor: "forward" });
    await action("START_REVERSE_PRESS", { phase: "press" });
    states.E = await capture("stage2-E-forward-sb3-pressed", { coils: { KM1: false, KM2: true }, motor: "reverse", pressed: "sb3" });

    await reset();
    await action("POWER_CLOSE");
    await action("START_REVERSE_PRESS", { phase: "press" });
    states.F = await capture("stage2-F-sb3-normal-start", { coils: { KM1: false, KM2: true }, motor: "reverse", pressed: "sb3" });
    await action("START_REVERSE_PRESS", { phase: "release" });
    states.G = await capture("stage2-G-reverse-self-hold", { coils: { KM1: false, KM2: true }, motor: "reverse" });
    await action("START_FORWARD_PRESS", { phase: "press" });
    states.H = await capture("stage2-H-reverse-sb2-pressed", { coils: { KM1: true, KM2: false }, motor: "forward", pressed: "sb2" });
    await action("START_FORWARD_PRESS", { phase: "release" });
    await action("STOP_PRESS", { phase: "pulse" });
    states.I = await capture("stage2-I-sb1-stopped", { coils: { KM1: false, KM2: false }, motor: "stopped" });

    await action("START_FORWARD_PRESS", { phase: "press" });
    await action("START_FORWARD_PRESS", { phase: "release" });
    await action("PROTECTION_TOGGLE");
    states.J = await capture("stage2-J-forward-fr1-overload", { coils: { KM1: false, KM2: false }, motor: "stopped" });

    await action("PROTECTION_RESET");
    await action("START_REVERSE_PRESS", { phase: "press" });
    await action("START_REVERSE_PRESS", { phase: "release" });
    await action("PROTECTION_TOGGLE");
    states.K = await capture("stage2-K-reverse-fr1-overload", { coils: { KM1: false, KM2: false }, motor: "stopped" });
    await action("PROTECTION_RESET");
    states.L = await capture("stage2-L-fr1-reset", { coils: { KM1: false, KM2: false }, motor: "stopped" });

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, "stage2-validation.json"), JSON.stringify({ electrical, states, browserErrors: errors }, null, 2));
    console.log(JSON.stringify({ electrical: { passed: electrical.passed, combinations: electrical.combinations, geometryHash: electrical.geometryHash }, stateCount: Object.keys(states).length, browserErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
