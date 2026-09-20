"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../..");
const outputDir = path.join(repo, "output/playwright");
const baseUrl = process.env.ECTP_TEST_URL || "http://127.0.0.1:4173";

const formalModules = [
  {
    chapterId: "ch01",
    number: "01",
    label: "点动控制",
    routeId: "ch01-jog-control",
    moduleId: "ch01_jog",
    activeClass: "ch01-jog-textbook-active",
    screenshot: "migration-E-ch01-jog.png"
  },
  {
    chapterId: "ch01",
    number: "02",
    label: "长动控制",
    routeId: "ch01-continuous-control",
    moduleId: "ch01_continuous",
    activeClass: "ch01-continuous-textbook-active",
    screenshot: "migration-F-ch01-continuous.png"
  },
  {
    chapterId: "ch01",
    number: "03",
    label: "行程开关控制",
    routeId: "ch01-limit-switch-control",
    moduleId: "ch01_limit",
    activeClass: "ch01-limit-textbook-active",
    screenshot: "migration-G-ch01-limit.png"
  },
  {
    chapterId: "ch02",
    number: "01",
    label: "主电路与控制电路",
    routeId: "main-control",
    moduleId: "ch02_main_control",
    activeClass: "ch02-main-control-active",
    screenshot: "migration-H-ch02-main-control.png"
  },
  {
    chapterId: "ch02",
    number: "02",
    label: "点动控制",
    routeId: "jog-control",
    moduleId: "ch02_jog",
    activeClass: "ch02-jog-active",
    screenshot: "migration-I-ch02-jog.png"
  },
  {
    chapterId: "ch02",
    number: "03",
    label: "长动控制",
    routeId: "self-lock",
    moduleId: "ch02_continuous",
    activeClass: "ch02-continuous-active",
    screenshot: "migration-J-ch02-continuous.png"
  },
  {
    chapterId: "ch02",
    number: "04",
    label: "正反转控制",
    routeId: "forward-reverse",
    moduleId: "ch02_reverse",
    activeClass: "ch02-reverse-active",
    screenshot: "migration-K-ch02-reverse.png"
  },
  {
    chapterId: "ch02",
    number: "05",
    label: "机床综合线路",
    routeId: "machine-tool-circuits",
    moduleId: "ch02_machine_tool_circuits_v2",
    activeClass: "ch02-machine-tool-v2-active",
    screenshot: "migration-L-ch02-machine-tool.png"
  }
];

const activeLifecycleClasses = formalModules.map((item) => item.activeClass);
const byRoute = new Map(formalModules.map((item) => [item.routeId, item]));

const directUrlCases = [
  ...formalModules.map((item) => ({ kind: "routeId", input: item.routeId, expected: item })),
  ...formalModules.map((item) => ({ kind: "moduleId", input: item.moduleId, expected: item })),
  { kind: "textbookAlias", input: "ch01_jog_textbook", expected: byRoute.get("ch01-jog-control") },
  { kind: "textbookAlias", input: "ch01_continuous_textbook", expected: byRoute.get("ch01-continuous-control") },
  { kind: "textbookAlias", input: "ch01_limit_textbook", expected: byRoute.get("ch01-limit-switch-control") },
  { kind: "machineLegacyAlias", input: "ch02_machine_tool_circuits", expected: byRoute.get("machine-tool-circuits") }
];

