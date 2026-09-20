"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../..");
const output = path.join(repo, "output/playwright");
const baseUrl = (process.env.ECTP_TEST_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const modules = [
  {
    chapterId: "ch01", number: "01", label: "点动控制",
    routeId: "ch01-jog-control", moduleId: "ch01_jog",
    title: "点动控制演示", purposeNeedle: "按住启动按钮",
    sourceToken: "ch01_jog_textbook", bodyClass: "ch01-jog-textbook-active",
    screenshot: "migration-E-ch01-jog.png"
  },
  {
    chapterId: "ch01", number: "02", label: "长动控制",
    routeId: "ch01-continuous-control", moduleId: "ch01_continuous",
    title: "长动控制演示", purposeNeedle: "辅助常开触点自锁",
    sourceToken: "ch01_continuous_textbook", bodyClass: "ch01-continuous-textbook-active",
    screenshot: "migration-F-continuous.png"
  },
  {
    chapterId: "ch01", number: "03", label: "行程开关控制",
    routeId: "ch01-limit-switch-control", moduleId: "ch01_limit",
    title: "行程开关控制电路演示", purposeNeedle: "行程开关 SQ",
    sourceToken: "ch01_limit_textbook", bodyClass: "ch01-limit-textbook-active",
    screenshot: "migration-G-limit.png"
  },
  {
    chapterId: "ch02", number: "01", label: "主电路与控制电路",
    routeId: "main-control", moduleId: "ch02_main_control",
    title: "主电路与控制电路演示", purposeNeedle: "两套控制回路",
    sourceToken: "ch02_main_control", bodyClass: "ch02-main-control-active",
    screenshot: "migration-H-ch02-main.png"
  },
  {
    chapterId: "ch02", number: "02", label: "点动控制",
    routeId: "jog-control", moduleId: "ch02_jog",
    title: "点动控制演示", purposeNeedle: "按钮松开",
    sourceToken: "ch02_jog", bodyClass: "ch02-jog-active",
    screenshot: "migration-I-ch02-jog.png"
  },
  {
    chapterId: "ch02", number: "03", label: "长动控制",
    routeId: "self-lock", moduleId: "ch02_continuous",
    title: "长动控制（连续控制）演示", purposeNeedle: "辅助常开自锁触点",
    sourceToken: "ch02_continuous", bodyClass: "ch02-continuous-active",
    screenshot: "migration-J-ch02-continuous.png"
  },
  {
    chapterId: "ch02", number: "04", label: "正反转控制",
    routeId: "forward-reverse", moduleId: "ch02_reverse",
    title: "三相异步电动机正反转控制演示", purposeNeedle: "改变电动机两相相序",
    sourceToken: "ch02_reverse", bodyClass: "ch02-reverse-active",
    screenshot: "migration-K-ch02-reverse.png"
  },
  {
    chapterId: "ch02", number: "05", label: "机床综合线路",
    routeId: "machine-tool-circuits", moduleId: "ch02_machine_tool_circuits_v2",
    title: "机床综合线路演示", purposeNeedle: "Z3040",
    sourceToken: "ch02_machine_tool_circuits_v2", bodyClass: "ch02-machine-tool-v2-active",
    screenshot: "migration-L-ch02-machine.png"
  }
];

const byRoute = new Map(modules.map((item) => [item.routeId, item]));
const activeBodyClasses = modules.map((item) => item.bodyClass);
const stressRoutes = [
  "ch01-jog-control",
  "forward-reverse",
  "ch01-limit-switch-control",
  "machine-tool-circuits",
  "main-control",
  "ch01-continuous-control"
];
const directEntries = [
  ...modules.map((item) => ({ kind: "routeId", query: item.routeId, expected: item })),
  ...modules.map((item) => ({ kind: "moduleId", query: item.moduleId, expected: item })),
  { kind: "legacy-alias", query: "ch02_machine_tool_circuits", expected: byRoute.get("machine-tool-circuits") }
];

const checks = [];
const browserErrors = [];
const gallery = [];
const directRoutes = [];
const stress = { sequence: stressRoutes, transitions: [], stalePlayback: null };
const collapseCombinations = [];
const responsive = [];
let fatal = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function check(section, name, passed, evidence = null) {
  const entry = { section, name, passed: Boolean(passed) };
  if (evidence !== null && evidence !== undefined) entry.evidence = clone(evidence);
  checks.push(entry);
  return entry.passed;
}

function attachErrorCapture(page, source) {
  const local = [];
  const record = (kind, message, details = {}) => {
    const item = { source, kind, message: String(message), ...details };
    local.push(item);
    browserErrors.push(item);
  };
  page.on("pageerror", (error) => record("pageerror", error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    record("console", message.text(), { location: message.location() });
  });
  return local;
}

async function settleChapter(page, chapterId, expanded) {
  await page.waitForFunction(({ chapterId, expanded }) => {
    const section = document.querySelector('.platform-chapter[data-chapter-id="' + chapterId + '"]');
    const header = section && section.querySelector(".platform-chapter-toggle");
    const list = section && section.querySelector(".platform-module-list");
    if (!header || !list) return false;
    const style = getComputedStyle(list);
    const rect = list.getBoundingClientRect();
    const expectedCollapsed = String(!expanded);
    return header.getAttribute("aria-expanded") === String(expanded)
      && list.dataset.collapsed === expectedCollapsed
      && list.getAttribute("aria-hidden") === expectedCollapsed
      && list.inert === !expanded
      && (expanded
        ? style.visibility === "visible" && Number(style.opacity) > 0.99 && rect.height > 20
        : style.visibility === "hidden" && Number(style.opacity) < 0.01 && rect.height < 1);
  }, { chapterId, expanded });
}

async function setChapterExpanded(page, chapterId, expanded) {
  const toggle = page.locator('.platform-chapter[data-chapter-id="' + chapterId + '"] .platform-chapter-toggle');
  const current = await toggle.getAttribute("aria-expanded");
  if (current !== String(expanded)) await toggle.click();
  await settleChapter(page, chapterId, expanded);
}

async function clickRoute(page, module) {
  await setChapterExpanded(page, module.chapterId, true);
  await page.locator('.module-nav-item[data-module="' + module.routeId + '"]').click();
  await page.waitForFunction(({ routeId, moduleId }) => {
    const loader = globalThis.platformApi && platformApi.getDiagnostics().loader;
    const node = document.querySelector("#chapterModuleCanvas > [data-module]");
    return loader && loader.currentRouteId === routeId && loader.currentModuleId === moduleId
      && node && node.dataset.module === moduleId;
  }, { routeId: module.routeId, moduleId: module.moduleId });
}

async function collectModuleEvidence(page) {
  return page.evaluate((knownClasses) => {
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0
        && rect.width > 0 && rect.height > 0;
    };
    const diagnostics = platformApi.getDiagnostics();
    const state = platformApi.getCurrentStateSnapshot();
    const solver = platformApi.getCurrentSolverResult();
    const operation = platformApi.getCurrentOperationViewModel();
    const status = platformApi.getCurrentStatusViewModel();
    const feedback = platformApi.getCurrentTeachingFeedback();
    const playback = platformApi.getCurrentPlaybackViewModel();
    const contract = platformApi.getCurrentContractReport();
    const moduleNodes = [...document.querySelectorAll("#chapterModuleCanvas [data-module]")];
    const directModuleNodes = [...document.querySelectorAll("#chapterModuleCanvas > [data-module]")];
    const svgs = [...document.querySelectorAll("#chapterModuleCanvas svg")].filter(visible);
    const svg = svgs[0] || null;
    const svgRect = svg && svg.getBoundingClientRect();
    const operationButtons = [...document.querySelectorAll("#operationControlCard button")].filter(visible);
    const statusRows = [...document.querySelectorAll("#statusCard .status-row")].filter(visible);
    const activeButtons = [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module);
    return {
      diagnostics,
      state,
      solver,
      operation,
      status,
      feedback,
      playback,
      contract,
      navigationState: platformApi.getNavigationState(),
      formalNavigation: platformApi.getFormalNavigation(),
      shell: {
        moduleName: document.getElementById("stageModuleName").textContent.trim(),
        code: document.getElementById("stageModuleCode").textContent.trim(),
        experimentTitle: document.getElementById("experimentTitle").textContent.trim(),
        experimentPurpose: document.getElementById("experimentSubtitle").textContent.trim(),
        principleTitle: document.getElementById("teachTitle").textContent.trim(),
        principleText: document.getElementById("teachText").textContent.trim(),
        playbackText: document.getElementById("currentStepText").textContent.trim(),
        playbackButtonsEnabled: ["showPrinciplePlayback", "playbackToggle", "playbackNext"]
          .every((id) => !document.getElementById(id).disabled),
        operationButtons: operationButtons.map((button) => ({
          id: button.id || null,
          text: button.textContent.replace(/\s+/g, " ").trim(),
          disabled: button.disabled
        })),
        statusRows: statusRows.map((row) => row.textContent.replace(/\s+/g, " ").trim()),
        activeButtons,
        activeBodyClasses: knownClasses.filter((name) => document.body.classList.contains(name)),
        moduleNodeIds: moduleNodes.map((node) => node.dataset.module),
        directModuleNodeIds: directModuleNodes.map((node) => node.dataset.module),
        visibleSvgCount: svgs.length,
        svg: svg ? {
          ariaLabel: svg.getAttribute("aria-label") || "",
          role: svg.getAttribute("role") || "",
          width: svgRect.width,
          height: svgRect.height
        } : null,
        placeholderVisible: visible(document.getElementById("placeholderCanvas")),
        legacyCanvasVisible: visible(document.getElementById("forwardReverseCanvas"))
      }
    };
  }, activeBodyClasses);
}

