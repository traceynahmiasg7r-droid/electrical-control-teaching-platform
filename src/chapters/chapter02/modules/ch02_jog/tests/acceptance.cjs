"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../../../..");
const output = path.resolve(repo, "output/playwright");
const url = (process.env.ECTP_TEST_URL || "http://127.0.0.1:4173") + "/index.html";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const reports = [];
  const check = (id, pass, detail = "") => {
    const item = { id, pass: Boolean(pass), detail: String(detail || "") };
    reports.push(item);
    if (!item.pass) console.error("FAIL", id, detail || "");
    return item.pass;
  };
  const wait = (ms = 50) => page.waitForTimeout(ms);
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "jog-acceptance"), { type, payload });
  const playback = (command, value) => page.evaluate(({ command, value }) => platformApi.dispatchPlayback(command, value), { command, value });
  const state = () => page.evaluate(() => ({
    snapshot: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    diagnostics: platformApi.getDiagnostics(),
    contract: platformApi.getCurrentContractReport(),
    board: (() => {
      const svg = document.querySelector(".ch02-jog-board");
      if (!svg) return null;
      return {
        viewBox: svg.getAttribute("viewBox"),
        wires: svg.querySelectorAll(".ch02-jog-wire").length,
        active: svg.querySelectorAll(".ch02-jog-wire-active").length,
        flow: svg.querySelectorAll(".ch02-jog-flow").length,
        defs: svg.querySelectorAll("defs > path").length,
        components: svg.querySelectorAll("[data-component-id]").length,
        junctions: svg.querySelectorAll(".ch02-jog-junction").length,
        labels: svg.querySelectorAll("text").length,
        source: svg.dataset.stateSource || ""
      };
    })()
  }));
  const reset = async () => { await action("RESET_MODULE"); await wait(60); };
  const shot = async (name) => page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });

  await page.evaluate(() => platformApi.switchModule("jog-control"));
  await wait(180);
  let current = await state();
  check("new jog board mounted", Boolean(current.board));
  check("geometry contract", current.contract?.valid === true);
  check("geometry counts", current.board && current.board.wires === 26 && current.board.defs === 26 && current.board.components === 10 && current.board.junctions === 2);
  const geometryReport = await page.evaluate(() => {
    const ids = [
      ...Array.from({ length: 15 }, (_, index) => `jmw_${String(index + 1).padStart(2, "0")}`),
      ...Array.from({ length: 9 }, (_, index) => `jcw_${String(index + 1).padStart(2, "0")}`),
      "jmw_08_supply", "jmw_08_load", "jmw_09_supply", "jmw_09_load"
    ];
    return window.ECTPPlatform.moduleCircuitData.createJogCircuitData({ wires: ids.map((wireId) => ({ wireId })) }).validateGeometry();
  });
  check("geometry report includes crossing", geometryReport.valid === true && geometryReport.wires === 26 && geometryReport.components === 10 && geometryReport.junctions === 2 && geometryReport.crossings === 1, JSON.stringify(geometryReport));
  check("textbook viewBox excludes lower prose", current.board?.viewBox === "35 245 1245 850");
  const legacyTests = await page.evaluate(() => runLegacyModuleTests("jog-control"));
  check("legacy Solver regression", Array.isArray(legacyTests) && legacyTests.length >= 12 && legacyTests.every((item) => item.pass), JSON.stringify(legacyTests));
  check("initial stopped", current.snapshot.motor.running === false && current.snapshot.devices.primaryContactor.energized === false);
  check("released SB NO and FR NC", current.solver.edgeStates?.jog_sb_no?.conductive === false && current.solver.edgeStates?.jog_fr_nc?.conductive === true);
  check("no self-hold edge", !Object.keys(current.solver.edgeStates || {}).some((id) => /self|hold|aux/i.test(id)));
  check("base and flow use defs geometry", await page.evaluate(() => {
    const svg = document.querySelector(".ch02-jog-board");
    const hrefs = [...svg.querySelectorAll(".ch02-jog-wire, .ch02-jog-wire-active, .ch02-jog-flow")].map((node) => node.getAttribute("href"));
    return hrefs.length > 0 && hrefs.every((href) => href && svg.querySelector(href.replace(/^#/, "#"))?.tagName.toLowerCase() === "path");
  }));
  check("motor wire endpoints meet motor circle", await page.evaluate(() => {
    const svg = document.querySelector(".ch02-jog-board");
    const motor = svg.querySelector("[data-component-id='motor'] .jog-motor-shell");
    if (!motor) return false;
    const cx = Number(motor.getAttribute("cx")), cy = Number(motor.getAttribute("cy")), r = Number(motor.getAttribute("r"));
    const expected = new Set(["jog_svg_main_a_fr_motor", "jog_svg_main_b_fr_motor", "jog_svg_main_c_fr_motor"]);
    return [...svg.querySelectorAll("defs > path")].filter((node) => expected.has(node.id.replace("ch02-jog-geometry-", ""))).every((node) => {
      const points = (node.getAttribute("d").match(/[-]?\d+(?:\.\d+)?/g) || []).map(Number);
      const x = points.at(-2), y = points.at(-1);
      return Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.01;
    });
  }));
  await shot("jog-A-static");

  await action("POWER_CLOSE");
  await wait();
  current = await state();
  check("QF closed standby", current.snapshot.operation.power === "closed" && !current.snapshot.motor.running);
  check("QF edges closed", ["jog_qf_a", "jog_qf_b", "jog_qf_c"].every((id) => current.solver.edgeStates?.[id]?.conductive === true));
  await shot("jog-B-qf-closed");

  await action("JOG_PRESS", { phase: "press" });
  await wait();
  current = await state();
  check("SB held starts KM and motor", current.snapshot.operation.controls.jog === "pressed" && current.snapshot.devices.primaryContactor.energized && current.snapshot.motor.running);
  check("SB NO closes", current.solver.edgeStates?.jog_sb_no?.conductive === true);
  check("KM main edges close", ["jog_km_main_a", "jog_km_main_b", "jog_km_main_c"].every((id) => current.solver.edgeStates?.[id]?.conductive === true));
  check("Solver state equals SVG active state", await page.evaluate((solver) => {
    const svg = document.querySelector(".ch02-jog-board");
    const active = [...svg.querySelectorAll(".ch02-jog-wire-active")].map((n) => n.dataset.wireId).filter(Boolean);
    const flowing = [...svg.querySelectorAll(".ch02-jog-flow")].map((n) => n.dataset.flowWireId).filter(Boolean);
    return active.length > 0 && active.length === flowing.length && active.every((id) => flowing.includes(id)) && (solver.activeMainWireIds.length + solver.activeControlWireIds.length) > 0;
  }, current.solver));
  check("flow excludes mechanical outlines", await page.evaluate(() => [...document.querySelectorAll(".ch02-jog-flow")].every((node) => {
    const target = document.getElementById((node.getAttribute("href") || "").slice(1));
    return target?.parentElement?.tagName.toLowerCase() === "defs";
  })));
  await shot("jog-C-sb-held");

  await action("JOG_RELEASE", { phase: "release" });
  await wait();
  current = await state();
  check("SB release immediately stops", current.snapshot.operation.controls.jog === "released" && !current.snapshot.devices.primaryContactor.energized && !current.snapshot.motor.running);
  check("released SB NO opens", current.solver.edgeStates?.jog_sb_no?.conductive === false);
  check("no active current flow after release", current.board?.flow === 0 && current.board?.active === 0);
  await shot("jog-D-sb-released");

  await action("JOG_PRESS", { phase: "press" });
  await wait();
  check("second held cycle starts", (await state()).snapshot.motor.running === true);
  await action("PROTECTION_TOGGLE");
  await wait();
  current = await state();
  check("FR overload drops KM", current.snapshot.operation.protections.overload === "overload" && !current.snapshot.devices.primaryContactor.energized && !current.snapshot.motor.running && current.solver.edgeStates?.jog_fr_nc?.conductive === false);
  await shot("jog-E-fr-overload");
  await action("JOG_RELEASE", { phase: "release" });
  await action("PROTECTION_RESET");
  await wait();
  current = await state();
  check("FR reset no auto restart", current.snapshot.operation.protections.overload === "normal" && !current.snapshot.devices.primaryContactor.energized && !current.snapshot.motor.running);
  await shot("jog-F-fr-reset");

  await action("POWER_OPEN");
  await action("JOG_PRESS", { phase: "press" });
  await wait();
  current = await state();
  check("FR reset/QF open still blocks start", !current.snapshot.motor.running && current.solver.edgeStates?.jog_sb_no?.conductive === true);
  await action("JOG_RELEASE", { phase: "release" });

  await reset();
  await action("POWER_CLOSE");
  const sb = page.locator(".ch02-jog-board [data-component-id='sb']");
  await sb.dispatchEvent("pointerdown", { bubbles: true, pointerId: 7, buttons: 1 });
  await wait();
  current = await state();
  check("real pointerdown holds SB", current.snapshot.operation.controls.jog === "pressed" && current.snapshot.motor.running);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 })));
  await wait();
  check("pointercancel releases SB", (await state()).snapshot.operation.controls.jog === "released");
  await sb.dispatchEvent("pointerdown", { bubbles: true, pointerId: 8, buttons: 1 });
  await wait();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await wait();
  check("window blur releases SB", (await state()).snapshot.operation.controls.jog === "released");
  await sb.focus();
  await page.keyboard.down(" ");
  await wait();
  check("keyboard holds SB", (await state()).snapshot.operation.controls.jog === "pressed");
  await page.keyboard.up(" ");
  await wait();
  const keyboardReleased = await state();
  check("keyboard release stops SB", keyboardReleased.snapshot.operation.controls.jog === "released" && !keyboardReleased.snapshot.motor.running, JSON.stringify(keyboardReleased.snapshot));
  await shot("jog-G-pointer-keyboard");

  await reset();
  const beforePlayback = await state();
  await playback("scenario", "jog-cycle");
  await playback("restart");
  await wait(100);
  current = await state();
  check("playback active", current.playback?.mode === "Playback" && current.playback?.step?.displayState);
  check("playback does not mutate live Solver", JSON.stringify(current.snapshot) === JSON.stringify(beforePlayback.snapshot));
  check("playback teaching focus rendered", await page.evaluate(() => document.querySelectorAll(".ch02-jog-component.is-teaching-focus").length > 0));
  await shot("jog-H-playback");
  await playback("exit");
  await wait();
  check("playback exits live", (await state()).playback?.mode === "Live");

  await page.evaluate(() => platformApi.switchModule("forward-reverse"));
  await wait(180);
  check("reverse navigation mount", await page.evaluate(() => Boolean(document.querySelector(".ch02-reverse-board"))));
  await page.evaluate(() => platformApi.switchModule("main-control"));
  await wait(180);
  check("main-control navigation mount", await page.evaluate(() => Boolean(document.querySelector(".ch02-main-control-board"))));
  await page.evaluate(() => platformApi.switchModule("jog-control"));
  await wait(180);
  check("jog reentry cleanup", await page.evaluate(() => {
    const board = document.querySelector(".ch02-jog-board");
    return Boolean(board) && document.querySelectorAll(".ch02-reverse-board,.ch02-main-control-board").length === 0;
  }));
  check("jog reentry static count", (await state()).board?.wires === 26);

  for (const [width, height] of [[1366, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await wait(50);
    const layout = await page.evaluate(() => {
      const board = document.querySelector(".ch02-jog-board")?.getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, board: board ? { width: board.width, height: board.height, right: board.right, bottom: board.bottom } : null };
    });
    check("responsive " + width, layout.board && layout.board.width > 0 && layout.board.height > 0 && layout.scrollWidth <= Math.max(width, 760), JSON.stringify(layout));
    if (width === 1366) await shot("jog-I-1366");
    if (width === 390) await shot("jog-J-mobile");
  }

  await reset();
  const diagnostics = await page.evaluate(() => platformApi.getDiagnostics());
  check("browser errors", browserErrors.length === 0, browserErrors.join(" | "));
  check("runtime timers clean", diagnostics.loader?.currentScope?.timeoutCount === 0 && diagnostics.loader?.currentScope?.intervalCount === 0, JSON.stringify(diagnostics.loader?.currentScope));
  fs.writeFileSync(path.join(output, "jog-validation.json"), JSON.stringify({ reports, browserErrors, diagnostics }, null, 2));
  console.log(JSON.stringify({ passed: reports.filter((item) => item.pass).length, failed: reports.filter((item) => !item.pass).length, browserErrors, screenshots: 10 }, null, 2));
  await browser.close();
  if (reports.some((item) => !item.pass) || browserErrors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
