(function installCh01JogTextbookSolver(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const MODULE_ID = "ch01_jog";
  const clone = value => JSON.parse(JSON.stringify(value));
  const defaultOperation = () => ({power:"open",buttons:{sb1:"released"}});
  function createInitialState(seed = {}) {
    return {
      operationState:{...defaultOperation(),...(seed.operationState || {}),buttons:{sb1:"released",...(seed.operationState?.buttons || {})}},
      stableDeviceStates:{KM:Boolean(seed.stableDeviceStates?.KM)},
      lastAction:clone(seed.lastAction || {type:"reset",message:"供电断开，SB1 释放；教材图没有自锁支路。"})
    };
  }
  function circuitData() {
    const data = platform.moduleCircuitData?.ch01JogTextbook;
    if (!data) throw new Error("ch01_jog_textbook circuit.data.js must load before Solver");
    return data;
  }
  function conductive(edge,values) {
    if (edge.kind === "load" || edge.kind === "source" || edge.condition === "always") return true;
    return edge.condition[0] === "!" ? !values[edge.condition.slice(1)] : Boolean(values[edge.condition]);
  }
  function makeGraph(data,values) {
    // Source A appears in both panels. Its shared electrical identity does not
    // add a visual wire between panels or invent an off-drawing switch.
    const nodes = new Map(data.ports.map(port => [port.portId,port.electricalNodeId || port.portId]));
    const node = port => nodes.get(port) || port, adjacency = new Map();
    function add(from,to,id,kind) {
      if (!adjacency.has(node(from))) adjacency.set(node(from),[]);
      adjacency.get(node(from)).push({from,to,node:node(to),id,kind});
    }
    for (const edge of [...data.wires,...data.deviceEdges.filter(edge => edge.kind !== "load" && edge.kind !== "source" && conductive(edge,values))]) {
      const id = edge.wireId || edge.edgeId,kind = edge.wireId ? "wire" : "device";
      add(edge.from,edge.to,id,kind);add(edge.to,edge.from,id,kind);
    }
    const cache = new Map();
    function reachable(from,to) {
      const start = node(from);
      if (!cache.has(start)) {
        const seen = new Set([start]),queue = [start];
        for (const here of queue) for (const edge of adjacency.get(here) || []) {
          if (!seen.has(edge.node)) {seen.add(edge.node);queue.push(edge.node);}
        }
        cache.set(start,seen);
      }
      return cache.get(start).has(node(to));
    }
    function paths(from,to) {
      if (!reachable(from,to)) return [];
      const end = node(to),seen = new Set([node(from)]),route = [],union = new Map();
      function visit(here) {
        if (here === end) {route.forEach(edge => union.set(edge.id,edge));return;}
        for (const edge of adjacency.get(here) || []) {
          if (seen.has(edge.node)) continue;
          seen.add(edge.node);route.push(edge);visit(edge.node);route.pop();seen.delete(edge.node);
        }
      }
      visit(node(from));return [...union.values()].map(({id,kind,from:a,to:b}) => ({id,kind,from:a,to:b}));
    }
    return {reachable,paths};
  }
  function solve(inputState) {
    const data = circuitData(),state = createInitialState(clone(inputState)),op = state.operationState;
    const coil = data.deviceEdges.find(edge => edge.edgeId === "km_coil");
    const values = {SB1:op.buttons.sb1 === "pressed",KM:false};
    let graph = makeGraph(data,values),converged = false,iterationCount = 0;
    const transitionTrace = [],diagnostics = [],power = op.power === "closed";
    for (;iterationCount < 8;iterationCount += 1) {
      const requested = power && !graph.reachable(data.supplies.control[0],data.supplies.control[1]) &&
        graph.reachable(data.supplies.control[0],coil.from) && graph.reachable(coil.to,data.supplies.control[1]);
      if (requested === values.KM) {converged = true;break;}
      values.KM = requested;
      graph = makeGraph(data,values);
    }
    if (!converged) {values.KM = false;graph = makeGraph(data,values);diagnostics.push({code:"NO_STABLE_SOLUTION",message:"电路未收敛，停止执行元件。"});}
    if (state.stableDeviceStates.KM !== values.KM) transitionTrace.push({phase:values.KM ? "pickup" : "dropout",stableDeviceStates:{KM:values.KM}});
    state.stableDeviceStates = {KM:values.KM};
    const activeWires = new Set(),activeEdges = new Set(),loadPaths = {};
    function collect(id,segments,loadEdge = null) {
      const wireIds = [...new Set(segments.filter(edge => edge.kind === "wire").map(edge => edge.id))];
      const edgeIds = [...new Set(segments.filter(edge => edge.kind === "device").map(edge => edge.id))];
      if (loadEdge) edgeIds.push(loadEdge.edgeId);
      wireIds.forEach(wire => activeWires.add(wire));edgeIds.forEach(edge => activeEdges.add(edge));
      loadPaths[id] = {wireIds,edgeIds,segments};
    }
    if (values.KM) collect("km_coil",[
      ...graph.paths(data.supplies.control[0],coil.from),...graph.paths(coil.to,data.supplies.control[1])
    ],coil);
    const motor = data.components.find(component => component.type === "motor");
    const phases = motor.geometry.phasePorts.map(port => power ? data.supplies.phases.map((source,index) => graph.reachable(source,port) ? index : -1).filter(index => index >= 0) : []);
    const running = phases.every(phase => phase.length === 1) && new Set(phases.map(phase => phase[0])).size === 3;
    const phaseNames = ["A","B","C"],phaseSequence = phases.map(phase => phase.length === 1 ? phaseNames[phase[0]] : null);
    const positive = running && (phases[1][0] - phases[0][0] + 3) % 3 === 1 && (phases[2][0] - phases[1][0] + 3) % 3 === 1;
    if (running) collect("M",motor.geometry.phasePorts.flatMap((port,index) => graph.paths(data.supplies.phases[phases[index][0]],port)));
    if (power && values.KM && !running) diagnostics.push({code:phases.some(phase => phase.length > 1) ? "PHASE_SHORT" : "INCOMPLETE_MOTOR_SUPPLY",message:"KM 已吸合，但电机端子未获得三个独立相位；不演示正常运转。"});
    const motorStates = {M:{running,direction:running ? (positive ? "forward" : "reverse") : "none",phaseSequence,
      terminalSources:Object.fromEntries(["U","V","W"].map((terminal,index) => [terminal,phases[index].map(phase => phaseNames[phase])]))}};
    const edgeStates = Object.fromEntries(data.deviceEdges.map(edge => [edge.edgeId,{
      edgeId:edge.edgeId,conductive:conductive(edge,values),energized:activeEdges.has(edge.edgeId)
    }]));
    const activeMainWireIds = data.wires.filter(wire => wire.domain === "main" && activeWires.has(wire.wireId)).map(wire => wire.wireId);
    const activeControlWireIds = data.wires.filter(wire => wire.domain !== "main" && activeWires.has(wire.wireId)).map(wire => wire.wireId);
    return {state,solverResult:{
      schemaVersion:"1.0",moduleId:MODULE_ID,stableDeviceStates:{KM:values.KM},edgeStates,
      activeMainWireIds,activeControlWireIds,activeEdgeIds:[...activeEdges],partialWireIds:[],motorStates,protectionStates:{},converged,iterationCount:iterationCount + 1,
      lastAction:clone(state.lastAction),extension:{activeEdgeIds:[...activeEdges],loadPaths,diagnostics,transitionTrace,
        supplyConnected:power,pressed:{sb1:values.SB1},assumptions:["电源接通/断开是供电条件；教材图没有 QF、FR、熔断器或自锁触点。"]}
    }};
  }
  function reduce(inputState,command,payload = {}) {
    const state = createInitialState(clone(inputState)),op = state.operationState;
    switch (command) {
      case "powerClose": op.power = "closed";break;
      case "powerOpen": op.power = "open";break;
      case "powerToggle": return reduce(state,op.power === "closed" ? "powerOpen" : "powerClose",payload);
      case "jog": op.buttons.sb1 = "pressed";break;
      case "release": op.buttons.sb1 = "released";break;
      case "reset": return solve(createInitialState()).state;
      default: throw new Error(`Unknown ch01 jog command: ${command}`);
    }
    state.lastAction = {type:command,payload:clone(payload),message:payload.message || command};
    return solve(state).state;
  }
  function runTests() {
    const checks = [],check = (id,pass) => checks.push({id,pass:Boolean(pass)});
    let state = createInitialState(),result = solve(state).solverResult;
    check("初始 SB1 与主触点断开",!result.edgeStates.sb1_no.conductive && !result.stableDeviceStates.KM && !result.activeEdgeIds.length);
    state = reduce(state,"powerClose");result = solve(state).solverResult;
    check("接通电源不等于启动",!result.motorStates.M.running && !result.activeEdgeIds.length);
    state = reduce(state,"jog");result = solve(state).solverResult;
    check("按住 SB1 驱动 KM 和 M",result.stableDeviceStates.KM && result.motorStates.M.running && result.activeMainWireIds.length === 6 && result.activeControlWireIds.length === 3);
    check("三相实际对应 A B C",result.motorStates.M.phaseSequence.join(",") === "A,B,C");
    state = reduce(state,"release");result = solve(state).solverResult;
    check("松开立即停止且无自锁",!result.stableDeviceStates.KM && !result.motorStates.M.running && !result.activeEdgeIds.length);
    state = reduce(createInitialState(),"jog");result = solve(state).solverResult;
    check("无供电时按钮可机械按下但线圈不得电",result.edgeStates.sb1_no.conductive && !result.stableDeviceStates.KM);
    state = reduce(state,"powerClose");result = solve(state).solverResult;
    check("真实按住时恢复供电即启动",result.stableDeviceStates.KM && result.motorStates.M.running);
    return {passed:checks.every(item => item.pass),checks};
  }
  platform.moduleSolvers.ch01JogTextbook = Object.freeze({createInitialState,solve,reduce,defaultOperation,runTests});
})(globalThis);
