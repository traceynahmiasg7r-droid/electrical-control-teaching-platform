"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = globalThis;
const folder = path.resolve(__dirname,"..");
require(path.join(folder,"circuit.data.js"));
require(path.join(folder,"solver.js"));
const data = ECTPPlatform.moduleCircuitData.ch01JogTextbook;
const solver = ECTPPlatform.moduleSolvers.ch01JogTextbook;
const results = [],observed = [];
const check = (name,fn) => {fn();results.push({name,pass:true});};
const step = (state,command,payload = {}) => solver.reduce(state,command,payload);
function inspect(state) {
  const {solverResult:r} = solver.solve(state);
  assert.equal(r.moduleId,"ch01_jog");assert.equal(r.converged,true);
  const knownWires = new Set(data.wires.map(wire => wire.wireId)),knownEdges = new Set(data.deviceEdges.map(edge => edge.edgeId));
  for (const id of [...r.activeMainWireIds,...r.activeControlWireIds]) assert.ok(knownWires.has(id),`unknown active wire ${id}`);
  for (const id of r.activeEdgeIds) {assert.ok(knownEdges.has(id),`unknown active edge ${id}`);assert.equal(r.edgeStates[id].conductive,true,`open active edge ${id}`);}
  assert.ok(!Object.keys(r.protectionStates).length,"the source contains no protection device");
  observed.push(r);return r;
}
function withMissingWire(id,fn) {
  const index = data.wires.findIndex(wire => wire.wireId === id);
  assert.ok(index >= 0);
  const [wire] = data.wires.splice(index,1);
  try {fn();} finally {data.wires.splice(index,0,wire);}
}
const initial = () => solver.createInitialState();
const running = () => step(step(initial(),"powerClose"),"jog");
let state,result;

