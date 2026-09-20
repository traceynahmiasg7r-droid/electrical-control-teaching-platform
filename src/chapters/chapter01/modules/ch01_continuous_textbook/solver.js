(function installCh01ContinuousTextbookSolver(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const MODULE_ID = "ch01_continuous";
  const clone = value => JSON.parse(JSON.stringify(value));
  const defaultOperation = () => ({power:"open",buttons:{sb1:"released",sb2:"released"}});
  function createInitialState(seed = {}) {
    return { operationState:{...defaultOperation(),...(seed.operationState || {}),buttons:{...defaultOperation().buttons,...(seed.operationState?.buttons || {})}}, stableDeviceStates:{KM:Boolean(seed.stableDeviceStates?.KM)}, lastAction:clone(seed.lastAction || {type:"reset",message:"供电断开，SB1/SB2 均释放。"}) };
  }
  function data() { const value = platform.moduleCircuitData?.ch01ContinuousTextbook; if (!value) throw new Error("ch01_continuous_textbook circuit.data.js must load before Solver"); return value; }
  function closed(edge,values) { if (edge.kind === "load" || edge.condition === "always") return true; return edge.condition[0] === "!" ? !values[edge.condition.slice(1)] : Boolean(values[edge.condition]); }
  function graph(circuit,values) {
    const adjacency = new Map(); const add = (a,b,id,kind) => {if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push({node:b,id,kind,from:a,to:b});};
    for (const edge of [...circuit.wires,...circuit.deviceEdges.filter(edge => edge.kind !== "load" && closed(edge,values))]) { add(edge.from,edge.to,edge.wireId || edge.edgeId,edge.wireId ? "wire":"device"); add(edge.to,edge.from,edge.wireId || edge.edgeId,edge.wireId ? "wire":"device"); }
    const cache=new Map(); function reachable(from,to){ if(!cache.has(from)){const seen=new Set([from]),q=[from];for(const p of q)for(const e of adjacency.get(p)||[])if(!seen.has(e.node)){seen.add(e.node);q.push(e.node)}cache.set(from,seen)} return cache.get(from).has(to); }
    function paths(from,to){if(!reachable(from,to))return[];const seen=new Set([from]),route=[],union=new Map();function visit(h){if(h===to){route.forEach(e=>union.set(e.id,e));return}for(const e of adjacency.get(h)||[]){if(seen.has(e.node))continue;seen.add(e.node);route.push(e);visit(e.node);route.pop();seen.delete(e.node)}}visit(from);return [...union.values()];}
    return {reachable,paths};
  }
  function solve(inputState) {
    const circuit=data(),state=createInitialState(clone(inputState)),op=state.operationState,values={SB1:op.buttons.sb1==="pressed",SB2:op.buttons.sb2==="pressed",KM:Boolean(state.stableDeviceStates.KM)};
    const coil=circuit.deviceEdges.find(edge=>edge.edgeId==="km_coil"),trace=[],diagnostics=[],power=op.power==="closed";let g,stablePrevious=Boolean(state.stableDeviceStates.KM),iterations=0,converged=false;
    for(;iterations<12;iterations++){
      g=graph(circuit,values);
      // Stop NC is upstream of both start/self-hold branches. A pressed SB2
      // opens the common path and has priority even if SB1 remains held.
      const stopClosed=!values.SB2, fresh=power&&stopClosed&&g.reachable(circuit.supplies.control[0],coil.from)&&g.reachable(coil.to,circuit.supplies.control[1]);
      const self=power&&stopClosed&&values.KM&&g.reachable(circuit.supplies.control[0],coil.from)&&g.reachable(coil.to,circuit.supplies.control[1]);
      const requested=Boolean(fresh||self);
      if(requested===values.KM){converged=true;break}
      values.KM=requested;trace.push({phase:requested?"pickup":"dropout",stableDeviceStates:{KM:requested}});
    }
    if(!converged){values.KM=false;g=graph(circuit,values);diagnostics.push({code:"NO_STABLE_SOLUTION",message:"自锁回路未收敛，停止 KM。"});}
    const prior=stablePrevious;state.stableDeviceStates={KM:values.KM};if(prior!==values.KM&&trace.length===0)trace.push({phase:values.KM?"pickup":"dropout",stableDeviceStates:{KM:values.KM}});
    const activeWires=new Set(),activeEdges=new Set(),loadPaths={};
    const collect=(id,segments,load)=>{const wireIds=[...new Set(segments.filter(e=>e.kind==="wire").map(e=>e.id))],edgeIds=[...new Set(segments.filter(e=>e.kind==="device").map(e=>e.id))];if(load)edgeIds.push(load.edgeId);wireIds.forEach(x=>activeWires.add(x));edgeIds.forEach(x=>activeEdges.add(x));loadPaths[id]={wireIds,edgeIds,segments};};
    const loadPowered=power&&values.KM&&g.reachable(circuit.supplies.control[0],coil.from)&&g.reachable(coil.to,circuit.supplies.control[1]);
    if(loadPowered)collect("km_coil",[...g.paths(circuit.supplies.control[0],coil.from),...g.paths(coil.to,circuit.supplies.control[1])],coil);
    const motor=circuit.components.find(component=>component.type==="motor"),phaseNames=["A","B","C"],phases=motor.geometry.phasePorts.map(port=>power?circuit.supplies.phases.map((source,index)=>g.reachable(source,port)?index:-1).filter(index=>index>=0):[]),running=values.KM&&phases.every(x=>x.length===1)&&new Set(phases.map(x=>x[0])).size===3,sequence=phases.map(x=>x.length===1?phaseNames[x[0]]:null),indices=phases.map(x=>x[0]),positive=running&&(indices[1]-indices[0]+3)%3===1&&(indices[2]-indices[1]+3)%3===1;
    if(running)collect("M",motor.geometry.phasePorts.flatMap((port,index)=>g.paths(circuit.supplies.phases[phases[index][0]],port)));
    if(values.KM&&power&&!running)diagnostics.push({code:"INCOMPLETE_MOTOR_SUPPLY",message:"KM 已吸合，但 M 未获得三个独立相位，电动机保持停止。"});
    const motorStates={M:{running,direction:running?(positive?"forward":"reverse"):"none",phaseSequence:sequence,terminalSources:Object.fromEntries(["U","V","W"].map((name,i)=>[name,phases[i].map(index=>phaseNames[index])]))}};
    const edgeStates=Object.fromEntries(circuit.deviceEdges.map(edge=>[edge.edgeId,{edgeId:edge.edgeId,conductive:closed(edge,values),energized:activeEdges.has(edge.edgeId)}]));
    return {state,solverResult:{schemaVersion:"1.0",moduleId:MODULE_ID,stableDeviceStates:{KM:values.KM},edgeStates,activeMainWireIds:circuit.wires.filter(w=>w.domain==="main"&&activeWires.has(w.wireId)).map(w=>w.wireId),activeControlWireIds:circuit.wires.filter(w=>w.domain!=="main"&&activeWires.has(w.wireId)).map(w=>w.wireId),activeEdgeIds:[...activeEdges],partialWireIds:[],motorStates,protectionStates:{},converged,iterationCount:iterations+1,lastAction:clone(state.lastAction),extension:{activeEdgeIds:[...activeEdges],loadPaths,diagnostics,transitionTrace:trace,supplyConnected:power,pressed:{...op.buttons},assumptions:["教材无 QF、FU 或 FR；按钮及 KM 自锁触点按原图建模。"]}}};
  }
  function reduce(inputState,command,payload={}){const state=createInitialState(clone(inputState)),op=state.operationState;switch(command){case"powerClose":op.power="closed";break;case"powerOpen":op.power="open";break;case"powerToggle":return reduce(state,op.power==="closed"?"powerOpen":"powerClose",payload);case"start":op.buttons.sb1="pressed";break;case"stop":op.buttons.sb2="pressed";break;case"jog":op.buttons.sb1="pressed";break;case"release":if(payload.command==="start"||payload.command==="jog")op.buttons.sb1="released";else if(payload.command==="stop")op.buttons.sb2="released";else {op.buttons.sb1="released";op.buttons.sb2="released";}break;case"reset":return solve(createInitialState()).state;default:throw new Error(`Unknown ch01 continuous command: ${command}`)}state.lastAction={type:command,payload:clone(payload),message:payload.message||command};return solve(state).state;}
  function runTests(){const checks=[],check=(id,pass)=>checks.push({id,pass:Boolean(pass)});let state=createInitialState(),result=solve(state).solverResult;check("initial",!result.stableDeviceStates.KM&&!result.motorStates.M.running);state=reduce(state,"powerClose");result=solve(state).solverResult;check("power only no start",!result.motorStates.M.running);state=reduce(state,"start");result=solve(state).solverResult;check("start",result.motorStates.M.running&&result.motorStates.M.phaseSequence.join(",")==="A,B,C");state=reduce(state,"release",{command:"start"});result=solve(state).solverResult;check("self hold",result.motorStates.M.running&&result.activeEdgeIds.includes("km_self_no"));state=reduce(state,"stop");result=solve(state).solverResult;check("stop priority",!result.motorStates.M.running);state=reduce(state,"release",{command:"stop"});result=solve(state).solverResult;check("stop release with start released no restart",!result.motorStates.M.running);state=reduce(createInitialState(),"start");state=reduce(state,"powerClose");result=solve(state).solverResult;check("held start power restore",result.motorStates.M.running);state=reduce(state,"powerOpen");result=solve(state).solverResult;check("power off drops",!result.motorStates.M.running&&state.operationState.buttons.sb1==="pressed");state=reduce(state,"powerClose");result=solve(state).solverResult;check("power restore held",result.motorStates.M.running);return{passed:checks.every(x=>x.pass),checks};}
  platform.moduleSolvers.ch01ContinuousTextbook=Object.freeze({createInitialState,solve,reduce,defaultOperation,runTests});
})(globalThis);