async function inspectModule(page, module, section, withPlayback = true) {
  const evidence = await collectModuleEvidence(page);
  const loader = evidence.diagnostics.loader;
  check(section, module.routeId + " loader resolves exact new module", loader.currentRouteId === module.routeId
    && loader.currentModuleId === module.moduleId, loader);
  check(section, module.routeId + " contract is valid facade-v1", evidence.contract && evidence.contract.valid
    && (!evidence.contract.errors || evidence.contract.errors.length === 0)
    && evidence.diagnostics.integrationMode === "facade-v1", {
      contract: evidence.contract,
      integrationMode: evidence.diagnostics.integrationMode
    });
  check(section, module.routeId + " state/solver/view-model identities agree", evidence.state
    && evidence.state.moduleId === module.moduleId && evidence.state.routeId === module.routeId
    && evidence.solver && evidence.solver.moduleId === module.moduleId
    && evidence.operation && evidence.operation.moduleId === module.moduleId
    && evidence.status && evidence.status.moduleId === module.moduleId, {
      state: evidence.state && { moduleId: evidence.state.moduleId, routeId: evidence.state.routeId },
      solverModuleId: evidence.solver && evidence.solver.moduleId,
      operationModuleId: evidence.operation && evidence.operation.moduleId,
      statusModuleId: evidence.status && evidence.status.moduleId
    });
  check(section, module.routeId + " page title and display number", evidence.shell.moduleName === module.label
    && evidence.shell.code === module.number && evidence.shell.experimentTitle === module.title, evidence.shell);
  check(section, module.routeId + " experiment purpose is populated and specific", evidence.shell.experimentPurpose.length >= 20
    && evidence.shell.experimentPurpose.includes(module.purposeNeedle), evidence.shell.experimentPurpose);
  check(section, module.routeId + " central SVG is the sole visible current canvas", evidence.shell.visibleSvgCount === 1
    && evidence.shell.svg && evidence.shell.svg.width > 300 && evidence.shell.svg.height > 200
    && evidence.shell.svg.ariaLabel.length > 0, evidence.shell.svg);
  check(section, module.routeId + " DOM contains only the current module", same(evidence.shell.moduleNodeIds, [module.moduleId])
    && same(evidence.shell.directModuleNodeIds, [module.moduleId])
    && same(evidence.shell.activeBodyClasses, [module.bodyClass])
    && !evidence.shell.placeholderVisible && !evidence.shell.legacyCanvasVisible, {
      moduleNodeIds: evidence.shell.moduleNodeIds,
      directModuleNodeIds: evidence.shell.directModuleNodeIds,
      activeBodyClasses: evidence.shell.activeBodyClasses,
      placeholderVisible: evidence.shell.placeholderVisible,
      legacyCanvasVisible: evidence.shell.legacyCanvasVisible
    });
  check(section, module.routeId + " has real operation controls", Array.isArray(evidence.operation.controls)
    && evidence.operation.controls.some((item) => item.visible !== false)
    && evidence.shell.operationButtons.length >= 2
    && evidence.shell.operationButtons.some((button) => !button.disabled)
    && evidence.shell.operationButtons.every((button) => button.text.length > 0), {
      operationViewModel: evidence.operation,
      buttons: evidence.shell.operationButtons
    });
  check(section, module.routeId + " current status is rendered", Array.isArray(evidence.status.rows)
    && evidence.status.rows.length >= 3 && evidence.shell.statusRows.length >= 3
    && evidence.shell.statusRows.every(Boolean), {
      statusViewModel: evidence.status,
      rows: evidence.shell.statusRows
    });
  check(section, module.routeId + " action principle/teaching feedback is rendered", evidence.feedback
    && String(evidence.feedback.title || "").length > 0 && String(evidence.feedback.text || "").length > 15
    && evidence.shell.principleText.length > 15, {
      feedback: evidence.feedback,
      title: evidence.shell.principleTitle,
      text: evidence.shell.principleText
    });
  check(section, module.routeId + " playback is wired to current module", evidence.playback
    && Array.isArray(evidence.playback.scenarios) && evidence.playback.scenarios.length > 0
    && evidence.playback.displayState && evidence.playback.displayState.snapshot.moduleId === module.moduleId
    && evidence.shell.playbackButtonsEnabled && evidence.shell.playbackText.length > 0, {
      mode: evidence.playback && evidence.playback.mode,
      scenarios: evidence.playback && evidence.playback.scenarios,
      displayModuleId: evidence.playback && evidence.playback.displayState
        && evidence.playback.displayState.snapshot.moduleId,
      playbackText: evidence.shell.playbackText
    });
  check(section, module.routeId + " exactly one sidebar entry is active", same(evidence.shell.activeButtons, [module.routeId]),
    evidence.shell.activeButtons);

  if (withPlayback) {
    const liveBefore = await page.evaluate(() => ({
      state: platformApi.getCurrentStateSnapshot(),
      solver: platformApi.getCurrentSolverResult()
    }));
    await page.evaluate(() => platformApi.dispatchPlayback("next"));
    await page.waitForFunction((moduleId) => {
      const view = platformApi.getCurrentPlaybackViewModel();
      return view && view.mode === "Playback" && view.index === 0
        && view.displayState.snapshot.moduleId === moduleId;
    }, module.moduleId);
    const playbackStep = await page.evaluate(() => {
      const view = platformApi.getCurrentPlaybackViewModel();
      return {
        mode: view.mode,
        index: view.index,
        count: view.count,
        stepTitle: view.step && view.step.title,
        currentStepText: document.getElementById("currentStepText").textContent.trim(),
        displayModuleId: view.displayState.snapshot.moduleId
      };
    });
    check(section, module.routeId + " playback advances through the real UI model", playbackStep.mode === "Playback"
      && playbackStep.index === 0 && playbackStep.count > 0 && playbackStep.stepTitle
      && playbackStep.currentStepText.includes("Playback"), playbackStep);
    await page.evaluate(() => platformApi.dispatchPlayback("exit"));
    await page.waitForFunction(() => platformApi.getCurrentPlaybackViewModel().mode === "Live");
    const liveAfter = await page.evaluate(() => ({
      state: platformApi.getCurrentStateSnapshot(),
      solver: platformApi.getCurrentSolverResult(),
      timers: platformApi.getDiagnostics().loader.currentScope.timeoutCount
    }));
    check(section, module.routeId + " exiting playback restores untouched Live state", same(liveAfter.state, liveBefore.state)
      && same(liveAfter.solver, liveBefore.solver) && liveAfter.timers === 0, {
      before: liveBefore,
      after: liveAfter
    });
  }

  return evidence;
}

