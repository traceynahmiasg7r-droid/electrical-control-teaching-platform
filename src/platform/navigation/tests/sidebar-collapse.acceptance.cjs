"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../..");
const output = path.join(repo, "output/playwright");
const expected = {
  ch01: [
    { route: "ch01-jog-control", number: "01", label: "点动控制" },
    { route: "ch01-continuous-control", number: "02", label: "长动控制" },
    { route: "ch01-limit-switch-control", number: "03", label: "行程开关控制" }
  ],
  ch02: [
    { route: "main-control", number: "01", label: "主电路与控制电路" },
    { route: "jog-control", number: "02", label: "点动控制" },
    { route: "self-lock", number: "03", label: "长动控制" },
    { route: "forward-reverse", number: "04", label: "正反转控制" },
    { route: "machine-tool-circuits", number: "05", label: "机床综合线路" }
  ]
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const checks = [], browserErrors = [], screenshots = [], states = [];
  let fatal = null;
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const check = (name, passed, evidence = null) => checks.push({ name, passed: Boolean(passed), evidence });
  const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const chapterSelector = (id) => `.platform-chapter[data-chapter-id="${id}"]`;
  const toggle = (id) => page.locator(`${chapterSelector(id)} .platform-chapter-toggle`);
  const countVisible = (id) => page.locator(`${chapterSelector(id)} .module-nav-item:visible`).count();
  const focused = (id) => toggle(id).evaluate((node) => document.activeElement === node);
  const expanded = (id) => toggle(id).getAttribute("aria-expanded");
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true, animations: "disabled" });
    screenshots.push(name);
  };
  const readLive = () => page.evaluate(() => ({
    snapshot: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    loader: platformApi.getDiagnostics().loader,
    flowCount: document.querySelectorAll(".ch02-reverse-flow").length,
    flowAnimations: document.getAnimations().filter((animation) => animation.animationName === "ch02ReverseFlow").length
  }));

  async function settleChapter(id, wantedExpanded) {
    await page.waitForFunction(({ id, wantedExpanded }) => {
      const section = document.querySelector(`.platform-chapter[data-chapter-id="${id}"]`);
      const header = section?.querySelector(".platform-chapter-toggle");
      const list = section?.querySelector(".platform-module-list");
      if (!list || header?.getAttribute("aria-expanded") !== String(wantedExpanded)) return false;
      const style = getComputedStyle(list);
      return wantedExpanded ? style.visibility === "visible" && Number(style.opacity) >= 0.99
        : style.visibility === "hidden" && list.getBoundingClientRect().height <= 1;
    }, { id, wantedExpanded });
  }

  async function clickChapter(id, wantedExpanded) {
    await toggle(id).click();
    await settleChapter(id, wantedExpanded);
    check(`${id} click retains chapter-header focus (${wantedExpanded})`, await focused(id));
  }

  try {
    await page.goto(`${process.env.ECTP_TEST_URL || "http://127.0.0.1:4173"}/index.html?module=ch01-jog-control`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => globalThis.platformApi?.getDiagnostics().loader.currentRouteId === "ch01-jog-control");
    const navigation = await page.evaluate(() => [...document.querySelectorAll(".platform-chapter")].map((section) => ({
      id: section.dataset.chapterId,
      expanded: section.querySelector(".platform-chapter-toggle").getAttribute("aria-expanded"),
      entries: [...section.querySelectorAll(".module-nav-item")].map((button) => ({
        route: button.dataset.module,
        number: button.querySelector(".num").textContent.trim(),
        label: button.querySelector(".label").textContent.trim()
      }))
    })));
    check("formal navigation has only Chapter 1 and Chapter 2", equal(navigation.map((chapter) => chapter.id), ["ch01", "ch02"]), navigation);
    for (const id of ["ch01", "ch02"]) {
      check(`${id} official route, number and teaching-name mapping`, equal(navigation.find((chapter) => chapter.id === id)?.entries, expected[id]));
      check(`${id} expanded by default`, await expanded(id) === "true");
    }
    check("Case A: Chapter 1 has exactly 3 visible target modules", await countVisible("ch01") === 3);
    check("Case C: Chapter 2 has exactly 5 visible target modules", await countVisible("ch02") === 5);

    // Select from another route before folding: this catches stale active-route
    // closures which would restore the initial selection on re-render.
    await page.locator('.module-nav-item[data-module="forward-reverse"]').click();
    await page.waitForFunction(() => platformApi.getDiagnostics().loader.currentRouteId === "forward-reverse");
    await page.locator("#toggleQf").click();
    await page.locator("#pressSb2").click();
    await page.waitForFunction(() => platformApi.getCurrentStateSnapshot().motor.state === "forward");
    const running = await readLive();
    states.push({ name: "before-collapse-running-forward", ...running });
    const originalBoard = await page.locator(".ch02-reverse-board").elementHandle();
    assert(originalBoard, "textbook reverse SVG exists");
    check("reverse motor genuinely runs before sidebar interaction", running.solver.motorStates.M.running && running.flowCount > 0, {
      motor: running.solver.motorStates.M, flowCount: running.flowCount, loader: running.loader
    });
    await screenshot("migration-A-both-expanded.png");

    await clickChapter("ch01", false);
    check("Case B: Chapter 1 collapse hides all 3 entries", await countVisible("ch01") === 0);
    check("Chapter 1 collapse leaves Chapter 2 expanded", await expanded("ch02") === "true" && await countVisible("ch02") === 5);
    await screenshot("migration-B-ch01-collapsed.png");
    await clickChapter("ch01", true);
    await clickChapter("ch02", false);
    check("Case D: Chapter 2 collapse hides all 5 entries", await countVisible("ch02") === 0);
    check("Chapter 2 collapse leaves Chapter 1 expanded", await expanded("ch01") === "true" && await countVisible("ch01") === 3);
    const collapsed = await readLive();
    states.push({ name: "chapter-2-collapsed-running-forward", ...collapsed });
    check("Case E: collapsing Chapter 2 preserves running motor and exact Solver state", equal(collapsed.snapshot, running.snapshot) && equal(collapsed.solver, running.solver));
    check("Case E: collapsing does not remount the active module", equal(collapsed.loader, running.loader) && await originalBoard.evaluate((node) => node.isConnected && node === document.querySelector(".ch02-reverse-board")));
    check("Case E: live current flow remains present", collapsed.flowCount === running.flowCount && collapsed.flowCount > 0
      && collapsed.flowAnimations === running.flowAnimations && collapsed.flowAnimations > 0);
    check("Case E: folding does not start, stop or replace Playback", equal(collapsed.playback, running.playback));
    await screenshot("migration-C-ch02-collapsed.png");

    await clickChapter("ch01", false);
    check("Case G: both chapters can independently remain collapsed", await expanded("ch01") === "false" && await expanded("ch02") === "false"
      && await countVisible("ch01") === 0 && await countVisible("ch02") === 0);
    await screenshot("migration-D-both-collapsed.png");

    await toggle("ch01").focus();
    await page.keyboard.press("Space");
    await settleChapter("ch01", true);
    check("Space expands Chapter 1 and retains focus", await expanded("ch01") === "true" && await focused("ch01"));
    check("keyboard expansion is independent from Chapter 2", await expanded("ch02") === "false" && await countVisible("ch02") === 0);
    await page.keyboard.press("Enter");
    await settleChapter("ch01", false);
    check("Enter collapses Chapter 1 and retains focus", await expanded("ch01") === "false" && await focused("ch01"));
    await page.keyboard.press("Enter");
    await settleChapter("ch01", true);
    check("Enter expands Chapter 1 and retains focus", await expanded("ch01") === "true" && await focused("ch01"));
    await toggle("ch02").focus();
    await page.keyboard.press("Space");
    await settleChapter("ch02", true);
    check("Space expands Chapter 2 and retains focus", await expanded("ch02") === "true" && await focused("ch02"));
    const selected = await page.locator(".module-nav-item.active").evaluateAll((buttons) => buttons.map((button) => button.dataset.module));
    check("Case F: reopen restores the current 04 reverse selection, not the initial route", equal(selected, ["forward-reverse"]), selected);
    check("Case F: reopened reverse entry still shows 04", await page.locator('.module-nav-item[data-module="forward-reverse"] .num').innerText() === "04");
    await page.keyboard.press("Enter");
    await settleChapter("ch02", false);
    check("Enter collapses Chapter 2 and retains focus", await expanded("ch02") === "false" && await focused("ch02"));
    await page.keyboard.press("Enter");
    await settleChapter("ch02", true);
    check("Enter reopens Chapter 2 without disturbing Chapter 1", await expanded("ch02") === "true" && await expanded("ch01") === "true" && await focused("ch02"));
    const final = await readLive();
    states.push({ name: "after-keyboard-reopen-running-forward", ...final });
    check("all pointer and keyboard folds preserve exact live electrical state", equal(final.snapshot, running.snapshot) && equal(final.solver, running.solver));
    check("all folds retain one original active module instance", equal(final.loader, running.loader)
      && await originalBoard.evaluate((node) => node.isConnected && node === document.querySelector(".ch02-reverse-board")));
    await originalBoard.dispose();
  } catch (error) {
    fatal = error.stack || String(error);
  } finally {
    check("browser console and page errors", browserErrors.length === 0, browserErrors);
    const passed = checks.filter((entry) => entry.passed).length;
    const result = {
      status: !fatal && passed === checks.length ? "SIDEBAR_COLLAPSE_SELF_CHECK_PASSED" : "SIDEBAR_COLLAPSE_SELF_CHECK_FAILED",
      generatedAt: new Date().toISOString(),
      passed, total: checks.length, browserErrors, fatal, checks, screenshots, states
    };
    fs.writeFileSync(path.join(output, "sidebar-collapse-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ...result, checks: undefined, states: undefined }, null, 2));
    await browser.close();
    if (result.status !== "SIDEBAR_COLLAPSE_SELF_CHECK_PASSED") process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