check("geometry contains only the four source components and no invented QF/FR/fuse/self-hold",() => {
  assert.deepEqual(data.components.map(component => component.componentId).sort(),["km_coil","km_main","motor","sb1"]);
  assert.equal(data.deviceEdges.length,5);assert.equal(data.wires.length,9);
  assert.equal(data.junctions.length,0);assert.equal(data.crossings.length,0);
  assert.equal(data.ports.find(port => port.portId === "src_a").electricalNodeId,"phase:A");
  assert.equal(data.ports.find(port => port.portId === "control_a").electricalNodeId,"phase:A");
  assert.equal(data.validateGeometry().valid,true);
});
check("initial released state has no current paths and all three main contacts open",() => {
  state = initial();result = inspect(state);
  assert.equal(result.stableDeviceStates.KM,false);assert.equal(result.motorStates.M.running,false);
  assert.equal(result.edgeStates.sb1_no.conductive,false);assert.equal(result.edgeStates.km_coil.conductive,true);
  assert.equal(result.edgeStates.km_coil.energized,false);
  for (const id of ["km_main_a","km_main_b","km_main_c"]) assert.equal(result.edgeStates[id].conductive,false);
  assert.deepEqual(result.activeEdgeIds,[]);
});
check("supply connected with SB1 released is not a start command",() => {
  state = step(state,"powerClose");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM,false);assert.equal(result.activeMainWireIds.length,0);assert.equal(result.activeControlWireIds.length,0);
});
check("press gives SB1→KM coil→three KM poles→ABC motor phase sequence",() => {
  state = step(state,"jog");result = inspect(state);
  assert.equal(result.edgeStates.sb1_no.conductive,true);assert.equal(result.stableDeviceStates.KM,true);
  assert.equal(result.motorStates.M.running,true);assert.equal(result.motorStates.M.direction,"forward");
  assert.deepEqual(result.motorStates.M.phaseSequence,["A","B","C"]);
  assert.equal(result.activeMainWireIds.length,6);assert.equal(result.activeControlWireIds.length,3);
  assert.deepEqual(new Set(result.activeEdgeIds),new Set(["sb1_no","km_coil","km_main_a","km_main_b","km_main_c"]));
});
check("release drops KM and M immediately; a forged previous KM state cannot latch",() => {
  state = step(state,"release",{command:"jog"});result = inspect(state);
  assert.equal(result.stableDeviceStates.KM,false);assert.equal(result.motorStates.M.running,false);assert.deepEqual(result.activeEdgeIds,[]);
  const forged = solver.createInitialState({operationState:{power:"closed"},stableDeviceStates:{KM:true}});
  result = inspect(forged);assert.equal(result.stableDeviceStates.KM,false);
});
check("physical button can be held with supply off and starts when supply becomes available",() => {
  state = step(initial(),"jog");result = inspect(state);
  assert.equal(state.operationState.buttons.sb1,"pressed");assert.equal(result.edgeStates.sb1_no.conductive,true);assert.equal(result.stableDeviceStates.KM,false);
  state = step(state,"powerClose");result = inspect(state);assert.equal(result.motorStates.M.running,true);
});
check("supply interruption retains the held physical button, and restoration immediately resumes",() => {
  state = step(state,"powerOpen");result = inspect(state);
  assert.equal(state.operationState.buttons.sb1,"pressed");assert.equal(result.edgeStates.sb1_no.conductive,true);assert.equal(result.motorStates.M.running,false);
  assert.equal(result.activeEdgeIds.length,0);
  state = step(state,"powerClose");result = inspect(state);assert.equal(result.motorStates.M.running,true);
});
check("release during a power interruption prevents any restart on restoration",() => {
  state = step(step(step(state,"powerOpen"),"release"),"powerClose");result = inspect(state);
  assert.equal(state.operationState.buttons.sb1,"released");assert.equal(result.motorStates.M.running,false);
});
check("reset separately clears button ownership and supply state",() => {
  state = step(running(),"reset");result = inspect(state);
  assert.equal(state.operationState.power,"open");assert.equal(state.operationState.buttons.sb1,"released");assert.equal(result.activeEdgeIds.length,0);
});
check("disconnected control feed or return prevents coil pickup despite a held button",() => {
  for (const id of ["control-start-feed","control-coil-feed","control-coil-return"]) withMissingWire(id,() => {
    const interrupted = solver.solve(running());result = inspect(interrupted.state);
    assert.equal(result.stableDeviceStates.KM,false);assert.equal(result.motorStates.M.running,false);
    assert.equal(result.activeEdgeIds.length,0);
  });
});
check("each missing motor phase prevents normal rotation despite an energized KM coil",() => {
  const live = running();
  for (const phase of ["a","b","c"]) withMissingWire(`phase-${phase}-motor`,() => {
    result = inspect(live);
    assert.equal(result.stableDeviceStates.KM,true);assert.equal(result.motorStates.M.running,false);
    assert.ok(result.extension.diagnostics.some(item => item.code === "INCOMPLETE_MOTOR_SUPPLY"));
    assert.equal(result.activeMainWireIds.length,0,"partial phase supply is not a proven three-phase motor current path");
    assert.equal(result.activeControlWireIds.length,3);
  });
});
check("motor direction is obtained from graph phase paths rather than copied from KM",() => {
  const a = data.wires.find(wire => wire.wireId === "phase-a-motor"),c = data.wires.find(wire => wire.wireId === "phase-c-motor");
  const aTarget = a.to,cTarget = c.to;
  try {
    a.to = cTarget;c.to = aTarget;
    result = inspect(running());
    assert.equal(result.stableDeviceStates.KM,true);assert.equal(result.motorStates.M.direction,"reverse");
    assert.deepEqual(result.motorStates.M.phaseSequence,["C","B","A"]);
  } finally {a.to = aTarget;c.to = cTarget;}
});
check("neither alias A source nor free-ended source-bar symbols produce invented active IDs",() => {
  result = inspect(running());
  const used = [...result.activeMainWireIds,...result.activeControlWireIds,...result.activeEdgeIds];
  assert.ok(used.every(id => !id.includes("symbol") && !id.includes("virtual") && !id.includes("qf")));
  const traced = new Set(Object.values(result.extension.loadPaths).flatMap(load => load.wireIds));
  assert.deepEqual(traced,new Set([...result.activeMainWireIds,...result.activeControlWireIds]));
});
check("successive action state trace follows true momentary behavior",() => {
  const commands = ["powerClose","jog","release","jog","powerOpen","powerClose","release","powerToggle","jog","release"];
  const expected = [false,true,false,true,false,true,false,false,false,false];
  state = initial();
  commands.forEach((command,index) => {state = step(state,command);result = inspect(state);assert.equal(result.motorStates.M.running,expected[index],`${index}:${command}`);});
});
check("repeated solves preserve the derived state and cannot invent an electrical latch",() => {
  for (const power of ["open","closed"]) for (const sb1 of ["released","pressed"]) {
    const before = solver.createInitialState({operationState:{power,buttons:{sb1}}}),copy = structuredClone(before);
    const first = solver.solve(before),second = solver.solve(first.state);
    assert.deepEqual(before,copy);assert.deepEqual(first.state,second.state);
    for (const key of ["stableDeviceStates","edgeStates","motorStates","activeEdgeIds","activeMainWireIds","activeControlWireIds"]) assert.deepEqual(first.solverResult[key],second.solverResult[key],key);
    inspect(second.state);
  }
});
check("public self-test keeps the expected contract",() => {
  const report = solver.runTests();assert.equal(report.passed,true);assert.ok(report.checks.length >= 7);
});
console.log(JSON.stringify({passed:true,checks:results.length,observedStates:observed.length,results},null,2));