async function validateFormalNavigation(page) {
  const evidence = await page.evaluate(() => ({
    api: platformApi.getFormalNavigation(),
    state: platformApi.getNavigationState(),
    chapters: [...document.querySelectorAll(".platform-chapter")].map((section) => ({
      chapterId: section.dataset.chapterId,
      title: section.querySelector(".platform-chapter-copy strong").textContent.trim(),
      subtitle: section.querySelector(".platform-chapter-copy span").textContent.trim(),
      entries: [...section.querySelectorAll(".module-nav-item")].map((button) => ({
        routeId: button.dataset.module,
        number: button.querySelector(".num").textContent.trim(),
        label: button.querySelector(".label").textContent.trim()
      }))
    }))
  }));
  const expectedApi = modules.map((item) => ({
    chapterId: item.chapterId,
    routeId: item.routeId,
    expectedModuleId: item.moduleId,
    displayIndex: item.number,
    label: item.label
  }));
  const expectedChapters = ["ch01", "ch02"].map((chapterId) => ({
    chapterId,
    title: chapterId === "ch01" ? "第一章" : "第二章",
    subtitle: chapterId === "ch01" ? "常用低压电器" : "电器控制系统",
    entries: modules.filter((item) => item.chapterId === chapterId).map((item) => ({
      routeId: item.routeId, number: item.number, label: item.label
    }))
  }));
  check("navigation", "formal navigation API exposes exactly the 8 approved new modules", same(evidence.api, expectedApi), {
    actual: evidence.api,
    expected: expectedApi
  });
  check("navigation", "sidebar has only Chapter 1 (3) and Chapter 2 (5), with exact numbers/names",
    same(evidence.chapters, expectedChapters), { actual: evidence.chapters, expected: expectedChapters });
  check("navigation", "both formal chapters are expanded by default", evidence.state
    && evidence.state.chapter01Collapsed === false && evidence.state.chapter02Collapsed === false, evidence.state);
}

