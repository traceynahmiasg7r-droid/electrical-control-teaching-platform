"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../../../..");
const output = path.resolve(repo, "output/playwright");
const url = (process.env.ECTP_TEST_URL || "http://127.0.0.1:4173") + "/index.html";

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const reports = [];
  const check = (id, pass, detail = "") => { reports.push({ id, pass: Boolean(pass), detail }); assert.ok(pass, id + (detail ? ": " + detail : "")); };
  const state = () => page.evaluate(() => ({
    snapshot: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    diagnostics: platformApi.getDiagnostics(),
    board: (() => { const node = document.querySelector(".ch02-main-control-board"); return node ? { wires: node.querySelectorAll(".ch02-main-control-wire").length, components: node.querySelectorAll(".ch02-main-control-component").length, labels: node.querySelectorAll("text").length, active: node.querySelectorAll(".ch02-main-control-wire-active").length, flow: node.querySelectorAll(".ch02-main-control-flow").length } : null; })()
  }));
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "main-control-acceptance"), { type, payload });
  const reset = async () => { await action("RESET_MODULE"); await page.waitForTimeout(40); };
  const shot = async (name, clip) => { await page.screenshot({ path: path.join(output, name + ".png"), ...(clip ? { clip } : { fullPage: true }) }); };

  const initial = await state();
  const contract = await page.evaluate(() => platformApi.getCurrentContractReport());
  const solverTests = await page.evaluate(() => runLegacyModuleTests("main-control"));
  check("geometry contract", contract.valid);
  check("solver regression", solverTests.length >= 17 && solverTests.every((test) => test.pass));
  check("static SVG mounted", initial.board && initial.board.wires === 46 && initial.board.components === 19 && initial.board.labels === 18);
  check("right return bus has one shared visual geometry", await page.evaluate(() => {
    const ids = [...document.querySelectorAll(".ch02-main-control-board .ch02-main-control-wire")].map((node) => node.dataset.wireId);
    return ids.includes("cw_04_supply") && ids.includes("cw_04_return") && !ids.includes("cw_04") && !ids.includes("cw_18");
  }));
  check("textbook source and button mechanics", await page.evaluate(() => {
    const sources = [...document.querySelectorAll(".ch02-main-control-board .source-terminal")];
    const sb2Rod = document.querySelector("[data-component-id='sb2'] .button-actuator")?.getAttribute("d");
    const sb4Rod = document.querySelector("[data-component-id='sb4'] .button-actuator")?.getAttribute("d");
    return sources.length === 3
      && sources.every((node) => node.getAttribute("rx") === "18" && node.getAttribute("ry") === "18")
      && sb2Rod === "M 1014.5 432 V 464"
      && sb4Rod === "M 1014.5 660 V 692";
  }));
  check("textbook motor and FR geometry", await page.evaluate(() => {
    const d = (id) => document.getElementById("ch02-main-control-wire-" + id)?.getAttribute("d") || "";
    const motor1 = document.querySelector(".ch02-main-control-board [data-component-id='motor1'] .motor-shell");
    const motor2 = document.querySelector(".ch02-main-control-board [data-component-id='motor2'] .motor-shell");
    return d("mw_18") === "M155 819 L155 881 L188 902"
      && d("mw_19") === "M228 819 L228 887"
      && d("mw_20") === "M302 819 L302 881 L268 902"
      && d("mw_24") === "M457 819 L457 881 L490 902"
      && d("mw_25") === "M530 819 L530 887"
      && d("mw_26") === "M603 819 L603 881 L570 902"
      && motor1?.getAttribute("cx") === "228" && motor1?.getAttribute("cy") === "947"
      && motor2?.getAttribute("cx") === "530" && motor2?.getAttribute("cy") === "947";
  }));
  check("textbook self-hold remains below start", await page.evaluate(() => {
    const d = (id) => document.getElementById("ch02-main-control-wire-" + id)?.getAttribute("d") || "";
    return d("cw_11") === "M809 469 L809 526 L860 526"
      && d("cw_12") === "M908 526 L956 526 L956 469"
      && d("cw_19") === "M809 697 L809 754 L860 754"
      && d("cw_20") === "M908 754 L956 754 L956 697";
  }));
  check("conductive ids unique", await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-conductive-geometry='true']")].map((node) => node.id);
    return ids.length === new Set(ids).size && ids.every(Boolean);
  }));
  check("initial stopped", initial.snapshot.motor.channels.M1.state === "stopped" && initial.snapshot.motor.channels.M2.state === "stopped");
  check("NO/NC released states", initial.solver.edgeStates.edge_sb1_no.conductive === false && initial.solver.edgeStates.edge_sb2_nc.conductive === true && initial.solver.edgeStates.edge_sb3_no.conductive === false && initial.solver.edgeStates.edge_sb4_nc.conductive === true);
  await shot("main-control-A-static");

  await action("POWER_CLOSE");
  let current = await state();
  check("QF1 close", current.snapshot.operation.power === "closed" && current.snapshot.motor.running === false);
  await shot("main-control-B-qf1-closed");

  await page.evaluate(() => {
    const target = document.querySelector("[data-component-id='sb1']");
    if (!target) throw new Error("SB1 canvas target missing");
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  });
  current = await state();
  check("canvas SB1 maps to start", current.snapshot.devices.primaryContactor.energized && current.snapshot.motor.channels.M1.running);
  await reset();
  await action("POWER_CLOSE");

  await action("START_PRIMARY_PRESS", { phase: "press" });
  current = await state();
  check("SB1 pressed starts 1M", current.snapshot.operation.controls.startPrimary === "pressed" && current.snapshot.devices.primaryContactor.energized && current.snapshot.motor.channels.M1.running);
  check("SB1 NO active", current.solver.edgeStates.edge_sb1_no.conductive === true && current.board.active > 0);
  check("flow reuses conductive geometry", await page.evaluate(() => [...document.querySelectorAll(".ch02-main-control-flow")].every((node) => {
    const target = document.getElementById(node.getAttribute("href").slice(1));
    return target && (target.dataset.conductiveGeometry === "true" || target.dataset.wireId);
  })));
  await shot("main-control-C-sb1-pressed");

  await action("START_PRIMARY_PRESS", { phase: "release" });
  current = await state();
  check("KM1 self-hold", current.snapshot.operation.controls.startPrimary === "released" && current.snapshot.devices.primaryContactor.energized && current.snapshot.motor.channels.M1.running);
  check("active wires use base geometry", await page.evaluate(() => [...document.querySelectorAll(".ch02-main-control-wire-active")].every((node) => document.getElementById(node.getAttribute("href").slice(1)) && node.dataset.wireId)));
  await shot("main-control-D-km1-self-hold");

  await action("STOP_PRIMARY_PRESS", { phase: "press" });
  current = await state();
  check("SB2 stop", !current.snapshot.devices.primaryContactor.energized && !current.snapshot.motor.channels.M1.running && current.solver.edgeStates.edge_sb2_nc.conductive === false);
  await shot("main-control-E-sb2-stop");

  await action("START_SECONDARY_PRESS", { phase: "press" });
  current = await state();
  check("SB3 pressed starts 2M", current.snapshot.operation.controls.startSecondary === "pressed" && current.snapshot.devices.secondaryContactor.energized && current.snapshot.motor.channels.M2.running);
  await shot("main-control-F-sb3-pressed");
  await action("START_SECONDARY_PRESS", { phase: "release" });
  current = await state();
  check("KM2 self-hold", current.snapshot.operation.controls.startSecondary === "released" && current.snapshot.devices.secondaryContactor.energized && current.snapshot.motor.channels.M2.running);
  await shot("main-control-G-km2-self-hold");

  await action("PROTECTION_SECONDARY_TOGGLE");
  current = await state();
  check("FR2 overload releases KM2", current.snapshot.operation.protections.secondary === "overload" && !current.snapshot.devices.secondaryContactor.energized && !current.snapshot.motor.channels.M2.running);
  await shot("main-control-H-fr2-overload");
  await action("PROTECTION_SECONDARY_RESET");
  current = await state();
  check("FR2 reset no restart", current.snapshot.operation.protections.secondary === "normal" && !current.snapshot.devices.secondaryContactor.energized);
  await shot("main-control-I-fr2-reset");

  await reset();
  await action("POWER_CLOSE");
  await action("START_PRIMARY_PRESS");
  await action("PROTECTION_TOGGLE");
  current = await state();
  check("FR1 overload releases KM1", current.snapshot.operation.protections.primary === "overload" && !current.snapshot.devices.primaryContactor.energized && !current.snapshot.motor.channels.M1.running);
  await shot("main-control-J-fr1-overload");
  await action("PROTECTION_RESET");
  current = await state();
  check("FR1 reset no restart", current.snapshot.operation.protections.primary === "normal" && !current.snapshot.devices.primaryContactor.energized);
  await shot("main-control-K-fr1-reset");

  await reset();
  await page.evaluate(() => platformApi.dispatchPlayback("scenario", "motor1-start"));
  await page.evaluate(() => platformApi.dispatchPlayback("restart"));
  await page.waitForTimeout(80);
  current = await state();
  check("playback active", current.playback.mode === "Playback" && current.playback.step && current.playback.step.displayState);
  check("teaching focus present", await page.evaluate(() => document.querySelectorAll(".is-teaching-focus").length > 0));
  await shot("main-control-L-playback");
  await page.evaluate(() => platformApi.dispatchPlayback("exit"));
  check("playback exits to live", (await state()).playback.mode === "Live");

  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => { const board = document.querySelector(".ch02-main-control-board").getBoundingClientRect(); return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, board: { width: board.width, height: board.height, right: board.right, bottom: board.bottom } }; });
    const boardIsReadable = width >= 1450
      ? layout.board.bottom <= height
      : layout.board.width >= 800 && layout.board.height >= 580;
    check("responsive " + width, layout.scrollWidth <= width && layout.board.width > 0 && layout.board.height > 0 && layout.board.right <= width && boardIsReadable);
    if (width === 1366) await shot("main-control-M-1366x768");
  }

  await page.evaluate(() => platformApi.switchModule("forward-reverse"));
  await page.waitForTimeout(150);
  check("reverse regression mounted", await page.evaluate(() => Boolean(document.querySelector(".ch02-reverse-board")) && document.body.classList.contains("ch02-reverse-active")));
  await shot("main-control-reverse-regression");
  await page.evaluate(() => platformApi.switchModule("main-control"));
  await page.waitForTimeout(150);
  check("main-control reentry cleanup", await page.evaluate(() => Boolean(document.querySelector(".ch02-main-control-board")) && document.querySelectorAll(".ch02-reverse-flow,.ch02-main-control-flow").length === 0));
  await reset();
  const finalDiagnostics = await page.evaluate(() => platformApi.getDiagnostics().loader.currentScope);
  check("browser errors", browserErrors.length === 0, browserErrors.join(" | "));
  check("runtime timers clean", finalDiagnostics.timeoutCount === 0 && finalDiagnostics.intervalCount === 0);
  fs.writeFileSync(path.join(output, "main-control-validation.json"), JSON.stringify({ reports, browserErrors, finalDiagnostics }, null, 2));
  console.log(JSON.stringify({ passed: reports.length, browserErrors, finalDiagnostics, screenshots: 14 }, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
