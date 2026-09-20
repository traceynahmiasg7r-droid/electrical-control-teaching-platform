"use strict";

// Long-running (self-lock) control acceptance.  This is intentionally kept
// outside the implementation: it exercises the public Facade/Platform API
// and verifies that the SVG is a projection of Solver state.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const repo = path.resolve(__dirname, "../../../../../..");
const output = path.resolve(repo, "output/playwright");
const url = (process.env.ECTP_TEST_URL || "http://127.0.0.1:4173") + "/index.html";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });

  const reports = [];
  const check = (id, pass, detail = "") => {
    const item = { id, pass: Boolean(pass), detail: String(detail || "") };
    reports.push(item);
    if (!item.pass) console.error("FAIL", id, detail || "");
    return item.pass;
  };
  const wait = (ms = 60) => page.waitForTimeout(ms);
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => {
    if (!window.platformApi?.dispatchAction) throw new Error("platformApi.dispatchAction unavailable");
    return window.platformApi.dispatchAction(type, payload, "continuous-acceptance");
  }, { type, payload });
  const playback = (command, value) => page.evaluate(({ command, value }) => {
    if (!window.platformApi?.dispatchPlayback) throw new Error("platformApi.dispatchPlayback unavailable");
    return window.platformApi.dispatchPlayback(command, value);
  }, { command, value });
  const state = () => page.evaluate(() => {
    const board = document.querySelector(".ch02-continuous-board");
    const svg = board?.closest("svg") || board;
    return {
      snapshot: window.platformApi.getCurrentStateSnapshot(),
      solver: window.platformApi.getCurrentSolverResult(),
      playback: window.platformApi.getCurrentPlaybackViewModel?.() || null,
      diagnostics: window.platformApi.getDiagnostics?.() || null,
      contract: window.platformApi.getCurrentContractReport?.() || null,
      board: svg ? {
        viewBox: svg.getAttribute("viewBox") || "",
        wires: svg.querySelectorAll(".ch02-continuous-wire").length,
        active: svg.querySelectorAll(".ch02-continuous-wire-active").length,
        flow: svg.querySelectorAll(".ch02-continuous-flow").length,
        defs: svg.querySelectorAll("defs > path").length,
        components: svg.querySelectorAll("[data-component-id]").length,
        junctions: svg.querySelectorAll(".ch02-continuous-junction").length,
        labels: svg.querySelectorAll("text").length,
        source: svg.dataset.stateSource || ""
      } : null
    };
  });
  // Read the actual contact geometry emitted by the central SVG renderer.
  // These helpers intentionally inspect path endpoints instead of CSS color
  // or active-wire classes: a component must visibly open/close even when
  // Active Highlight is disabled.
  const componentGeometry = (componentId) => page.evaluate((id) => {
    const root = document.querySelector(".ch02-continuous-board");
    const group = root?.querySelector(`[data-component-id="${id}"]`);
    const pathEndpoints = (d) => [...String(d || "").matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map((match) => [Number(match[1]), Number(match[2])]);
    return {
      exists: Boolean(group),
      classes: group?.getAttribute("class") || "",
      pressed: Boolean(group?.classList.contains("is-pressed")),
      energized: Boolean(group?.classList.contains("is-energized")),
      paths: [...(group?.querySelectorAll("path[data-edge-id]") || [])].map((node) => ({
        edgeId: node.getAttribute("data-edge-id") || "",
        d: node.getAttribute("d") || "",
        endpoints: pathEndpoints(node.getAttribute("d")),
        conductive: node.classList.contains("is-conductive")
      }))
    };
  }, componentId);
  const componentGeometryBatch = (ids) => page.evaluate((componentIds) => {
    const root = document.querySelector(".ch02-continuous-board");
    const pathEndpoints = (d) => [...String(d || "").matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map((match) => [Number(match[1]), Number(match[2])]);
    const read = (id) => {
      const group = root?.querySelector(`[data-component-id="${id}"]`);
      return {
        exists: Boolean(group),
        classes: group?.getAttribute("class") || "",
        pressed: Boolean(group?.classList.contains("is-pressed")),
        energized: Boolean(group?.classList.contains("is-energized")),
        paths: [...(group?.querySelectorAll("path[data-edge-id]") || [])].map((node) => ({
          edgeId: node.getAttribute("data-edge-id") || "",
          d: node.getAttribute("d") || "",
          endpoints: pathEndpoints(node.getAttribute("d")),
          conductive: node.classList.contains("is-conductive")
        }))
      };
    };
    return Object.fromEntries(componentIds.map((id) => [id, read(id)]));
  }, ids);
  const directPath = (entry, from, to, tolerance = 0.01) => {
    const points = entry?.endpoints || [];
    const same = (a, b) => a && b && Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
    return points.length === 2 && same(points[0], from) && same(points[1], to);
  };
  const ncPath = (entry, from, to, closed) => {
    const points = entry?.endpoints || [], lower = [to[0], to[1] + 27];
    const same = (a, b) => a && b && Math.abs(a[0] - b[0]) <= 0.01 && Math.abs(a[1] - b[1]) <= 0.01;
    if (points.length !== 4 || !same(points[0], from) || !same(points[2], to) || !same(points[3], lower)) return false;
    return closed ? same(points[1], lower) : points[1][0] < to[0] - 1;
  };
  const threeDirectPaths = (geometry, fromPoints, toPoints) => geometry?.paths?.length === 3
    && geometry.paths.every((entry, index) => directPath(entry, fromPoints[index], toPoints[index]));
  const reset = async () => { await action("RESET_MODULE"); await wait(); };
  const shot = async (name) => page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
  const edgeIs = (solver, token, expected) => {
    const entry = Object.entries(solver?.edgeStates || {}).find(([id]) => id.toLowerCase().includes(token.toLowerCase()));
    return entry ? Boolean(entry[1]?.conductive) === expected : false;
  };
  const energized = (snapshot) => Boolean(snapshot?.devices?.primaryContactor?.energized);
  const motorRunning = (snapshot) => Boolean(snapshot?.motor?.running);
  const selfHold = (solver) => Boolean(solver?.extension?.selfHoldConductive ?? solver?.selfHoldConductive);

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await wait(180);
    await page.evaluate(() => window.platformApi.switchModule("self-lock"));
    await wait(220);

    let current = await state();
    check("continuous board mounted", Boolean(current.board));
    check("geometry contract", current.contract?.valid === true, JSON.stringify(current.contract));
    check("static SVG has complete circuit", current.board && current.board.wires >= 20 && current.board.defs >= current.board.wires && current.board.components >= 8 && current.board.junctions >= 2, JSON.stringify(current.board));
    check("initial stopped", current.snapshot?.motor?.running === false && !energized(current.snapshot));
    check("released SB1 / closed SB2 NC", edgeIs(current.solver, "sb1_no", false) && edgeIs(current.solver, "sb2_nc", true));
    const initialGeometry = await componentGeometryBatch(["qf1", "sb1", "sb2", "km1_self", "km1_main", "fr1_nc"]);
    check("QF1 open has three separate blade geometries", initialGeometry.qf1?.paths?.length === 3
      && initialGeometry.qf1.paths.every((entry, index) => !directPath(entry, [[176, 230], [251, 230], [326, 230]][index], [[176, 260], [251, 260], [326, 260]][index])));
    check("SB1 released geometry is NO open", initialGeometry.sb1?.pressed === false
      && !directPath(initialGeometry.sb1?.paths?.[0], [655, 278], [737, 278]));
    check("SB2 released geometry is NC closed", initialGeometry.sb2?.pressed === false
      && ncPath(initialGeometry.sb2?.paths?.[0], [879, 278], [953, 278], true));
    check("KM1 deenergized geometry is open", initialGeometry.km1_self?.energized === false
      && initialGeometry.km1_main?.energized === false
      && !directPath(initialGeometry.km1_self?.paths?.[0], [659, 361], [737, 361])
      && initialGeometry.km1_main?.paths?.length === 3
      && initialGeometry.km1_main.paths.every((entry, index) => !directPath(entry, [[176, 541], [251, 541], [326, 541]][index], [[176, 627], [251, 627], [326, 627]][index])));
    check("FR1 normal NC geometry is closed", ncPath(initialGeometry.fr1_nc?.paths?.[0], [1237, 278], [1322, 305], true));
    check("geometry uses one coordinate space", await page.evaluate(() => {
      const svg = document.querySelector(".ch02-continuous-board");
      if (!svg || !svg.getAttribute("viewBox")) return false;
      const hrefs = [...svg.querySelectorAll(".ch02-continuous-wire, .ch02-continuous-wire-active, .ch02-continuous-flow")]
        .map((node) => node.getAttribute("href") || node.getAttribute("xlink:href"));
      return hrefs.length > 0 && hrefs.every((href) => href && svg.querySelector(href.replace(/^#/, "#"))?.tagName.toLowerCase() === "path");
    }));
    check("unique conductive geometry ids", await page.evaluate(() => {
      const ids = [...document.querySelectorAll(".ch02-continuous-board [data-conductive-geometry='true']")].map((node) => node.id).filter(Boolean);
      return ids.length === new Set(ids).size;
    }));
    check("motor has three connected leads", await page.evaluate(() => {
      const svg = document.querySelector(".ch02-continuous-board");
      if (!svg) return false;
      const motor = svg.querySelector("[data-component-id*='motor'] ellipse.continuous-motor");
      if (!motor) return false;
      const cx = Number(motor.getAttribute("cx")), cy = Number(motor.getAttribute("cy"));
      const rx = Number(motor.getAttribute("rx")), ry = Number(motor.getAttribute("ry"));
      if (![cx, cy, rx, ry].every(Number.isFinite)) return false;
      const paths = [...svg.querySelectorAll("defs > path")].filter((node) => /ccmw_1[345]$/.test(node.id));
      return paths.length === 3 && paths.every((node) => {
        const values = (node.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
        if (values.length < 2) return false;
        const x = values[values.length - 2], y = values[values.length - 1];
        const normalized = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        return Math.abs(normalized - 1) < 0.08;
      });
    }));
    check("no current flow while stopped", current.board?.active === 0 && current.board?.flow === 0);
    await shot("continuous-A-static");

    await action("POWER_CLOSE");
    await wait();
    current = await state();
    check("QF1 close standby", current.snapshot.operation.power === "closed" && !motorRunning(current.snapshot));
    check("QF1 phases conductive", ["qf1_a", "qf1_b", "qf1_c"].every((token) => edgeIs(current.solver, token, true)));
    const qf1ClosedGeometry = await componentGeometry("qf1");
    check("QF1 closed blades contact all three terminals", threeDirectPaths(qf1ClosedGeometry,
      [[176, 230], [251, 230], [326, 230]], [[176, 260], [251, 260], [326, 260]]));
    check("QF1 open to closed changes blade geometry", qf1ClosedGeometry.paths?.every((entry, index) => entry.d !== initialGeometry.qf1.paths[index].d));
    await shot("continuous-B-qf1-closed");

    // START_PRIMARY_PRESS is a momentary action: the facade evaluates the
    // pressed and released states, leaving SB1 released and KM1 self-held.
    await action("START_PRIMARY_PRESS", { phase: "press" });
    await wait();
    current = await state();
    check("SB1 starts motor", motorRunning(current.snapshot) && energized(current.snapshot));
    check("KM1 self-hold established", selfHold(current.solver));
    check("SB1 NO active after pulse", edgeIs(current.solver, "sb1_no", false));
    const runningGeometry = await componentGeometryBatch(["sb1", "sb2", "km1_self", "km1_main", "fr1_nc"]);
    check("running SB1 is released/open", runningGeometry.sb1?.pressed === false
      && !directPath(runningGeometry.sb1?.paths?.[0], [655, 278], [737, 278]));
    check("running SB2 NC is closed", runningGeometry.sb2?.pressed === false
      && ncPath(runningGeometry.sb2?.paths?.[0], [879, 278], [953, 278], true));
    check("energized KM1 self contact is closed", runningGeometry.km1_self?.energized === true
      && directPath(runningGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    check("energized KM1 main contacts close together", runningGeometry.km1_main?.energized === true
      && threeDirectPaths(runningGeometry.km1_main,
        [[176, 541], [251, 541], [326, 541]], [[176, 627], [251, 627], [326, 627]]));
    check("running FR1 NC remains closed", ncPath(runningGeometry.fr1_nc?.paths?.[0], [1237, 278], [1322, 305], true));
    check("active/flow share real geometry", await page.evaluate(() => {
      const svg = document.querySelector(".ch02-continuous-board");
      const active = [...svg.querySelectorAll(".ch02-continuous-wire-active")].map((node) => node.dataset.wireId).filter(Boolean);
      const flow = [...svg.querySelectorAll(".ch02-continuous-flow")].map((node) => node.dataset.flowWireId || node.dataset.wireId).filter(Boolean);
      return active.length > 0 && active.every((id) => flow.includes(id)) && [...svg.querySelectorAll(".ch02-continuous-flow")].every((node) => {
        const href = node.getAttribute("href") || node.getAttribute("xlink:href");
        return href && svg.querySelector(href)?.tagName.toLowerCase() === "path";
      });
    }));
    await shot("continuous-C-sb1-start");

    // Releasing SB1 must not drop KM1: the auxiliary NO carries the coil.
    current = await state();
    check("SB1 release remains running", current.snapshot.operation.controls.start === "released" && motorRunning(current.snapshot) && energized(current.snapshot));
    check("self-hold visual state", await page.evaluate(() => {
      const node = document.querySelector("[data-component-id*='self'] .is-active-edge, [data-component-id*='km1'] .is-active-edge");
      return Boolean(node) || document.querySelectorAll(".ch02-continuous-wire-active").length > 0;
    }));
    await shot("continuous-D-self-hold");

    await action("STOP_PRIMARY_PRESS", { phase: "press" });
    await wait();
    const sb2PressedGeometry = await componentGeometry("sb2");
    check("SB2 live press visibly opens NC", sb2PressedGeometry?.pressed === true
      && ncPath(sb2PressedGeometry?.paths?.[0], [879, 278], [953, 278], false));
    await shot("continuous-E-sb2-pressed-live");
    await wait(760);
    current = await state();
    check("SB2 stop releases KM1", !motorRunning(current.snapshot) && !energized(current.snapshot));
    // The public action is a press/release pulse; after the pulse SB2's NC
    // contact is restored while KM1 remains released (the replay contains
    // the transient open state when playback is enabled).
    check("SB2 NC restored after stop pulse", edgeIs(current.solver, "sb2_nc", true));
    check("stop clears active flow", current.board?.active === 0 && current.board?.flow === 0);
    const stoppedGeometry = await componentGeometryBatch(["sb2", "km1_self", "km1_main"]);
    check("stopped KM1 self contact opens", stoppedGeometry.km1_self?.energized === false
      && !directPath(stoppedGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    check("stopped KM1 main contacts open together", stoppedGeometry.km1_main?.energized === false
      && stoppedGeometry.km1_main?.paths?.length === 3
      && stoppedGeometry.km1_main.paths.every((entry, index) => !directPath(entry, [[176, 541], [251, 541], [326, 541]][index], [[176, 627], [251, 627], [326, 627]][index])));
    check("SB2 released NC remains closed after stop", stoppedGeometry.sb2?.pressed === false
      && ncPath(stoppedGeometry.sb2?.paths?.[0], [879, 278], [953, 278], true));
    await shot("continuous-E-sb2-stop");

    // Protection: an overload drops KM1, and reset is deliberately not an
    // automatic restart (the operator must press SB1 again).
    await action("POWER_CLOSE");
    await action("START_PRIMARY_PRESS", { phase: "press" });
    await wait();
    check("restart before overload", motorRunning((await state()).snapshot));
    await action("PROTECTION_TOGGLE");
    await wait();
    current = await state();
    check("FR1 overload releases KM1", current.snapshot.operation.protections.overload === "overload" && !motorRunning(current.snapshot) && !energized(current.snapshot));
    check("FR1 NC opens", edgeIs(current.solver, "fr1_nc", false));
    const overloadGeometry = await componentGeometryBatch(["fr1_nc", "km1_self", "km1_main"]);
    check("FR1 tripped NC geometry is open", ncPath(overloadGeometry.fr1_nc?.paths?.[0], [1237, 278], [1322, 305], false));
    check("FR1 trip opens KM1 geometry", overloadGeometry.km1_self?.energized === false
      && overloadGeometry.km1_main?.energized === false
      && !directPath(overloadGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    await shot("continuous-F-fr1-overload");
    await action("PROTECTION_RESET");
    await wait();
    current = await state();
    check("FR1 reset does not auto restart", current.snapshot.operation.protections.overload === "normal" && !motorRunning(current.snapshot) && !energized(current.snapshot));
    const resetGeometry = await componentGeometryBatch(["fr1_nc", "km1_self", "km1_main"]);
    check("FR1 reset closes NC without restarting KM1", ncPath(resetGeometry.fr1_nc?.paths?.[0], [1237, 278], [1322, 305], true)
      && resetGeometry.km1_self?.energized === false
      && resetGeometry.km1_main?.energized === false
      && !directPath(resetGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    await shot("continuous-G-fr1-reset");

    // A closed QF is still required after a reset; opening it blocks a start.
    await action("POWER_OPEN");
    await action("START_PRIMARY_PRESS", { phase: "press" });
    await wait();
    current = await state();
    check("QF open blocks restart", current.snapshot.operation.power === "open" && !motorRunning(current.snapshot));
    await reset();

    // Playback is detached from the live Solver.  Implementations may choose
    // a descriptive id; accept the stable continuous-cycle/self-lock-cycle
    // names while still requiring an actual playback state.
    const beforePlayback = await state();
    // Walk the canonical playback frame sequence so the momentary button
    // states are asserted as geometry, not merely as panel text or color.
    await playback("scenario", "continuous-cycle");
    await playback("restart");
    await wait(90);
    let playbackGeometry = await componentGeometryBatch(["qf1", "sb1", "sb2", "km1_self", "km1_main"]);
    check("playback QF1-open frame has open blades", playbackGeometry.qf1?.paths?.length === 3
      && playbackGeometry.qf1.paths.every((entry, index) => !directPath(entry, [[176, 230], [251, 230], [326, 230]][index], [[176, 260], [251, 260], [326, 260]][index])));
    await playback("next"); // QF1 closed, waiting for SB1.
    await wait(50);
    playbackGeometry = await componentGeometryBatch(["qf1", "sb1", "sb2"]);
    check("playback QF1-closed frame closes all blades", threeDirectPaths(playbackGeometry.qf1,
      [[176, 230], [251, 230], [326, 230]], [[176, 260], [251, 260], [326, 260]]));
    check("playback SB1 released frame is NO open", playbackGeometry.sb1?.pressed === false
      && !directPath(playbackGeometry.sb1?.paths?.[0], [655, 278], [737, 278]));
    check("playback SB2 released frame is NC closed", playbackGeometry.sb2?.pressed === false
      && ncPath(playbackGeometry.sb2?.paths?.[0], [879, 278], [953, 278], true));
    await playback("next"); // SB1 pressed.
    await wait(50);
    playbackGeometry = await componentGeometryBatch(["sb1", "sb2"]);
    check("playback SB1 pressed frame closes NO", playbackGeometry.sb1?.pressed === true
      && directPath(playbackGeometry.sb1?.paths?.[0], [655, 278], [737, 278]));
    check("playback SB2 remains NC closed while SB1 pressed", playbackGeometry.sb2?.pressed === false
      && ncPath(playbackGeometry.sb2?.paths?.[0], [879, 278], [953, 278], true));
    await playback("next"); // KM1 energized while SB1 is still pressed.
    await wait(50);
    playbackGeometry = await componentGeometryBatch(["sb1", "km1_self", "km1_main"]);
    check("playback energized KM1 closes self contact", playbackGeometry.km1_self?.energized === true
      && directPath(playbackGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    check("playback energized KM1 closes all main contacts", playbackGeometry.km1_main?.energized === true
      && threeDirectPaths(playbackGeometry.km1_main,
        [[176, 541], [251, 541], [326, 541]], [[176, 627], [251, 627], [326, 627]]));
    await playback("next"); // SB1 released; self-hold remains.
    await wait(50);
    playbackGeometry = await componentGeometryBatch(["sb1", "km1_self", "km1_main"]);
    check("playback SB1 release reopens NO", playbackGeometry.sb1?.pressed === false
      && !directPath(playbackGeometry.sb1?.paths?.[0], [655, 278], [737, 278]));
    check("playback SB1 release leaves self-hold closed", playbackGeometry.km1_self?.energized === true
      && directPath(playbackGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    await playback("next"); // Continuous running frame.
    await playback("next"); // SB2 pressed.
    await wait(50);
    playbackGeometry = await componentGeometryBatch(["sb2", "km1_self", "km1_main"]);
    check("playback SB2 pressed frame opens NC", playbackGeometry.sb2?.pressed === true
      && ncPath(playbackGeometry.sb2?.paths?.[0], [879, 278], [953, 278], false));
    check("playback SB2 press releases KM1 geometry", playbackGeometry.km1_self?.energized === false
      && playbackGeometry.km1_main?.energized === false
      && !directPath(playbackGeometry.km1_self?.paths?.[0], [659, 361], [737, 361]));
    await playback("next"); // SB2 released, stopped.
    await wait(50);
    playbackGeometry = await componentGeometry("sb2");
    check("playback SB2 release restores NC closed", playbackGeometry.pressed === false
      && ncPath(playbackGeometry.paths?.[0], [879, 278], [953, 278], true));
    await playback("exit");
    await wait(50);

    let playbackStarted = false;
    for (const id of ["continuous-cycle", "self-lock-cycle", "start-stop", "overview"]) {
      try {
        await playback("scenario", id);
        await playback("restart");
        await wait(90);
        const view = await state();
        if (view.playback?.mode === "Playback" && view.playback?.step?.displayState) {
          playbackStarted = true;
          current = view;
          break;
        }
      } catch (_) { /* try the next catalog id */ }
    }
    check("playback active", playbackStarted, JSON.stringify(current.playback));
    check("playback does not mutate live state", playbackStarted && JSON.stringify(current.snapshot) === JSON.stringify(beforePlayback.snapshot));
    check("playback teaching focus rendered", playbackStarted && await page.evaluate(() => document.querySelectorAll(".ch02-continuous-component.is-teaching-focus, .ch02-continuous-board .is-teaching-focus").length > 0));
    if (playbackStarted) await shot("continuous-H-playback");
    try { await playback("exit"); } catch (_) { /* no-op when playback is unavailable */ }
    await wait();
    check("playback exits to live", (await state()).playback?.mode === "Live");

    await page.evaluate(() => window.platformApi.switchModule("forward-reverse"));
    await wait(150);
    check("reverse navigation mount", await page.evaluate(() => Boolean(document.querySelector(".ch02-reverse-board"))));
    await page.evaluate(() => window.platformApi.switchModule("main-control"));
    await wait(150);
    check("main-control navigation mount", await page.evaluate(() => Boolean(document.querySelector(".ch02-main-control-board"))));
    await page.evaluate(() => window.platformApi.switchModule("self-lock"));
    await wait(180);
    check("continuous reentry cleanup", await page.evaluate(() => Boolean(document.querySelector(".ch02-continuous-board")) && document.querySelectorAll(".ch02-reverse-board,.ch02-main-control-board").length === 0));

    for (const [width, height] of [[1366, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await wait(50);
      const layout = await page.evaluate(() => {
        const board = document.querySelector(".ch02-continuous-board")?.getBoundingClientRect();
        return { scrollWidth: document.documentElement.scrollWidth, board: board ? { width: board.width, height: board.height, right: board.right, bottom: board.bottom } : null };
      });
      check("responsive " + width, layout.board && layout.board.width > 0 && layout.board.height > 0 && layout.scrollWidth <= Math.max(width, 760), JSON.stringify(layout));
      await shot("continuous-" + width);
    }

    await reset();
    const diagnostics = await page.evaluate(() => window.platformApi.getDiagnostics?.() || {});
    const scope = diagnostics.loader?.currentScope || diagnostics.currentScope || {};
    check("browser errors", browserErrors.length === 0, browserErrors.join(" | "));
    check("runtime timers clean", scope.timeoutCount === 0 && scope.intervalCount === 0, JSON.stringify(scope));
    fs.writeFileSync(path.join(output, "continuous-validation.json"), JSON.stringify({ reports, browserErrors, diagnostics }, null, 2));
    console.log(JSON.stringify({ passed: reports.filter((item) => item.pass).length, failed: reports.filter((item) => !item.pass).length, browserErrors, screenshots: reports.filter((item) => item.id.startsWith("responsive") || /static|qf1|sb1|self|stop|overload|reset|playback/.test(item.id)).length }, null, 2));
    if (reports.some((item) => !item.pass) || browserErrors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
