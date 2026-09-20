"use strict";

// Source-based electrical regression. These expectations intentionally replace
// the old SB1-start, KT-on-delay, and FR2-stops-every-motor assumptions.
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = globalThis;
const moduleDirectory = path.resolve(__dirname,"..");
for (const file of ["main.geometry.js","circuit.data.js","solver.js"]) require(path.join(moduleDirectory,file));
const solver = ECTPPlatform.moduleSolvers.ch02MachineToolCircuitsV2;
const circuit = ECTPPlatform.moduleCircuitData.ch02MachineToolCircuitsV2;
const checks = [],observed = [];
const wireIds = new Set(circuit.wires.map(wire => wire.wireId));
const edgeIds = new Set(circuit.deviceEdges.map(edge => edge.edgeId));
const check = (name,fn) => {fn();checks.push({name,pass:true});};
function inspect(state) {
  const result = solver.solve(state).solverResult;
  assert.equal(result.converged,true,"contact graph must converge");
  assert.ok(!(result.stableDeviceStates.KM2 && result.stableDeviceStates.KM3));
  assert.ok(!(result.stableDeviceStates.KM4 && result.stableDeviceStates.KM5));
  for (const step of result.extension.transitionTrace) {
    assert.ok(!(step.stableDeviceStates.KM2 && step.stableDeviceStates.KM3));
    assert.ok(!(step.stableDeviceStates.KM4 && step.stableDeviceStates.KM5));
  }
  for (const id of [...result.activeMainWireIds,...result.activeControlWireIds]) assert.ok(wireIds.has(id),`unknown wire ${id}`);
  for (const id of result.activeEdgeIds) {
    assert.ok(edgeIds.has(id),`unknown edge ${id}`);
    assert.equal(result.edgeStates[id].conductive,true,`open active edge ${id}`);
  }
  for (const item of Object.values(result.extension.loadPaths)) {
    item.wireIds.forEach(id => assert.ok(wireIds.has(id)));
    item.edgeIds.forEach(id => assert.ok(edgeIds.has(id)));
  }
  observed.push(result);
  return result;
}
const action = (state,command,payload = {}) => solver.reduce(state,command,payload);
const physicalRest = () => solver.createInitialState();
const clamped = () => action(action(physicalRest(),"powerClose"),"clampLimit");
const release = (state,command) => action(state,"release",{command});
let state,result;