async function installScopeAudit(page) {
  await page.evaluate(() => {
    const originalRuntime = ECTPPlatform.runtime;
    const scopes = [];
    globalThis.__migrationScopeAudit = { originalRuntime, scopes };
    ECTPPlatform.runtime = Object.freeze({
      ...originalRuntime,
      createRuntimeScope(moduleId) {
        const scope = originalRuntime.createRuntimeScope(moduleId);
        scopes.push(scope);
        return scope;
      }
    });
    globalThis.__migrationDetachedNodes = [];
  });
}

async function currentScopeIndex(page) {
  return page.evaluate(() => __migrationScopeAudit.scopes.length - 1);
}

async function scopeEvidence(page, index) {
  return page.evaluate((scopeIndex) => {
    const scope = __migrationScopeAudit.scopes[scopeIndex];
    if (!scope) return null;
    return { ...scope.diagnostics(), signalAborted: scope.signal.aborted };
  }, index);
}

async function captureCurrentNode(page) {
  return page.evaluate(() => {
    const node = document.querySelector("#chapterModuleCanvas > [data-module]");
    __migrationDetachedNodes.push(node);
    return __migrationDetachedNodes.length - 1;
  });
}

async function detachedNodeEvidence(page, index) {
  return page.evaluate((nodeIndex) => {
    const node = __migrationDetachedNodes[nodeIndex];
    let animations = [];
    try { animations = node ? node.getAnimations({ subtree: true }) : []; } catch (_) { animations = []; }
    return {
      exists: Boolean(node),
      connected: Boolean(node && node.isConnected),
      moduleId: node && node.dataset.module,
      runningAnimations: animations.filter((animation) => animation.playState === "running").length
    };
  }, index);
}

async function listenerEvidence(page, token) {
  return page.evaluate((sourceToken) => globalThis.__migrationListenerAudit.summary(sourceToken), token);
}