const pressureRoutes = [
  "ch01-jog-control",
  "forward-reverse",
  "ch01-limit-switch-control",
  "machine-tool-circuits",
  "main-control",
  "ch01-continuous-control"
];

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const checks = [];
  const moduleResults = [];
  const pressureResults = [];
  const directUrlResults = [];
  const responsiveResults = [];
  const screenshots = [];
  const browserErrors = [];
  const failedRequests = [];
  let phase = "startup";
  let fatal = null;

  const check = (name, passed, evidence = null) => {
    checks.push({ name, passed: Boolean(passed), evidence });
    return Boolean(passed);
  };

  page.on("pageerror", (error) => {
    browserErrors.push({ phase, type: "pageerror", text: error.message });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push({ phase, type: "console.error", text: message.text() });
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({ phase, url: request.url(), error: request.failure()?.errorText || "request failed" });
  });

  async function waitForModule(expected) {
    await page.waitForFunction(({ routeId, moduleId }) => {
      const loader = globalThis.platformApi?.getDiagnostics?.().loader;
      return loader?.currentRouteId === routeId && loader?.currentModuleId === moduleId;
    }, { routeId: expected.routeId, moduleId: expected.moduleId }, { timeout: 15000 });
    await page.waitForFunction((moduleId) => {
      const root = document.querySelector("#chapterModuleCanvas");
      const section = root?.querySelector(":scope > section");
      const svg = section?.querySelector("svg");
      return root?.children.length === 1 && section?.dataset.module === moduleId && Boolean(svg);
    }, expected.moduleId, { timeout: 15000 });
    await page.waitForTimeout(80);
  }

  async function inspectCurrent(expected) {
    return page.evaluate(({ expected, lifecycleClasses }) => {
      const diagnostics = globalThis.platformApi.getDiagnostics();
      const contract = globalThis.platformApi.getCurrentContractReport();
      const snapshot = globalThis.platformApi.getCurrentStateSnapshot();
      const solver = globalThis.platformApi.getCurrentSolverResult();
      const operation = globalThis.platformApi.getCurrentOperationViewModel();
      const status = globalThis.platformApi.getCurrentStatusViewModel();
      const teaching = globalThis.platformApi.getCurrentTeachingFeedback();
      const playback = globalThis.platformApi.getCurrentPlaybackViewModel();
      const root = document.querySelector("#chapterModuleCanvas");
      const sections = [...(root?.querySelectorAll(":scope > section") || [])];
      const activeButtons = [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module);
      const bodyLifecycleClasses = lifecycleClasses.filter((name) => document.body.classList.contains(name));
      const svg = root?.querySelector("svg");
      const visibility = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return {
        loader: diagnostics.loader,
        integrationMode: diagnostics.integrationMode,
        contract,
        apiOutputs: {
          snapshot: Boolean(snapshot),
          solver: Boolean(solver),
          operation: Boolean(operation),
          status: Boolean(status),
          teaching: Boolean(teaching),
          playback: Boolean(playback)
        },
        shell: {
          documentTitle: document.title.trim(),
          stageModuleName: document.querySelector("#stageModuleName")?.textContent.trim() || "",
          stageCode: document.querySelector("#stageModuleCode")?.textContent.trim() || "",
          experimentTitle: document.querySelector("#experimentTitle")?.textContent.trim() || "",
          experimentObjective: document.querySelector("#experimentSubtitle")?.textContent.trim() || "",
          operationVisible: visibility("#operationControlCard"),
          statusVisible: visibility("#statusCard"),
          principleVisible: visibility("#principleCard"),
          playbackVisible: visibility(".footer-playback-panel"),
          playbackControlsPresent: document.querySelectorAll("#playbackControls button").length >= 3
        },
        dom: {
          rootChildren: root?.children.length || 0,
          sectionCount: sections.length,
          moduleIds: sections.map((node) => node.dataset.module),
          svgCount: root?.querySelectorAll("svg").length || 0,
          svgVisible: Boolean(svg && svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().height > 0),
          activeButtons,
          bodyLifecycleClasses
        },
        expected
      };
    }, { expected, lifecycleClasses: activeLifecycleClasses });
  }

  function validateInspection(prefix, expected, observed) {
    const loaderOk = observed.loader.currentRouteId === expected.routeId
      && observed.loader.currentModuleId === expected.moduleId;
    const titleOk = observed.shell.documentTitle.length > 0
      && observed.shell.stageModuleName === expected.label
      && observed.shell.stageCode === expected.number
      && observed.shell.experimentTitle.length > 0
      && observed.shell.experimentObjective.length > 0;
    const areasOk = observed.shell.operationVisible
      && observed.shell.statusVisible
      && observed.shell.principleVisible
      && observed.shell.playbackVisible
      && observed.shell.playbackControlsPresent;
    const outputsOk = Object.values(observed.apiOutputs).every(Boolean)
      && observed.contract?.valid === true;
    const domOk = observed.dom.rootChildren === 1
      && observed.dom.sectionCount === 1
      && observed.dom.svgCount === 1
      && observed.dom.svgVisible
      && same(observed.dom.moduleIds, [expected.moduleId])
      && same(observed.dom.activeButtons, [expected.routeId])
      && same(observed.dom.bodyLifecycleClasses, [expected.activeClass]);
    check(`${prefix}: loader route/moduleId`, loaderOk, observed.loader);
    check(`${prefix}: title, number and experiment objective`, titleOk, observed.shell);
    check(`${prefix}: operation/status/principle/Playback areas`, areasOk, observed.shell);
    check(`${prefix}: Module Contract outputs`, outputsOk, { contract: observed.contract, outputs: observed.apiOutputs });
    check(`${prefix}: one central SVG and one live module DOM`, domOk, observed.dom);
    return loaderOk && titleOk && areasOk && outputsOk && domOk;
  }

  async function clickModule(expected, screenshotName = null) {
    phase = `click:${expected.routeId}`;
    await page.locator(`.module-nav-item[data-module="${expected.routeId}"]`).click();
    await waitForModule(expected);
    const observed = await inspectCurrent(expected);
    const passed = validateInspection(`module ${expected.routeId}`, expected, observed);
    if (screenshotName) {
      await page.screenshot({
        path: path.join(outputDir, screenshotName),
        fullPage: true,
        animations: "disabled"
      });
      screenshots.push(screenshotName);
    }
    return { routeId: expected.routeId, moduleId: expected.moduleId, passed, observed };
  }

  async function readLayout(viewportName) {
    return page.evaluate((name) => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const result = {
        name,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        sidebar: rect(".sidebar"),
        stage: rect(".stage-panel"),
        inspector: rect(".inspector"),
        svg: rect("#chapterModuleCanvas svg")
      };
      const boxes = [result.sidebar, result.stage, result.inspector, result.svg].filter(Boolean);
      result.noHorizontalOverflow = result.scrollWidth <= result.innerWidth + 2;
      result.allBoxesInsideDocument = boxes.every((box) => box.left >= -1 && box.right <= result.scrollWidth + 1 && box.width > 0);
      result.stageAndSidebarSeparated = Boolean(result.sidebar && result.stage && result.sidebar.right <= result.stage.left + 2);
      result.svgInsideStage = Boolean(result.svg && result.stage
        && result.svg.left >= result.stage.left - 2
        && result.svg.right <= result.stage.right + 2);
      result.coherent = result.noHorizontalOverflow
        && result.allBoxesInsideDocument
        && result.stageAndSidebarSeparated
        && result.svgInsideStage;
      return result;
    }, viewportName);
  }

  try {
    phase = "initial-load";
    await page.goto(`${baseUrl}/index.html?module=main-control`, { waitUntil: "networkidle", timeout: 30000 });
    await waitForModule(byRoute.get("main-control"));

    const navigation = await page.evaluate(() => [...document.querySelectorAll(".platform-chapter")].map((chapter) => ({
      chapterId: chapter.dataset.chapterId,
      entries: [...chapter.querySelectorAll(".module-nav-item")].map((button) => ({
        number: button.querySelector(".num")?.textContent.trim(),
        label: button.querySelector(".label")?.textContent.trim(),
        routeId: button.dataset.module
      }))
    })));
    const expectedNavigation = ["ch01", "ch02"].map((chapterId) => ({
      chapterId,
      entries: formalModules.filter((item) => item.chapterId === chapterId).map((item) => ({
        number: item.number,
        label: item.label,
        routeId: item.routeId
      }))
    }));
    check("sidebar has exactly two formal chapters and exact 3+5 entries", same(navigation, expectedNavigation), { navigation, expectedNavigation });
    check("sidebar exposes exactly eight formal module buttons", navigation.reduce((sum, chapter) => sum + chapter.entries.length, 0) === 8, navigation);

    for (const expected of formalModules) {
      moduleResults.push(await clickModule(expected, expected.screenshot));
    }

    phase = "pressure-sequence";
    let previousTransitions = (await page.evaluate(() => platformApi.getDiagnostics().loader.transitionCount));
    for (const routeId of pressureRoutes) {
      const expected = byRoute.get(routeId);
      const result = await clickModule(expected);
      const currentTransitions = result.observed.loader.transitionCount;
      const exactlyOneTransition = currentTransitions === previousTransitions + 1;
      check(`pressure ${routeId}: exactly one loader transition`, exactlyOneTransition, {
        before: previousTransitions,
        after: currentTransitions
      });
      pressureResults.push({
        routeId,
        moduleId: expected.moduleId,
        passed: result.passed && exactlyOneTransition,
        transitionCount: currentTransitions,
        dom: result.observed.dom
      });
      previousTransitions = currentTransitions;
    }

    for (const directCase of directUrlCases) {
      phase = `direct-url:${directCase.kind}:${directCase.input}`;
      const url = `${baseUrl}/index.html?module=${encodeURIComponent(directCase.input)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await waitForModule(directCase.expected);
      const observed = await inspectCurrent(directCase.expected);
      const loaderOk = observed.loader.currentRouteId === directCase.expected.routeId
        && observed.loader.currentModuleId === directCase.expected.moduleId;
      const activeOk = same(observed.dom.activeButtons, [directCase.expected.routeId]);
      const domOk = observed.dom.sectionCount === 1
        && observed.dom.svgCount === 1
        && same(observed.dom.moduleIds, [directCase.expected.moduleId])
        && same(observed.dom.bodyLifecycleClasses, [directCase.expected.activeClass]);
      const passed = loaderOk && activeOk && domOk;
      check(`direct URL ${directCase.kind} ${directCase.input}`, passed, {
        expectedRouteId: directCase.expected.routeId,
        expectedModuleId: directCase.expected.moduleId,
        loader: observed.loader,
        dom: observed.dom
      });
      directUrlResults.push({
        kind: directCase.kind,
        input: directCase.input,
        expectedRouteId: directCase.expected.routeId,
        expectedModuleId: directCase.expected.moduleId,
        passed,
        actualRouteId: observed.loader.currentRouteId,
        actualModuleId: observed.loader.currentModuleId
      });
    }

    phase = "responsive:1366x768";
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?module=main-control`, { waitUntil: "networkidle", timeout: 30000 });
    await waitForModule(byRoute.get("main-control"));
    const wideLayout = await readLayout("1366x768");
    responsiveResults.push(wideLayout);
    check("1366x768 layout has no horizontal misalignment", wideLayout.coherent, wideLayout);
    await page.screenshot({
      path: path.join(outputDir, "migration-M-full-platform.png"),
      fullPage: true,
      animations: "disabled"
    });
    screenshots.push("migration-M-full-platform.png");

    phase = "responsive:1024x768";
    await page.setViewportSize({ width: 1024, height: 768 });
    const narrowLayout = await readLayout("1024x768");
    responsiveResults.push(narrowLayout);
    check("1024x768 narrow layout has no horizontal misalignment", narrowLayout.coherent, narrowLayout);
  } catch (error) {
    fatal = error.stack || String(error);
  } finally {
    check("no browser console or page errors", browserErrors.length === 0, browserErrors);
    check("no failed browser requests", failedRequests.length === 0, failedRequests);
    const passed = checks.filter((entry) => entry.passed).length;
    const result = {
      status: !fatal && passed === checks.length ? "PLATFORM_FORMAL_SMOKE_PASSED" : "PLATFORM_FORMAL_SMOKE_FAILED",
      generatedAt: new Date().toISOString(),
      baseUrl,
      viewportCoverage: ["1366x768", "1024x768"],
      passed,
      total: checks.length,
      fatal,
      browserErrors,
      failedRequests,
      checks,
      navigation: {
        expectedFormalModuleCount: formalModules.length,
        chapters: { ch01: 3, ch02: 5 }
      },
      moduleResults,
      pressureSequence: pressureRoutes,
      pressureResults,
      directUrlResults,
      responsiveResults,
      screenshots
    };
    fs.writeFileSync(path.join(outputDir, "platform-formal-smoke.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({
      status: result.status,
      passed: result.passed,
      total: result.total,
      fatal: result.fatal,
      browserErrors: result.browserErrors,
      failedRequests: result.failedRequests,
      directUrlPassed: result.directUrlResults.filter((entry) => entry.passed).length,
      directUrlTotal: result.directUrlResults.length,
      screenshots: result.screenshots
    }, null, 2));
    await browser.close();
    if (result.status !== "PLATFORM_FORMAL_SMOKE_PASSED") process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