check("source metadata has separate load/source edges and valid supply terminals",() => {
  assert.equal(circuit.validateGeometry().valid,true);
  const ports = new Set(circuit.ports.map(port => port.portId));
  Object.values(circuit.supplies).flat().forEach(port => assert.ok(ports.has(port)));
  assert.equal(circuit.deviceEdges.find(edge => edge.edgeId === "lighting_winding").kind,"source");
  assert.equal(circuit.deviceEdges.find(edge => edge.edgeId === "el").kind,"load");
});
check("default matches drawn NC/NO rest contacts with no debug energization",() => {
  state = physicalRest();result = inspect(state);
  assert.equal(state.operationState.sq3Clamped,false);
  assert.equal(result.activeEdgeIds.length,0);
  assert.equal(result.activeMainWireIds.length + result.activeControlWireIds.length,0);
  for (const id of ["sb1_nc","sb3_nc","sb4_nc","sb5_nc","sb6_nc","sq2_nc","sq3_nc","kt_delay_nc","sq4_nc"]) assert.equal(result.edgeStates[id].conductive,true,id);
  for (const id of ["sb2_no","sb3_no","sb4_no","sb5_no","sb6_no","sq2_no","kt_instant_no","kt_delay_no","sq4_no"]) assert.equal(result.edgeStates[id].conductive,false,id);
});
check("QF closes onto the source's automatic clamp path when SQ3 NC is closed",() => {
  state = action(state,"powerClose");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM5,true);assert.equal(result.stableDeviceStates.YV,true);
  assert.equal(result.motorStates.M3.direction,"clamp");
  for (const id of ["sq3_nc","kt_delay_nc","km4_nc","km5_coil","fr2_nc","sb5_nc","sb6_nc","yv"]) assert.ok(result.activeEdgeIds.includes(id),id);
  assert.ok(!result.activeEdgeIds.includes("sb6_no"));
});
check("SQ3 reached ends automatic clamp and YV, without affecting transformer or normal HL1",() => {
  state = action(state,"clampLimit");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM5,false);assert.equal(result.stableDeviceStates.YV,false);
  assert.equal(result.extension.lamps.HL1,true);assert.equal(result.extension.lamps.HL2,false);
  assert.ok(result.activeEdgeIds.includes("transformer_primary"));
  assert.ok(!result.activeMainWireIds.includes("hydraulic-in-l1"));
});
check("SB2 is start NO and both real parallel feeds conduct while held",() => {
  state = action(state,"spindleStart");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM1,true);
  assert.equal(state.operationState.buttons.sb2,"pressed");
  assert.ok(result.activeEdgeIds.includes("sb2_no"));assert.ok(result.activeEdgeIds.includes("km1_self_no"));
  assert.deepEqual(result.motorStates.M1.phaseSequence,["L1","L2","L3"]);
});
check("releasing SB2 leaves only the electrical KM1 self-hold feed",() => {
  state = release(state,"spindleStart");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM1,true);assert.equal(result.motorStates.M1.running,true);
  assert.ok(!result.activeEdgeIds.includes("sb2_no"));assert.ok(result.activeEdgeIds.includes("km1_self_no"));
  assert.ok(!result.activeControlWireIds.includes("spindle-start-feed"));
  assert.ok(result.activeControlWireIds.includes("spindle-hold-in"));
});
check("SB1 NC stop cannot be bypassed by the self-hold branch",() => {
  state = action(state,"spindleStop");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM1,false);assert.equal(result.edgeStates.sb1_nc.conductive,false);
  state = release(state,"spindleStop");result = inspect(state);
  assert.equal(result.motorStates.M1.running,false);
});
check("FR1 stops self-held KM1; released-start reset does not invent a restart",() => {
  state = release(action(state,"spindleStart"),"spindleStart");
  state = action(state,"fr1Trip");result = inspect(state);
  assert.equal(result.motorStates.M1.running,false);assert.equal(result.edgeStates.fr1_nc.conductive,false);
  assert.equal(result.edgeStates.fr1_main_l1.conductive,true,"thermal heater is not a trip-operated main contact");
  state = action(state,"fr1Reset");result = inspect(state);assert.equal(result.motorStates.M1.running,false);
});
check("SB3 immediately energizes KT and automatic hydraulic loosen before SQ2",() => {
  state = action(clamped(),"rockerUp");result = inspect(state);
  assert.equal(state.operationState.kt,"energized");assert.equal(result.stableDeviceStates.KT,true);
  assert.equal(result.stableDeviceStates.KM4,true);assert.equal(result.stableDeviceStates.KM2,false);
  assert.equal(result.stableDeviceStates.YV,true);assert.equal(result.edgeStates.sb3_nc.conductive,false);
  for (const id of ["sb3_no","sq1_up_nc","sq2_nc","kt_instant_no","km5_nc","km4_coil"]) assert.ok(result.activeEdgeIds.includes(id),id);
  assert.ok(!result.activeEdgeIds.includes("sb5_no"));
  assert.deepEqual(result.motorStates.M3.phaseSequence,["L3","L2","L1"]);
});
check("SQ2 mechanically linked NO/NC transfers from hydraulic pump to M2 up without on-delay",() => {
  state = action(state,"looseLimit");result = inspect(state);
  assert.equal(state.operationState.sq2Loose,true);assert.equal(state.operationState.sq3Clamped,false);
  assert.equal(result.edgeStates.sq2_no.conductive,true);assert.equal(result.edgeStates.sq2_nc.conductive,false);
  assert.equal(result.stableDeviceStates.KM4,false);assert.equal(result.stableDeviceStates.KM2,true);
  assert.equal(result.motorStates.M2.direction,"up");assert.deepEqual(result.motorStates.M2.phaseSequence,["L3","L2","L1"]);
});
check("FR2 does not interrupt an existing SB3/SQ2/KT/M2/YV path",() => {
  state = action(state,"fr2Trip");result = inspect(state);
  assert.equal(state.operationState.buttons.sb3,"pressed");assert.equal(result.motorStates.M2.direction,"up");
  assert.equal(result.stableDeviceStates.KT,true);assert.equal(result.stableDeviceStates.YV,true);
  state = action(state,"fr2Reset");inspect(state);
});
check("release SB3 drops M2 and KT coil but retains the off-delay pair",() => {
  state = release(state,"rockerUp");result = inspect(state);
  assert.equal(result.stableDeviceStates.KT,false);assert.equal(result.stableDeviceStates.KM2,false);
  assert.equal(state.operationState.kt,"timing");assert.equal(result.edgeStates.kt_delay_no.conductive,true);
  assert.equal(result.edgeStates.kt_delay_nc.conductive,false);assert.equal(result.edgeStates.kt_instant_no.conductive,false);
  assert.equal(result.stableDeviceStates.YV,true);assert.equal(result.stableDeviceStates.KM5,false);
});
check("solve is idempotent during off-delay and cannot restart the timer",() => {
  const one = solver.solve(state),two = solver.solve(one.state);
  assert.deepEqual(one.state,two.state);
  for (const key of ["stableDeviceStates","edgeStates","activeEdgeIds","activeMainWireIds","activeControlWireIds","motorStates"]) assert.deepEqual(one.solverResult[key],two.solverResult[key],key);
  assert.equal(two.state.operationState.kt,"timing");
});
check("off-delay completion starts automatic clamp through SQ3 NC",() => {
  state = action(state,"timerComplete");result = inspect(state);
  assert.equal(state.operationState.kt,"idle");assert.equal(result.edgeStates.kt_delay_no.conductive,false);
  assert.equal(result.edgeStates.kt_delay_nc.conductive,true);assert.equal(result.stableDeviceStates.KM5,true);
  assert.equal(result.stableDeviceStates.YV,true);
});
check("FR2 interrupts only the shared KM4/KM5 return; reset restores an unsatisfied automatic clamp",() => {
  state = action(state,"fr2Trip");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM5,false);assert.equal(result.stableDeviceStates.YV,true);
  assert.equal(result.edgeStates.fr2_main_l1.conductive,true);
  state = action(state,"fr2Reset");result = inspect(state);assert.equal(result.stableDeviceStates.KM5,true);
});
check("clampLimit restores the opposite physical SQ2/SQ3 positions",() => {
  state = action(state,"clampLimit");result = inspect(state);
  assert.equal(state.operationState.sq2Loose,false);assert.equal(state.operationState.sq3Clamped,true);
  assert.equal(result.stableDeviceStates.KM5,false);assert.equal(result.stableDeviceStates.YV,false);
});
check("downward sequence uses SB4, SQ1-2, SB3 NC, KM2 NC and normal phase order",() => {
  state = action(action(clamped(),"rockerDown"),"looseLimit");result = inspect(state);
  assert.equal(result.motorStates.M2.direction,"down");assert.deepEqual(result.motorStates.M2.phaseSequence,["L1","L2","L3"]);
  for (const id of ["sb4_no","sq1_down_nc","sb3_nc","km2_nc","km3_coil"]) assert.ok(result.activeEdgeIds.includes(id),id);
  assert.equal(result.edgeStates.sb4_nc.conductive,false);
});
check("lower limit interrupts the held direction request and begins off-delay",() => {
  state = action(state,"lowerLimit");result = inspect(state);
  assert.equal(state.operationState.buttons.sb4,"pressed");assert.equal(result.motorStates.M2.running,false);
  assert.equal(result.stableDeviceStates.KT,false);assert.equal(state.operationState.kt,"timing");
  state = release(state,"rockerDown");state = action(state,"lowerLimit",{value:false});result = inspect(state);
  assert.equal(result.motorStates.M2.running,false,"limit reset cannot recreate a released button");
});
check("upper limit separately interrupts the SB3 branch",() => {
  state = action(action(action(clamped(),"rockerUp"),"looseLimit"),"upperLimit");result = inspect(state);
  assert.equal(result.motorStates.M2.running,false);assert.equal(result.edgeStates.sq1_up_nc.conductive,false);
});
check("pressing both rocker buttons opens both cross-NC contacts and drops M2",() => {
  state = action(action(action(clamped(),"rockerUp"),"looseLimit"),"rockerDown");result = inspect(state);
  assert.equal(result.edgeStates.sb3_nc.conductive,false);assert.equal(result.edgeStates.sb4_nc.conductive,false);
  assert.equal(result.stableDeviceStates.KM2,false);assert.equal(result.stableDeviceStates.KM3,false);
  state = release(state,"rockerUp");result = inspect(state);assert.equal(result.motorStates.M2.direction,"down");
});
check("direct requested reversal records break before make",() => {
  state = action(action(clamped(),"rockerUp"),"looseLimit");
  const changed = structuredClone(state);changed.operationState.buttons.sb3 = "released";changed.operationState.buttons.sb4 = "pressed";
  const solved = solver.solve(changed);result = solved.solverResult;
  assert.equal(result.motorStates.M2.direction,"down");
  const steps = result.extension.transitionTrace;
  assert.ok(steps.findIndex(step => step.phase === "break") >= 0);
  assert.ok(steps.findIndex(step => step.phase === "make" && step.stableDeviceStates.KM3) > steps.findIndex(step => step.phase === "break"));
  inspect(solved.state);
});
check("manual SB5 bypasses SQ2 and opens its mechanically linked valve NC",() => {
  state = solver.createInitialState({operationState:{qf:"closed",sq2Loose:true,sq3Clamped:true}});
  state = action(state,"loosen");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM4,true);assert.equal(result.stableDeviceStates.KT,false);
  assert.equal(result.stableDeviceStates.YV,false);assert.ok(result.activeEdgeIds.includes("sb5_no"));
  assert.ok(!result.activeEdgeIds.includes("sq2_nc"));assert.ok(!result.activeEdgeIds.includes("kt_instant_no"));
  state = release(state,"loosen");result = inspect(state);assert.equal(result.motorStates.M3.running,false);
});
check("manual SB6 bypasses SQ3 but still respects KT delayed NC and valve interlock",() => {
  state = action(clamped(),"clamp");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM5,true);assert.equal(result.stableDeviceStates.YV,false);
  assert.ok(result.activeEdgeIds.includes("sb6_no"));assert.ok(!result.activeEdgeIds.includes("sq3_nc"));
  state = release(state,"clamp");result = inspect(state);assert.equal(result.motorStates.M3.running,false);
  state = action(action(action(clamped(),"rockerUp"),"looseLimit"),"release",{command:"rockerUp"});
  state = action(state,"clamp");result = inspect(state);assert.equal(result.stableDeviceStates.KM5,false,"manual SB6 cannot bypass KT delayed NC");
});
check("simultaneous unlatched hydraulic coil demands are diagnosed without fake cross-NC",() => {
  state = solver.createInitialState({operationState:{qf:"closed",sq3Clamped:true,buttons:{sb5:"pressed",sb6:"pressed"}}});
  result = inspect(state);
  assert.equal(result.stableDeviceStates.KM4,false);assert.equal(result.stableDeviceStates.KM5,false);
  assert.ok(result.extension.diagnostics.some(item => item.code === "SIMULTANEOUS_COIL_DEMAND"));
  assert.equal(result.edgeStates.km4_nc.conductive,true);assert.equal(result.edgeStates.km5_nc.conductive,true);
});
check("existing hydraulic contactor electrically interlocks an opposing manual demand",() => {
  state = action(action(clamped(),"loosen"),"clamp");result = inspect(state);
  assert.equal(result.stableDeviceStates.KM4,true);assert.equal(result.stableDeviceStates.KM5,false);
});
check("SA1 lamp branch has an isolated source and no short across its winding",() => {
  state = action(clamped(),"lighting");result = inspect(state);
  assert.equal(result.extension.lamps.EL,true);
  for (const id of ["sa1","fu3","el","lighting_winding"]) assert.ok(result.activeEdgeIds.includes(id),id);
  state = action(state,"lighting");result = inspect(state);assert.equal(result.extension.lamps.EL,false);
  assert.ok(!result.activeControlWireIds.includes("lighting-el-return"));
});
check("SA2 cooling motor traces its own three phases independently of KM1",() => {
  state = action(clamped(),"coolant");result = inspect(state);
  assert.equal(result.motorStates.M4.running,true);assert.deepEqual(result.motorStates.M4.phaseSequence,["L1","L2","L3"]);
  assert.equal(result.motorStates.M1.running,false);
});
check("SQ4 NC/NO indicator polarity and KM1-run lamp match the source",() => {
  state = clamped();result = inspect(state);assert.equal(result.extension.lamps.HL1,true);assert.equal(result.extension.lamps.HL2,false);
  state = action(state,"indicator");result = inspect(state);assert.equal(result.extension.lamps.HL1,false);assert.equal(result.extension.lamps.HL2,true);
  state = release(action(state,"spindleStart"),"spindleStart");result = inspect(state);assert.equal(result.extension.lamps.HL3,true);
});
check("QF off clears held actions and electrical memory while preserving physical trips and limits",() => {
  state = action(action(state,"fr1Trip"),"fr2Trip");state = action(state,"powerOpen");result = inspect(state);
  assert.equal(state.operationState.fr1,"overload");assert.equal(state.operationState.fr2,"overload");assert.equal(state.operationState.sq3Clamped,true);
  assert.equal(state.operationState.kt,"idle");assert.ok(Object.values(state.operationState.buttons).every(value => value === "released"));
  assert.equal(result.activeEdgeIds.length,0);assert.ok(Object.values(result.motorStates).every(motor => !motor.running));
  state = action(state,"powerClose");result = inspect(state);assert.equal(result.motorStates.M1.running,false);
});
check("scene change releases momentary buttons and preserves actual off-delay transition",() => {
  state = action(action(clamped(),"rockerUp"),"looseLimit");state = action(state,"scene",{scene:"auxiliary"});result = inspect(state);
  assert.equal(state.operationState.scene,"auxiliary");assert.equal(state.operationState.kt,"timing");assert.equal(result.motorStates.M2.running,false);
});
check("a simulated snapshot cannot mutate its input Live state",() => {
  const live = clamped(),before = structuredClone(live);
  action(live,"rockerUp");solver.solve(live);assert.deepEqual(live,before);
});
check("self-hold and all timer phases remain idempotent across repeated solve calls",() => {
  const selfHeld = release(action(clamped(),"spindleStart"),"spindleStart");
  const energized = action(action(clamped(),"rockerUp"),"looseLimit");
  const timing = release(energized,"rockerUp");
  const idle = action(timing,"timerComplete");
  for (const initial of [selfHeld,energized,timing,idle]) {
    let prior = solver.solve(initial);
    for (let n = 0;n < 4;n += 1) {
      const next = solver.solve(prior.state);
      assert.deepEqual(next.state,prior.state);
      for (const key of ["stableDeviceStates","edgeStates","activeEdgeIds","activeMainWireIds","activeControlWireIds","motorStates"]) assert.deepEqual(next.solverResult[key],prior.solverResult[key],key);
      prior = next;
    }
  }
});
check("64 button combinations x 4 thermal states x 12 limit states preserve electrical invariants",() => {
  for (let mask = 0;mask < 64;mask += 1) for (const fr1 of ["normal","overload"]) for (const fr2 of ["normal","overload"])
    for (const sq2Loose of [false,true]) for (const sq3Clamped of [false,true]) for (const limit of ["none","upper","lower"]) {
    const buttons = Object.fromEntries(["sb1","sb2","sb3","sb4","sb5","sb6"].map((id,index) => [id,mask & (1 << index) ? "pressed" : "released"]));
    const trial = solver.createInitialState({operationState:{qf:"closed",fr1,fr2,sq2Loose,sq3Clamped,sq1Upper:limit === "upper",sq1Lower:limit === "lower",buttons}});
    const measured = inspect(trial);
    for (const n of [3,4,5,6]) assert.notEqual(measured.edgeStates[`sb${n}_no`].conductive,measured.edgeStates[`sb${n}_nc`].conductive);
    if (fr1 === "overload") assert.equal(measured.stableDeviceStates.KM1,false);
    if (fr2 === "overload") {assert.equal(measured.stableDeviceStates.KM4,false);assert.equal(measured.stableDeviceStates.KM5,false);}
    const solved = solver.solve(trial),again = solver.solve(solved.state);
    assert.deepEqual(solved.state,again.state,"stable state must remain stable on re-solve");
  }
});
check("module's public runTests API retains its original result contract",() => {
  const selfTest = solver.runTests();assert.equal(selfTest.passed,true);assert.ok(selfTest.checks.length >= 16);
});

console.log(JSON.stringify({passed:true,checks:checks.length,observedStates:observed.length,sourceCorrections:[
  "SB1 is stop NC and SB2 is start NO",
  "KT is off-delay; SQ2 directly enables held rocker motion",
  "FR2 protects KM4/KM5 return only, not KM2/KM3/KT/YV",
  "SQ3 NC automatically clamps on power and after FR2 reset until position reached"
],results:checks},null,2));
