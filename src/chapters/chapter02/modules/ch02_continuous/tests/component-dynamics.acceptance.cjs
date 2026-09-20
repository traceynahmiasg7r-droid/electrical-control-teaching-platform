"use strict";

// Component-level visual acceptance for the continuous/self-lock module.
// This deliberately checks geometry state, not only red active-wire styling.
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const reports = [];
  const check = (id, pass, detail = "") => { const item = { id, pass: Boolean(pass), detail: String(detail || "") }; reports.push(item); if (!item.pass) console.error("FAIL", id, detail || ""); return item.pass; };
  const wait = (ms = 70) => page.waitForTimeout(ms);
  const action = (type) => page.evaluate((type) => window.platformApi.dispatchAction(type, {}, "continuous-component-acceptance"), type);
  const playback = (command, value) => page.evaluate(({ command, value }) => window.platformApi.dispatchPlayback(command, value), { command, value });
  const component = (id) => page.evaluate((id) => {
    const node = document.querySelector(`[data-component-id="${id}"]`);
    if (!node) return null;
    return {
      id,
      closed: (node.dataset.closed || "").split(" ").filter(Boolean).map((value) => value === "true"),
      energized: node.dataset.energized === "true",
      pressed: node.dataset.pressed === "true",
      paths: [...node.querySelectorAll(".continuous-conductor")].map((path) => path.getAttribute("d") || "")
    };
  }, id);
  const live = () => page.evaluate(() => ({ snapshot: window.platformApi.getCurrentStateSnapshot(), solver: window.platformApi.getCurrentSolverResult() }));
  const boardShot = (name) => page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
  const componentShot = async (name, id) => {
    const box = await page.locator(`[data-component-id="${id}"]`).boundingBox();
    if (!box) return false;
    const pad = 60;
    const viewport = page.viewportSize();
    const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
    const right = Math.min(viewport.width, box.x + box.width + pad), bottom = Math.min(viewport.height, box.y + box.height + pad);
    await page.screenshot({ path: path.join(output, name + ".png"), clip: { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) } });
    return true;
  };
  const difference = (a, b) => JSON.stringify(a?.paths || []) !== JSON.stringify(b?.paths || []);
  const playbackStep = () => page.evaluate(() => window.platformApi.getCurrentPlaybackViewModel());
  async function advanceTo(id) {
    for (let i = 0; i < 12; i++) {
      const view = await playbackStep();
      if (view?.step?.id === id) return view;
      await playback("next");
      await wait();
    }
    return null;
  }

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await wait(180);
    await page.evaluate(() => window.platformApi.switchModule("self-lock"));
    await wait(220);
    await action("RESET_MODULE");

    const qfOpen = await component("qf1");
    await componentShot("continuous-A-qf1-open-closeup", "qf1");
    check("QF1 open geometry", qfOpen && qfOpen.closed.length === 3 && qfOpen.closed.every((value) => !value));

    await action("POWER_CLOSE");
    const qfClosed = await component("qf1");
    await componentShot("continuous-B-qf1-closed-closeup", "qf1");
    check("QF1 closed geometry", qfClosed && qfClosed.closed.length === 3 && qfClosed.closed.every(Boolean) && difference(qfOpen, qfClosed));

    const kmOpen = await component("km1_main");
    await componentShot("continuous-C-km1-main-open-closeup", "km1_main");
    check("KM1 main open geometry", kmOpen && kmOpen.closed.length === 3 && kmOpen.closed.every((value) => !value));

    await action("START_PRIMARY_PRESS");
    await wait();
    const kmClosed = await component("km1_main");
    await componentShot("continuous-D-km1-main-closed-closeup", "km1_main");
    check("KM1 main closed geometry", kmClosed && kmClosed.closed.length === 3 && kmClosed.closed.every(Boolean) && kmClosed.energized && difference(kmOpen, kmClosed));

    await action("STOP_PRIMARY_PRESS");
    const sb1Released = await component("sb1");
    await componentShot("continuous-E-sb1-released-closeup", "sb1");
    check("SB1 released NO open", sb1Released && sb1Released.closed.length === 1 && !sb1Released.closed[0]);

    await playback("scenario", "continuous-cycle");
    await playback("restart");
    await wait();
    const sb1PressedView = await advanceTo("continuous-cycle-2");
    const sb1Pressed = await component("sb1");
    await componentShot("continuous-F-sb1-pressed-closeup", "sb1");
    check("SB1 pressed NO closed", sb1PressedView && sb1Pressed?.closed[0] === true && sb1Pressed.pressed);

    const selfView = await advanceTo("continuous-cycle-4");
    const selfClosed = await component("km1_self");
    const sb1AfterRelease = await component("sb1");
    await componentShot("continuous-G-sb1-released-self-no-closed-closeup", "km1_self");
    check("self-hold geometry after SB1 release", selfView && sb1AfterRelease?.closed[0] === false && selfClosed?.closed[0] === true);

    await playback("exit");
    await wait();
    const sb2Normal = await component("sb2");
    const fr1Normal = await component("fr1_nc");
    await componentShot("continuous-H-sb2-normal-nc-closed-closeup", "sb2");
    await componentShot("continuous-J-fr1-normal-nc-closed-closeup", "fr1_nc");
    check("SB2 normal NC closed", sb2Normal?.closed[0] === true);
    check("FR1 normal NC closed", fr1Normal?.closed[0] === true);

    await playback("scenario", "continuous-cycle");
    await playback("restart");
    await wait();
    const sb2PressedView = await advanceTo("continuous-cycle-6");
    const sb2Pressed = await component("sb2");
    await componentShot("continuous-I-sb2-pressed-nc-open-closeup", "sb2");
    check("SB2 pressed NC open", sb2PressedView && sb2Pressed?.closed[0] === false && sb2Pressed.pressed);
    await playback("exit");

    await action("START_PRIMARY_PRESS");
    await wait();
    await boardShot("continuous-L-running-full-platform");
    const running = await live();
    check("running platform state", running.snapshot?.motor?.running === true && running.solver?.stableDeviceStates?.KM1 === true);
    await action("PROTECTION_TOGGLE");
    await wait();
    const fr1Tripped = await component("fr1_nc");
    await componentShot("continuous-K-fr1-overload-nc-open-closeup", "fr1_nc");
    check("FR1 overload NC open", fr1Tripped?.closed[0] === false);
    await action("PROTECTION_RESET");
    await action("STOP_PRIMARY_PRESS");
    await wait();
    await boardShot("continuous-M-stopped-full-platform");
    const stopped = await live();
    check("stopped platform state", stopped.snapshot?.motor?.running === false && stopped.solver?.stableDeviceStates?.KM1 === false);

    await playback("scenario", "continuous-cycle");
    await playback("restart");
    await wait();
    await advanceTo("continuous-cycle-4");
    await componentShot("continuous-N-playback-km1-selfhold", "km1_self");
    await boardShot("continuous-N-playback-km1-selfhold-full");
    const playbackSelf = await component("km1_self");
    check("playback self-hold geometry", playbackSelf?.closed[0] === true && (await playbackStep())?.mode === "Playback");
    await playback("exit");

    check("browser errors", errors.length === 0, errors.join(" | "));
    const result = { reports, browserErrors: errors };
    fs.writeFileSync(path.join(output, "continuous-component-dynamics-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: reports.filter((item) => item.pass).length, failed: reports.filter((item) => !item.pass).length, browserErrors: errors.length }, null, 2));
    if (reports.some((item) => !item.pass) || errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
