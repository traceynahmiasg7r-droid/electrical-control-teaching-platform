"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function assertFrozenGeometry() {
  require("../circuit.data.js");
  const data = globalThis.ECTPPlatform.moduleCircuitData.ch02Reverse;
  const staticGeometry = {
    viewBox: data.viewBox, ports: data.ports.map(({ portId, x, y, electricalPortId }) => ({ portId, x, y, electricalPortId })),
    wires: data.wires.map(({ wireId, electricalWireIds, fromPort, toPort, points }) => ({ wireId, electricalWireIds, fromPort, toPort, points })),
    components: data.components.map(({ componentId, type, portIds, geometry }) => ({ componentId, type, portIds, geometry })),
    labels: data.labels, junctions: data.junctions, crossings: data.crossings, mechanicalLinks: data.mechanicalLinks
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(staticGeometry)).digest("hex");
  assert.equal(hash, "248befb2c0522e4f72bb9574baa50b0cd3afd195a8a069bd40617e1b28ffb018", "Stage 1 geometry coordinates or topology moved");
  return hash;
}

async function runElectricalChecks(page) {
  const geometryHash = assertFrozenGeometry();
  const report = await page.evaluate(() => {
    const checks = [];
    const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
    const off = { ki1: false, ki2: false };
    const forward = { ki1: true, ki2: false };
    const reverse = { ki1: false, ki2: true };
    let op, coils;
    function reset() {
      op = { qf1: "closed", sb1: "released", sb2: "released", sb3: "released", fr1: "normal" };
      coils = { ...off };
    }
    function step(name, patch, expectedMotor) {
      Object.assign(op, patch);
      const control = solveControlCircuit(op, coils);
      const main = solveMainCircuit(control.edgeStates);
      coils = { ...control.coils };
      check(name, control.converged && main.motorState === expectedMotor);
      check(name + ": no double energization", control.iterationTrace.every((s) => !(s.after.ki1 && s.after.ki2)));
      for (const key of ["sb2", "sb3"]) {
        check(name + ": " + key + " linked NO/NC", control.edgeStates["edge_" + key + "_no"].conductive === (op[key] === "pressed")
          && control.edgeStates["edge_" + key + "_nc"].conductive === (op[key] === "released"));
      }
      for (const key of ["ki1", "ki2"]) {
        check(name + ": " + key + " contact linkage", ["main_a", "main_b", "main_c", "self_no"].every((suffix) => control.edgeStates["edge_" + key + "_" + suffix].conductive === coils[key])
          && control.edgeStates["edge_" + key + "_interlock_nc"].conductive === !coils[key]);
      }
      return { control, main };
    }
    reset();
    step("QF open", { qf1: "open" }, "stopped");
    step("standby", { qf1: "closed" }, "stopped");
    step("forward start", { sb2: "pressed" }, "forward");
    step("forward self hold", { sb2: "released" }, "forward");
    const toReverse = step("forward to reverse held", { sb3: "pressed" }, "reverse");
    check("forward reversal break before make", JSON.stringify(toReverse.control.iterationTrace.map((s) => s.after)) === JSON.stringify([off, reverse, reverse]));
    step("reverse self hold", { sb3: "released" }, "reverse");
    const toForward = step("reverse to forward held", { sb2: "pressed" }, "forward");
    check("reverse reversal break before make", JSON.stringify(toForward.control.iterationTrace.map((s) => s.after)) === JSON.stringify([off, forward, forward]));
    step("forward release after reversal", { sb2: "released" }, "forward");
    step("forward repeat start is not stop", { sb2: "pressed" }, "forward");
    step("both buttons pressed", { sb3: "pressed" }, "stopped");
    step("only reverse remains held", { sb2: "released" }, "reverse");
    step("reverse repeat release", { sb3: "released" }, "reverse");
    for (const [button, motor] of [["sb2", "forward"], ["sb3", "reverse"]]) {
      reset();
      step(motor + " initial", { [button]: "pressed" }, motor);
      step(motor + " hold", { [button]: "released" }, motor);
      step(motor + " SB1 stop", { sb1: "pressed" }, "stopped");
      step(motor + " SB1 release", { sb1: "released" }, "stopped");
      step(motor + " restart", { [button]: "pressed" }, motor);
      step(motor + " restart release", { [button]: "released" }, motor);
      step(motor + " overload", { fr1: "overload" }, "stopped");
      step(motor + " overload SB2 blocked", { sb2: "pressed" }, "stopped");
      step(motor + " overload SB3 blocked", { sb2: "released", sb3: "pressed" }, "stopped");
      step(motor + " overload buttons released", { sb3: "released" }, "stopped");
      step(motor + " reset no restart", { fr1: "normal" }, "stopped");
      step(motor + " fresh start after reset", { [button]: "pressed" }, motor);
      step(motor + " power removed", { qf1: "open" }, "stopped");
    }
    reset();
    const energizedEdges = computeDeviceEdgeStates({ ...op, sb2: "pressed" }, forward);
    for (const [edgeId, span, target] of [["edge_sb3_nc", "cw_07", "coil_ki1_l"], ["edge_sb2_nc", "cw_15", "coil_ki2_l"]]) {
      const adjacency = buildElectricalGraph({ wireFilter: () => true, edgeFilter: (e) => e.edgeId !== edgeId && ["supply", "control"].includes(e.domain) });
      check(edgeId + ": no bypass even if all other contacts closed", !collectReachableNodes(adjacency, getPortCoordKey(CONTROL_SUPPLY_SOURCE_PORT)).has(getPortCoordKey(target)));
      check(span + ": no unconditional wire", [...adjacency.values()].flat().every((n) => n.item.type !== "wire" || n.item.wireId !== span));
    }
    let combinations = 0;
    for (const qf1 of ["open", "closed"]) for (const sb1 of ["released", "pressed"]) for (const sb2 of ["released", "pressed"]) for (const sb3 of ["released", "pressed"]) for (const fr1 of ["normal", "overload"]) for (const previous of [off, forward, reverse]) {
      const c = solveControlCircuit({ qf1, sb1, sb2, sb3, fr1 }, previous);
      check("state combination " + (++combinations), c.converged && c.iterationTrace.every((s) => !(s.after.ki1 && s.after.ki2)));
    }
    const legacy = runSolverTests();
    check("updated legacy 14/14", legacy.length === 14 && legacy.every((t) => t.pass));
    return { checks, combinations, legacy, reversalTraces: { toReverse: toReverse.control.iterationTrace, toForward: toForward.control.iterationTrace } };
  });
  assert.deepEqual(report.checks.filter((c) => !c.pass), [], "Electrical acceptance failures");
  return { geometryHash, ...report, passed: report.checks.length };
}

module.exports = { assertFrozenGeometry, runElectricalChecks };
if (require.main === module) {
  (async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
    const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      await page.goto((process.env.ECTP_TEST_URL || "http://127.0.0.1:8765") + "/index.html?module=forward-reverse", { waitUntil: "networkidle" });
      const result = await runElectricalChecks(page);
      console.log(JSON.stringify({ passed: result.passed, combinations: result.combinations, geometryHash: result.geometryHash, reversalTraces: result.reversalTraces }, null, 2));
    } finally { await browser.close(); }
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
