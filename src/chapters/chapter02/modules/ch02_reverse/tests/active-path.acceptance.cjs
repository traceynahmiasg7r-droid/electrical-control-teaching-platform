"use strict";
const assert = require("node:assert/strict");
const { runElectricalChecks } = require("./electrical.acceptance.cjs");

async function runActivePathChecks(page) {
  const electrical = await runElectricalChecks(page);
  const report = await page.evaluate(() => {
    const checks = [];
    const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
    const data = ECTPPlatform.moduleCircuitData.ch02Reverse;
    const knownElectricalWires = new Set(data.wires.flatMap((wire) => wire.electricalWireIds));
    const knownWireIds = new Set(data.wires.map((wire) => wire.wireId));
    const knownEdges = new Set(data.components.flatMap((component) => component.electricalEdgeIds));
    const pathFor = (wire) => wire.points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ");

    function inspect(name) {
      const solver = platformApi.getCurrentSolverResult();
      const board = document.querySelector(".ch02-reverse-board");
      const base = [...board.querySelectorAll(".ch02-reverse-wire")];
      const overlays = [...board.querySelectorAll(".ch02-reverse-wire-active")];
      const main = new Set(solver.activeMainWireIds || []);
      const control = new Set(solver.activeControlWireIds || []);
      const edgeIds = new Set([...(solver.extension?.activeMainEdgeIds || []), ...(solver.extension?.activeControlEdgeIds || [])]);
      // Approved Stage3 Visual Membership Clarification, limited to QF/FU bridges.
      const derived = new Set(["l1", "l2", "l3"].filter((phase) =>
        solver.motorStates.M.running && [...main].some((id) => solver.extension.activeMainWirePhaseMap[id] === phase)
        && ["qf1_edge_" + phase, "fu1_edge_" + phase].every((id) =>
          solver.extension.activeMainEdgeIds.includes(id) && solver.edgeStates[id].conductive)
      ).map((phase) => "qf_fu_" + phase));
      const expected = data.wires.filter((wire) => derived.has(wire.wireId) || wire.electricalWireIds.some((id) => main.has(id) || control.has(id)));
      const expectedIds = new Set(expected.map((wire) => wire.wireId));
      check(name + ": all Solver active wire IDs are known", [...main, ...control].every((id) => knownElectricalWires.has(id)));
      check(name + ": all Solver active edge IDs are known", [...edgeIds].every((id) => knownEdges.has(id)));
      check(name + ": base wire count is frozen", base.length === data.wires.length);
      check(name + ": active overlay count matches Solver", overlays.length === expected.length);
      check(name + ": active overlay IDs match Solver", overlays.every((item) => expectedIds.has(item.dataset.wireId)) && overlays.length === expectedIds.size);
      check(name + ": every active href resolves to a base path", overlays.every((item) => {
        const target = item.getAttribute("href") || "";
        return target.startsWith("#ch02-reverse-wire-") && knownWireIds.has(target.slice("#ch02-reverse-wire-".length)) && document.querySelector(target)?.classList.contains("ch02-reverse-wire");
      }));
      check(name + ": active overlays have no alternate geometry", overlays.every((item) => !item.hasAttribute("d") && !item.hasAttribute("points") && !item.hasAttribute("transform")));
      check(name + ": base geometry remains exact", data.wires.every((wire) => board.querySelector('[data-wire-id="' + wire.wireId + '"]').getAttribute("d") === pathFor(wire)));
      // Flow is now authorized, but never animate the Base/Active layer itself.
      check(name + ": base/active remain static; no teaching artifact", board.querySelectorAll(".current-flow-path, .teaching-highlight, animate, animateTransform, [stroke-dashoffset]").length === 0
        && [...base, ...overlays].every((node) => getComputedStyle(node).animationName === "none"));
      check(name + ": component edge classes mirror Solver", data.components.every((component) => {
        const dom = board.querySelector('[data-component-id="' + component.componentId + '"]');
        const actual = (dom?.dataset.activeEdgeIds || "").split(" ").filter(Boolean);
        const expectedEdges = component.electricalEdgeIds.filter((id) => edgeIds.has(id));
        return JSON.stringify(actual) === JSON.stringify(expectedEdges);
      }));
      return { motor: solver.motorStates.M.state, main: [...main], control: [...control], mainEdges: [...(solver.extension?.activeMainEdgeIds || [])], controlEdges: [...(solver.extension?.activeControlEdgeIds || [])], overlays: overlays.map((item) => item.dataset.wireId) };
    }

    const states = {};
    states.stopped = inspect("stopped");
    check("stopped: no active overlays", states.stopped.overlays.length === 0);
    platformApi.dispatchAction("POWER_CLOSE", {}, "stage3-test");
    states.standby = inspect("standby");
    check("standby: no active main path", states.standby.main.length === 0);
    platformApi.dispatchAction("START_FORWARD_PRESS", { phase: "press" }, "stage3-test");
    states.forwardPressed = inspect("forward pressed");
    check("forward pressed: motor state is forward", states.forwardPressed.motor === "forward");
    check("forward pressed: SB2 NO path is active", states.forwardPressed.control.includes("cw_03") && states.forwardPressed.control.includes("cw_04"));
    check("forward pressed: KI1 self-hold path is not active yet", !states.forwardPressed.control.includes("cw_05") && !states.forwardPressed.control.includes("cw_06"));
    platformApi.dispatchAction("START_FORWARD_PRESS", { phase: "release" }, "stage3-test");
    states.forwardHeld = inspect("forward self-hold");
    check("forward self-hold: auxiliary path is active", states.forwardHeld.control.includes("cw_05") && states.forwardHeld.control.includes("cw_06"));
    check("forward self-hold: SB2 NO path is released", !states.forwardHeld.control.includes("cw_03") && !states.forwardHeld.control.includes("cw_04"));
    check("forward self-hold: SB3 NC path is active", states.forwardHeld.control.includes("cw_07"));
    platformApi.dispatchAction("START_REVERSE_PRESS", { phase: "press" }, "stage3-test");
    states.reversePressed = inspect("reverse pressed");
    check("reverse pressed: motor state is reverse", states.reversePressed.motor === "reverse");
    check("reverse pressed: SB3 NC path opens", !states.reversePressed.control.includes("cw_07"));
    check("reverse pressed: SB2 NC path is active", states.reversePressed.control.includes("cw_15"));
    check("reverse pressed: forward/reverse main paths are exclusive", states.reversePressed.main.includes("mw_16") && !states.reversePressed.main.includes("mw_10"));
    platformApi.dispatchAction("START_REVERSE_PRESS", { phase: "release" }, "stage3-test");
    states.reverseHeld = inspect("reverse self-hold");
    check("reverse self-hold: auxiliary path is active", states.reverseHeld.control.includes("cw_13") && states.reverseHeld.control.includes("cw_14"));
    platformApi.dispatchAction("STOP_PRESS", { phase: "pulse" }, "stage3-test");
    states.stoppedAfterStop = inspect("SB1 stop");
    check("SB1 stop: no stale main overlay", states.stoppedAfterStop.main.length === 0 && states.stoppedAfterStop.overlays.length === 0);
    platformApi.dispatchAction("START_FORWARD_PRESS", { phase: "pulse" }, "stage3-test");
    platformApi.dispatchAction("PROTECTION_TOGGLE", {}, "stage3-test");
    states.overload = inspect("FR1 overload");
    check("FR1 overload: no stale main overlay", states.overload.main.length === 0);
    platformApi.dispatchAction("PROTECTION_RESET", {}, "stage3-test");
    states.reset = inspect("FR1 reset");
    check("FR1 reset: no automatic restart highlight", states.reset.main.length === 0 && states.reset.motor === "stopped");
    return { checks, states, browserErrors: [] };
  });
  assert.deepEqual(report.checks.filter((item) => !item.pass), [], "Active path acceptance failures");
  return { electrical, ...report, passed: report.checks.length };
}

module.exports = { runActivePathChecks };

if (require.main === module) {
  (async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
    const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto((process.env.ECTP_TEST_URL || "http://127.0.0.1:8765") + "/index.html?module=forward-reverse", { waitUntil: "networkidle" });
      const result = await runActivePathChecks(page);
      assert.deepEqual(errors, [], "Browser errors");
      result.browserErrors = errors;
      console.log(JSON.stringify({ passed: result.passed, electricalPassed: result.electrical.passed, combinations: result.electrical.combinations, browserErrors: errors }, null, 2));
    } finally { await browser.close(); }
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