async function runStress(page) {
  await setChapterExpanded(page, "ch01", true);
  await setChapterExpanded(page, "ch02", true);
  await clickRoute(page, byRoute.get(stressRoutes[0]));

  for (let index = 0; index < stressRoutes.length - 1; index += 1) {
    const from = byRoute.get(stressRoutes[index]);
    const to = byRoute.get(stressRoutes[index + 1]);
    const scopeIndex = await currentScopeIndex(page);
    const nodeIndex = await captureCurrentNode(page);
    await page.evaluate(() => platformApi.dispatchPlayback("restart"));
    await page.waitForFunction(() => {
      const view = platformApi.getCurrentPlaybackViewModel();
      return view && view.mode === "Playback" && view.running
        && platformApi.getDiagnostics().loader.currentScope.timeoutCount > 0;
    });
    const before = await page.evaluate(() => ({
      loader: platformApi.getDiagnostics().loader,
      playback: platformApi.getCurrentPlaybackViewModel(),
      listener: __migrationListenerAudit.summary(
        document.querySelector("#chapterModuleCanvas > [data-module]").dataset.module
      )
    }));
    await clickRoute(page, to);
    const oldScope = await scopeEvidence(page, scopeIndex);
    const oldNode = await detachedNodeEvidence(page, nodeIndex);
    const oldListeners = await listenerEvidence(page, from.sourceToken);
    const current = await collectModuleEvidence(page);
    const transition = {
      from: from.routeId,
      to: to.routeId,
      playbackWasRunning: before.playback.running,
      oldScope,
      oldNode,
      oldListeners,
      currentLoader: current.diagnostics.loader,
      currentPlayback: {
        mode: current.playback.mode,
        index: current.playback.index,
        running: current.playback.running,
        displayModuleId: current.playback.displayState.snapshot.moduleId
      },
      currentModuleNodeIds: current.shell.moduleNodeIds,
      activeBodyClasses: current.shell.activeBodyClasses
    };
    stress.transitions.push(transition);
    check("stress", from.routeId + " -> " + to.routeId + " disposes old scope/timers/cleanups",
      oldScope && oldScope.disposed && oldScope.signalAborted && oldScope.timeoutCount === 0
      && oldScope.intervalCount === 0 && oldScope.cleanupCount === 0, oldScope);
    check("stress", from.routeId + " -> " + to.routeId + " removes old DOM and animations",
      oldNode && oldNode.exists && !oldNode.connected && oldNode.runningAnimations === 0, oldNode);
    check("stress", from.routeId + " -> " + to.routeId + " leaves no active old module listeners",
      oldListeners.activeCount === 0 && oldListeners.duplicateCount === 0, oldListeners);
    check("stress", from.routeId + " -> " + to.routeId + " starts clean Live playback",
      transition.currentPlayback.mode === "Live" && transition.currentPlayback.index === -1
      && !transition.currentPlayback.running && transition.currentPlayback.displayModuleId === to.moduleId,
      transition.currentPlayback);
    check("stress", from.routeId + " -> " + to.routeId + " has one new module DOM and body scope",
      same(transition.currentModuleNodeIds, [to.moduleId])
      && same(transition.activeBodyClasses, [to.bodyClass]), {
        moduleNodeIds: transition.currentModuleNodeIds,
        activeBodyClasses: transition.activeBodyClasses
      });
  }

  const beforeWait = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel()
  }));
  await page.waitForTimeout(1900);
  const afterWait = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    disposedScopes: __migrationScopeAudit.scopes.slice(0, -1).map((scope) => ({
      ...scope.diagnostics(), signalAborted: scope.signal.aborted
    }))
  }));
  stress.stalePlayback = { beforeWait, afterWait };
  check("stress", "old playback callbacks cannot mutate the final stress module after their duration",
    same(beforeWait, {
      loader: afterWait.loader,
      state: afterWait.state,
      solver: afterWait.solver,
      playback: afterWait.playback
    }), stress.stalePlayback);
  check("stress", "all stress-history scopes are disposed with zero resources",
    afterWait.disposedScopes.every((scope) => scope.disposed && scope.signalAborted
      && scope.timeoutCount === 0 && scope.intervalCount === 0 && scope.cleanupCount === 0),
    afterWait.disposedScopes);
}

