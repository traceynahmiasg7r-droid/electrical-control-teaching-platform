"use strict";
// Run: node src/chapters/chapter02/modules/ch02_reverse/tests/geometry.acceptance.js
const assert = require("node:assert/strict");
require("../circuit.data.js");
const data = globalThis.ECTPPlatform.moduleCircuitData.ch02Reverse;
const clone = () => JSON.parse(JSON.stringify(data));
assert.deepEqual(data.validateGeometry(), { valid: true, errors: [] });

function rejected(change, message) {
  const broken = clone();
  change(broken);
  assert.equal(data.validateGeometry(broken).valid, false, message);
}
rejected((d) => { d.wires[0].points[0].x += 1; }, "detached wire endpoint must fail");
rejected((d) => { d.wires[0].toPort = "undefined"; }, "missing port must fail");
rejected((d) => { d.wires[0].wireId = d.wires[1].wireId; }, "duplicate wire ID must fail");
rejected((d) => { d.crossings[0].x += 1; }, "crossing must lie on both wires");
rejected((d) => { d.crossings[0].electricallyConnected = true; }, "crossing cannot be conductive");
rejected((d) => { d.junctions[0].y += 1; }, "junction must lie on its node");
rejected((d) => { d.wires[0].electricalWireIds = ["invented_wire"]; }, "invented Solver wire must fail");
rejected((d) => { d.wires = d.wires.filter((w) => w.wireId !== "motor_u"); }, "dangling motor port must fail");

const byId = new Map(data.ports.map((p) => [p.portId, p]));
const motor = data.components.find((c) => c.componentId === "motor");
motor.portIds.forEach((id) => {
  const p = byId.get(id), g = motor.geometry;
  assert.ok(Math.abs(((p.x - g.cx) / g.rx) ** 2 + ((p.y - g.cy) / g.ry) ** 2 - 1) < 1e-9, id + " must meet motor outline");
});
[["ki2_a_to_w2", "term_w2"], ["ki2_b_to_v2", "term_v2"], ["ki2_c_to_u2", "term_u2"]].forEach(([wireId, target]) => {
  assert.equal(data.wires.find((w) => w.wireId === wireId).toPort, target);
});
assert.deepEqual(data.wires.find((w) => w.wireId === "fr1_return").points.slice(1, -1), [
  { x: 1423, y: 244 }, { x: 1423, y: 429 }, { x: 464, y: 429 }, { x: 464, y: 199 }
]);
assert.equal(data.crossings.length, 7, "include FU2 return / L3 non-connection");
assert.deepEqual(data.components.filter((c) => c.componentId === "sb3_nc" || c.componentId === "sb2_nc").map((c) => c.electricalEdgeIds), [["edge_sb3_nc"], ["edge_sb2_nc"]]);
assert.equal(Object.isFrozen(data.wires[0].points), true);
console.log("Geometry acceptance passed: endpoints, dangling ports, mapping coverage, junctions, crossings, U/V/W, motor outline and FR1 return.");