async function runCollapseCombinations(page) {
  await setChapterExpanded(page, "ch01", true);
  await setChapterExpanded(page, "ch02", true);

  const reverse = byRoute.get("forward-reverse");
  const continuous = byRoute.get("ch01-continuous-control");
  await clickRoute(page, reverse);
  await page.evaluate(() => {
    platformApi.resetCurrent();
    platformApi.dispatchAction("POWER_CLOSE");
    platformApi.dispatchAction("START_FORWARD_PRESS");
  });
  await page.waitForFunction(() => platformApi.getCurrentStateSnapshot().motor.running === true);
  const reverseScopeIndex = await currentScopeIndex(page);
  const reverseNodeIndex = await captureCurrentNode(page);
  const reverseListenerBaseline = await listenerEvidence(page, reverse.sourceToken);
  const reverseBeforeFold = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel()
  }));
  await setChapterExpanded(page, "ch02", false);
  const reverseFolded = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    active: [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module),
    navigation: platformApi.getNavigationState()
  }));
  collapseCombinations.push({ name: "reverse-while-ch02-collapsed", before: reverseBeforeFold, after: reverseFolded });
  check("collapse-combination", "collapsing Chapter 2 preserves the running reverse module exactly",
    same(reverseBeforeFold, {
      loader: reverseFolded.loader,
      state: reverseFolded.state,
      solver: reverseFolded.solver,
      playback: reverseFolded.playback
    }) && reverseFolded.navigation.chapter02Collapsed
    && same(reverseFolded.active, ["forward-reverse"]), reverseFolded);

  await clickRoute(page, continuous);
  const reverseDisposed = await scopeEvidence(page, reverseScopeIndex);
  const reverseNode = await detachedNodeEvidence(page, reverseNodeIndex);
  const reverseListenersAfterLeave = await listenerEvidence(page, reverse.sourceToken);
  const forwardSwitch = {
    loader: (await collectModuleEvidence(page)).diagnostics.loader,
    reverseDisposed,
    reverseNode,
    reverseListenersAfterLeave
  };
  collapseCombinations.push({ name: "collapsed-ch02-to-ch01-continuous", ...forwardSwitch });
  check("collapse-combination", "collapsed Chapter 2 reverse unloads before Chapter 1 continuous loads",
    forwardSwitch.loader.currentRouteId === continuous.routeId
    && reverseDisposed.disposed && reverseDisposed.signalAborted
    && reverseDisposed.timeoutCount === 0 && reverseDisposed.intervalCount === 0
    && !reverseNode.connected && reverseListenersAfterLeave.activeCount === 0, forwardSwitch);

  await page.evaluate(() => {
    platformApi.resetCurrent();
    platformApi.dispatchAction("POWER_CLOSE");
    platformApi.dispatchAction("START_PRIMARY_PRESS");
  });
  await page.waitForFunction(() => platformApi.getCurrentStateSnapshot().motor.running === true);
  const continuousScopeIndex = await currentScopeIndex(page);
  const continuousNodeIndex = await captureCurrentNode(page);
  const continuousBeforeFold = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel()
  }));
  await setChapterExpanded(page, "ch01", false);
  const continuousFolded = await page.evaluate(() => ({
    loader: platformApi.getDiagnostics().loader,
    state: platformApi.getCurrentStateSnapshot(),
    solver: platformApi.getCurrentSolverResult(),
    playback: platformApi.getCurrentPlaybackViewModel(),
    active: [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module),
    navigation: platformApi.getNavigationState()
  }));
  check("collapse-combination", "collapsing Chapter 1 preserves running continuous module exactly",
    same(continuousBeforeFold, {
      loader: continuousFolded.loader,
      state: continuousFolded.state,
      solver: continuousFolded.solver,
      playback: continuousFolded.playback
    }) && continuousFolded.navigation.chapter01Collapsed
    && same(continuousFolded.active, ["ch01-continuous-control"]), continuousFolded);

  await setChapterExpanded(page, "ch02", true);
  await clickRoute(page, reverse);
  const continuousDisposed = await scopeEvidence(page, continuousScopeIndex);
  const continuousNode = await detachedNodeEvidence(page, continuousNodeIndex);
  const continuousListeners = await listenerEvidence(page, continuous.sourceToken);
  const reverseListenerReentry = await listenerEvidence(page, reverse.sourceToken);
  const reverseEvidence = await collectModuleEvidence(page);
  const reverseSwitch = {
    loader: reverseEvidence.diagnostics.loader,
    continuousDisposed,
    continuousNode,
    continuousListeners,
    reverseListenerBaseline,
    reverseListenerReentry
  };
  collapseCombinations.push({ name: "collapsed-ch01-to-ch02-reverse", ...reverseSwitch });
  check("collapse-combination", "reverse direction unloads Chapter 1 continuous before reverse loads",
    reverseSwitch.loader.currentRouteId === reverse.routeId
    && continuousDisposed.disposed && continuousDisposed.signalAborted
    && continuousDisposed.timeoutCount === 0 && continuousDisposed.intervalCount === 0
    && !continuousNode.connected && continuousListeners.activeCount === 0, reverseSwitch);
  check("collapse-combination", "reverse re-entry has one stable listener set without duplicates",
    reverseListenerReentry.activeCount === reverseListenerBaseline.activeCount
    && reverseListenerReentry.duplicateCount === 0, {
      firstMount: reverseListenerBaseline,
      secondMount: reverseListenerReentry
    });

  await setChapterExpanded(page, "ch01", true);
  await setChapterExpanded(page, "ch02", true);
}

async function inspectResponsiveLayout(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(100);
  const layout = await page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (left, right) => Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x))
      * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y));
    const sidebar = rect(document.querySelector(".sidebar"));
    const stage = rect(document.querySelector(".stage-panel"));
    const inspector = rect(document.querySelector(".inspector"));
    const svg = rect(document.querySelector("#chapterModuleCanvas svg"));
    const rows = [...document.querySelectorAll(".platform-chapter")].map((chapter) => {
      const toggle = rect(chapter.querySelector(".platform-chapter-toggle"));
      const copy = rect(chapter.querySelector(".platform-chapter-copy"));
      const chevron = rect(chapter.querySelector(".platform-chapter-chevron"));
      const modules = [...chapter.querySelectorAll(".module-nav-item")].map((button) => ({
        button: rect(button),
        number: rect(button.querySelector(".num")),
        label: rect(button.querySelector(".label")),
        numberText: button.querySelector(".num").textContent.trim(),
        labelText: button.querySelector(".label").textContent.trim()
      }));
      return { chapterId: chapter.dataset.chapterId, toggle, copy, chevron, modules };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
      sidebar,
      stage,
      inspector,
      svg,
      overlaps: {
        sidebarStage: overlap(sidebar, stage),
        sidebarInspector: overlap(sidebar, inspector),
        stageInspector: overlap(stage, inspector)
      },
      rows,
      activeRoutes: [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module)
    };
  });
  responsive.push(layout);
  const rowsAligned = layout.rows.every((chapter) =>
    chapter.toggle.x >= layout.sidebar.x - 1
    && chapter.toggle.right <= layout.sidebar.right + 1
    && chapter.copy.right <= chapter.chevron.x + 1
    && chapter.chevron.right <= chapter.toggle.right + 1
    && chapter.modules.every((item) =>
      item.button.x >= layout.sidebar.x - 1
      && item.button.right <= layout.sidebar.right + 1
      && item.number.right <= item.label.x + 1
      && /^\d{2}$/.test(item.numberText)
      && item.labelText.length > 0));
  check("responsive", width + "x" + height + " has no horizontal document overflow",
    layout.document.scrollWidth <= width + 1, layout);
  check("responsive", width + "x" + height + " panels do not overlap",
    Object.values(layout.overlaps).every((value) => value < 1), layout.overlaps);
  check("responsive", width + "x" + height + " chapter arrows/text/numbers remain aligned",
    rowsAligned, layout.rows);
  check("responsive", width + "x" + height + " current SVG remains visible inside the stage",
    layout.svg.width > 300 && layout.svg.height > 200
    && layout.svg.x >= layout.stage.x - 1 && layout.svg.right <= layout.stage.right + 1, {
      svg: layout.svg,
      stage: layout.stage
    });
  return layout;
}

async function inspectDirectPage(context, entry) {
  const page = await context.newPage();
  const localErrors = attachErrorCapture(page, "direct:" + entry.kind + ":" + entry.query);
  let result;
  let directFatal = null;
  try {
    await page.goto(baseUrl + "/index.html?module=" + encodeURIComponent(entry.query), { waitUntil: "networkidle" });
    await page.waitForFunction(({ routeId, moduleId }) => {
      const loader = globalThis.platformApi && platformApi.getDiagnostics().loader;
      return loader && loader.currentRouteId === routeId && loader.currentModuleId === moduleId;
    }, { routeId: entry.expected.routeId, moduleId: entry.expected.moduleId });
    result = await page.evaluate(({ routeId, moduleId, title }) => {
      const diagnostics = platformApi.getDiagnostics();
      const contract = platformApi.getCurrentContractReport();
      const currentNodes = [...document.querySelectorAll("#chapterModuleCanvas > [data-module]")]
        .map((node) => node.dataset.module);
      const active = [...document.querySelectorAll(".module-nav-item.active")].map((node) => node.dataset.module);
      const svg = document.querySelector("#chapterModuleCanvas svg");
      return {
        loader: diagnostics.loader,
        contract,
        state: platformApi.getCurrentStateSnapshot(),
        formalCount: platformApi.getFormalNavigation().length,
        chapterCounts: [...document.querySelectorAll(".platform-chapter")].map((section) =>
          section.querySelectorAll(".module-nav-item").length),
        currentNodes,
        active,
        title: document.getElementById("experimentTitle").textContent.trim(),
        svgVisible: Boolean(svg && svg.getBoundingClientRect().width > 300 && svg.getBoundingClientRect().height > 200),
        expected: { routeId, moduleId, title }
      };
    }, { routeId: entry.expected.routeId, moduleId: entry.expected.moduleId, title: entry.expected.title });
  } catch (error) {
    directFatal = error.stack || String(error);
  } finally {
    const record = {
      kind: entry.kind,
      query: entry.query,
      expectedRouteId: entry.expected.routeId,
      expectedModuleId: entry.expected.moduleId,
      result,
      browserErrors: clone(localErrors),
      fatal: directFatal
    };
    directRoutes.push(record);
    check("direct-url", entry.kind + " ?module=" + entry.query + " resolves to exact new route/module",
      !directFatal && result && result.loader.currentRouteId === entry.expected.routeId
      && result.loader.currentModuleId === entry.expected.moduleId
      && result.state.moduleId === entry.expected.moduleId && result.state.routeId === entry.expected.routeId,
      record);
    check("direct-url", entry.kind + " ?module=" + entry.query + " renders contract/title/SVG/sole DOM",
      !directFatal && result && result.contract.valid && same(result.currentNodes, [entry.expected.moduleId])
      && same(result.active, [entry.expected.routeId]) && result.title === entry.expected.title
      && result.svgVisible, result);
    check("direct-url", entry.kind + " ?module=" + entry.query + " keeps formal sidebar at 3+5 only",
      !directFatal && result && result.formalCount === 8 && same(result.chapterCounts, [3, 5]), result);
    check("direct-url", entry.kind + " ?module=" + entry.query + " has zero console/page errors",
      !directFatal && localErrors.length === 0, localErrors);
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "no-preference"
  });
  await context.addInitScript(() => {
    const records = [];
    const targetIds = new WeakMap();
    let nextTargetId = 1;
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const captureOf = (options) => typeof options === "boolean" ? options : Boolean(options && options.capture);
    const signalOf = (options) => typeof options === "object" && options ? options.signal || null : null;
    const targetId = (target) => {
      if (!targetIds.has(target)) targetIds.set(target, nextTargetId++);
      return targetIds.get(target);
    };
    const targetName = (target) => {
      if (target === globalThis) return "window";
      if (target === document) return "document";
      if (target && target.nodeType === Node.DOCUMENT_NODE) return "document";
      if (!target || !target.nodeType) return target && target.constructor ? target.constructor.name : "unknown";
      const id = target.id ? "#" + target.id : "";
      const moduleId = target.dataset && target.dataset.module ? '[data-module="' + target.dataset.module + '"]' : "";
      return target.tagName.toLowerCase() + id + moduleId;
    };
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      records.push({
        target: this,
        targetId: targetId(this),
        type,
        listener,
        capture: captureOf(options),
        signal: signalOf(options),
        removed: false,
        stack: new Error().stack || ""
      });
      return Reflect.apply(originalAdd, this, [type, listener, options]);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const capture = captureOf(options);
      records.forEach((record) => {
        if (record.target === this && record.type === type && record.listener === listener
          && record.capture === capture) record.removed = true;
      });
      return Reflect.apply(originalRemove, this, [type, listener, options]);
    };
    globalThis.__migrationListenerAudit = {
      summary(sourceToken) {
        const active = records.filter((record) => !record.removed
          && !(record.signal && record.signal.aborted)
          && record.stack.includes(sourceToken));
        const groups = new Map();
        active.forEach((record) => {
          const source = record.stack.split("\n").find((line) => line.includes(sourceToken)) || "";
          const key = [record.targetId, record.type, record.capture, source.trim()].join("|");
          groups.set(key, (groups.get(key) || 0) + 1);
        });
        const duplicates = [...groups.entries()].filter((entry) => entry[1] > 1);
        return {
          sourceToken,
          activeCount: active.length,
          duplicateCount: duplicates.length,
          byTarget: active.reduce((summary, record) => {
            const name = targetName(record.target);
            summary[name] = (summary[name] || 0) + 1;
            return summary;
          }, {}),
          types: active.reduce((summary, record) => {
            summary[record.type] = (summary[record.type] || 0) + 1;
            return summary;
          }, {}),
          duplicateSamples: duplicates.slice(0, 5)
        };
      }
    };
  });

  const page = await context.newPage();
  const mainErrors = attachErrorCapture(page, "main-page");

  try {
    await page.goto(baseUrl + "/index.html?module=ch01-jog-control", { waitUntil: "networkidle" });
    await page.waitForFunction(() => globalThis.platformApi
      && platformApi.getDiagnostics().loader.currentRouteId === "ch01-jog-control");
    await validateFormalNavigation(page);

    for (const module of modules) {
      await clickRoute(page, module);
      const evidence = await inspectModule(page, module, "gallery:" + module.routeId, true);
      await page.screenshot({
        path: path.join(output, module.screenshot),
        fullPage: true,
        animations: "disabled"
      });
      gallery.push({
        routeId: module.routeId,
        moduleId: module.moduleId,
        screenshot: module.screenshot,
        loader: evidence.diagnostics.loader,
        title: evidence.shell.experimentTitle,
        purpose: evidence.shell.experimentPurpose,
        svg: evidence.shell.svg,
        controls: evidence.shell.operationButtons,
        statusRows: evidence.shell.statusRows
      });
    }

    for (const entry of directEntries) await inspectDirectPage(context, entry);

    await installScopeAudit(page);
    await runStress(page);
    await runCollapseCombinations(page);

    await clickRoute(page, byRoute.get("main-control"));
    await setChapterExpanded(page, "ch01", true);
    await setChapterExpanded(page, "ch02", true);
    await inspectResponsiveLayout(page, 1366, 768);
    await inspectResponsiveLayout(page, 1024, 768);
    await inspectResponsiveLayout(page, 960, 720);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(output, "migration-M-full-platform.png"),
      fullPage: true,
      animations: "disabled"
    });

    const final = await collectModuleEvidence(page);
    check("final", "final full-platform state still exposes only 8 formal entries",
      final.formalNavigation.length === 8
      && same(final.shell.moduleNodeIds, ["ch02_main_control"]), {
        formalNavigation: final.formalNavigation,
        moduleNodeIds: final.shell.moduleNodeIds
      });
    check("final", "main acceptance page has zero console/page errors", mainErrors.length === 0, mainErrors);
  } catch (error) {
    fatal = error.stack || String(error);
  } finally {
    try {
      if (!page.isClosed()) {
        const finalErrors = clone(mainErrors);
        check("browser", "aggregate console/page errors are zero", browserErrors.length === 0, browserErrors);
        check("browser", "main page error stream is zero", finalErrors.length === 0, finalErrors);
      }
    } catch (_) {
      // The fatal field below is the source of truth when the page itself died.
    }
    const passed = checks.filter((entry) => entry.passed).length;
    const failed = checks.filter((entry) => !entry.passed);
    const result = {
      status: !fatal && failed.length === 0 && browserErrors.length === 0
        ? "PLATFORM_MIGRATION_ACCEPTANCE_PASSED"
        : "PLATFORM_MIGRATION_ACCEPTANCE_FAILED",
      generatedAt: new Date().toISOString(),
      baseUrl,
      chromePath,
      expectedModules: modules,
      summary: { passed, failed: failed.length, total: checks.length },
      fatal,
      browserErrors,
      checks,
      gallery,
      directRoutes,
      stress,
      collapseCombinations,
      responsive,
      screenshots: [
        ...modules.map((item) => item.screenshot),
        "migration-M-full-platform.png"
      ]
    };
    fs.writeFileSync(
      path.join(output, "platform-migration-validation.json"),
      JSON.stringify(result, null, 2) + "\n"
    );
    console.log(JSON.stringify({
      status: result.status,
      summary: result.summary,
      fatal: result.fatal,
      browserErrors: result.browserErrors,
      failed: failed.slice(0, 25),
      screenshots: result.screenshots
    }, null, 2));
    await context.close();
    await browser.close();
    if (result.status !== "PLATFORM_MIGRATION_ACCEPTANCE_PASSED") process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
