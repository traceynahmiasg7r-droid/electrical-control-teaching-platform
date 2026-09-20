(function installMachineToolV2Solver(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleSolvers = platform.moduleSolvers || {};
  const MODULE_ID = "ch02_machine_tool_circuits_v2";
  const clone = value => JSON.parse(JSON.stringify(value));
  const buttonIds = ["sb1", "sb2", "sb3", "sb4", "sb5", "sb6"];
  const buttonCommands = Object.freeze({spindleStop:"sb1",spindleStart:"sb2",rockerUp:"sb3",rockerDown:"sb4",loosen:"sb5",clamp:"sb6"});
  const coilNames = ["KM1","KM2","KM3","KM4","KM5","KT","YV"];
  const emptyStable = () => Object.fromEntries(coilNames.map(id => [id,false]));
  const releasedButtons = () => Object.fromEntries(buttonIds.map(id => [id,"released"]));
  const defaultOperation = () => ({
    qf:"open",scene:"spindle",coolant:false,sa1:false,fr1:"normal",fr2:"normal",
    sq1Upper:false,sq1Lower:false,sq2Loose:false,sq3Clamped:false,sq4:"normal",kt:"idle",buttons:releasedButtons()
  });
  function createInitialState(seed = {}) {
    return {
      operationState:{...defaultOperation(),...(seed.operationState || {}),buttons:{...releasedButtons(),...(seed.operationState?.buttons || {})}},
      stableDeviceStates:{...emptyStable(),...(seed.stableDeviceStates || {})},
      lastAction:clone(seed.lastAction || {type:"reset",message:"教材常态：QF 分闸，按钮释放，SQ3 未动作"})
    };
  }
  function data() {
    const value = platform.moduleCircuitData?.ch02MachineToolCircuitsV2;
    if (!value) throw new Error("Z3040 circuit.data.js must load before its Solver");
    return value;
  }
  function conditionValues(op,stable) {
    const values = {...stable,QF:op.qf === "closed",SA1:op.sa1,SA2:op.coolant,
      FR1:op.fr1 !== "normal",FR2:op.fr2 !== "normal",SQ1_UP:op.sq1Upper,SQ1_DOWN:op.sq1Lower,SQ2:op.sq2Loose,SQ3:op.sq3Clamped,
      SQ4:op.sq4 === "upper",KT_HOLD:stable.KT || op.kt === "energized" || op.kt === "timing"};
    buttonIds.forEach(id => {values[id.toUpperCase()] = op.buttons[id] === "pressed";});
    return values;
  }
  function isClosed(condition,values) {
    if (condition === "always") return true;
    return condition[0] === "!" ? !values[condition.slice(1)] : Boolean(values[condition]);
  }
  // Loads and sources are tested at their terminals, never inserted as
  // zero-ohm bridges into the conductor graph.
  function conductorGraph(circuit,values) {
    const adjacency = new Map();
    const append = (from,to,id,kind) => {
      if (!adjacency.has(from)) adjacency.set(from,[]);
      adjacency.get(from).push({to,id,kind});
    };
    const add = (edge,id,kind) => {append(edge.from,edge.to,id,kind);append(edge.to,edge.from,id,kind);};
    circuit.wires.forEach(wire => add(wire,wire.wireId,"wire"));
    circuit.deviceEdges.filter(edge => edge.kind !== "load" && edge.kind !== "source" && isClosed(edge.condition,values))
      .forEach(edge => add(edge,edge.edgeId,"device"));
    const cache = new Map();
    function reachable(from) {
      if (cache.has(from)) return cache.get(from);
      const found = new Set([from]),queue = [from];
      for (const here of queue) for (const next of adjacency.get(here) || []) {
        if (!found.has(next.to)) {found.add(next.to);queue.push(next.to);}
      }
      cache.set(from,found);return found;
    }
    // Union of all simple source-to-load paths. Parallel self-hold feeds are
    // included; reachable dead ends and open return branches are excluded.
    function paths(from,to) {
      const union = new Map();
      if (!reachable(from).has(to)) return [];
      const visited = new Set([from]),route = [];
      function visit(here) {
        if (here === to) {route.forEach(edge => union.set(edge.id,edge));return;}
        for (const next of adjacency.get(here) || []) {
          if (visited.has(next.to)) continue;
          visited.add(next.to);route.push({id:next.id,kind:next.kind,from:here,to:next.to});
          visit(next.to);route.pop();visited.delete(next.to);
        }
      }
      visit(from);return [...union.values()];
    }
    return {reachable,paths};
  }
  function phaseSources(graph,circuit,port) {
    return circuit.supplies.phases.map((source,index) => graph.reachable(source).has(port) ? index : -1).filter(index => index >= 0);
  }
  function primaryPower(graph,circuit,primary) {
    const a = phaseSources(graph,circuit,primary.from),b = phaseSources(graph,circuit,primary.to);
    return {powered:a.length === 1 && b.length === 1 && a[0] !== b[0],fromPhase:a[0],toPhase:b[0]};
  }
  function loadTerminals(graph,load,supply,enabled) {
    if (!enabled) return null;
    const from = graph.reachable(supply[0]),to = graph.reachable(supply[1]);
    if (from.has(supply[1])) return null;
    if (from.has(load.from) && to.has(load.to)) return {from:load.from,to:load.to};
    if (from.has(load.to) && to.has(load.from)) return {from:load.to,to:load.from};
    return null;
  }
  function solve(inputState) {
    const circuit = data(),state = createInitialState(clone(inputState)),op = state.operationState;
    const edgesById = new Map(circuit.deviceEdges.map(edge => [edge.edgeId,edge]));
    const coils = circuit.components.filter(component => component.type === "coil").map(component => ({
      name:component.geometry.state,edge:edgesById.get(component.electricalEdgeIds[0])
    }));
    const primary = edgesById.get("transformer_primary");
    const diagnostics = [],transitionTrace = [],inhibited = new Set();
    let stable = {...state.stableDeviceStates},converged = false,iterations = 0;
    const pairs = [["KM2","KM3"],["KM4","KM5"]];
    pairs.forEach(([a,b]) => {
      if (stable[a] && stable[b]) {
        stable[a] = stable[b] = false;
        diagnostics.push({code:"INVALID_PREVIOUS_PAIR",devices:[a,b],message:"清除无效的双接触器历史状态"});
      }
    });
    if (op.qf !== "closed") {stable = emptyStable();op.kt = "idle";}
    const record = (phase,next) => {transitionTrace.push({phase,stableDeviceStates:{...next}});stable = next;};
    for (;iterations < 32;iterations += 1) {
      const graph = conductorGraph(circuit,conditionValues(op,stable));
      const powered = primaryPower(graph,circuit,primary).powered;
      const demand = Object.fromEntries(coils.map(coil => [coil.name,Boolean(loadTerminals(graph,coil.edge,circuit.supplies.control,powered))]));
      // Resolve KT's instantaneous contact before contactor pickup. Its
      // delayed pair keeps the retained off-delay state after coil dropout.
      if (demand.KT !== stable.KT) {record(demand.KT ? "timer-pickup" : "timer-dropout",{...stable,KT:demand.KT});continue;}
      const dropped = {...stable};let hasDrop = false;
      coils.forEach(({name}) => {
        if (stable[name] && (!demand[name] || inhibited.has(name))) {dropped[name] = false;hasDrop = true;}
      });
      // Break first. Opposing pickup is evaluated against the released graph
      // in the next iteration; no frame contains both reversing contactors.
      if (hasDrop) {record("break",dropped);continue;}
      const next = {...stable};
      coils.forEach(({name}) => {next[name] = Boolean(demand[name] && !inhibited.has(name));});
      pairs.forEach(([a,b]) => {
        if (!next[a] || !next[b]) return;
        // The source gives SB5/SB6 no cross-NC in their coil feeds. A collision
        // is explicitly inhibited, not hidden by inventing an extra contact.
        inhibited.add(a);inhibited.add(b);next[a] = next[b] = false;
        diagnostics.push({code:"SIMULTANEOUS_COIL_DEMAND",devices:[a,b],message:`${a} / ${b} 同时具备线圈通路；暂停本组吸合，请先释放冲突按钮。教材没有额外的按钮互锁触点。`});
      });
      if (coilNames.every(name => next[name] === stable[name])) {converged = true;break;}
      record("make",next);
    }
    if (!converged) {stable = emptyStable();diagnostics.push({code:"NO_STABLE_SOLUTION",message:"触点图未收敛，停止执行元件并保留诊断"});}
    if (op.qf !== "closed") op.kt = "idle";
    else if (stable.KT) op.kt = "energized";
    else if (op.kt === "energized") op.kt = "timing";
    state.stableDeviceStates = {...stable};
    const values = conditionValues(op,stable),graph = conductorGraph(circuit,values);
    const primaryState = primaryPower(graph,circuit,primary);
    const wireSet = new Set(),activeEdges = new Set(),loadPaths = {},loadPowered = {};
    const addPaths = (id,routes,loadEdge = null) => {
      const paths = routes.flat();
      const wireIds = [...new Set(paths.filter(edge => edge.kind === "wire").map(edge => edge.id))];
      const edgeIds = [...new Set(paths.filter(edge => edge.kind === "device").map(edge => edge.id))];
      if (loadEdge) edgeIds.push(loadEdge.edgeId);
      wireIds.forEach(wire => wireSet.add(wire));edgeIds.forEach(edge => activeEdges.add(edge));
      loadPaths[id] = {wireIds,edgeIds,segments:paths};
    };
    function traceLoad(edge,supply,enabled) {
      const ends = loadTerminals(graph,edge,supply,enabled);
      loadPowered[edge.edgeId] = Boolean(ends);
      if (ends) addPaths(edge.edgeId,[graph.paths(supply[0],ends.from),graph.paths(ends.to,supply[1])],edge);
      return Boolean(ends);
    }
    coils.forEach(({name,edge}) => traceLoad(edge,circuit.supplies.control,primaryState.powered && stable[name]));
    const lamps = {};
    ["el","hl1","hl2","hl3"].forEach(id => {
      lamps[id.toUpperCase()] = traceLoad(edgesById.get(id),id === "el" ? circuit.supplies.lighting : circuit.supplies.indicator,primaryState.powered);
    });
    if (lamps.EL) activeEdges.add("lighting_winding");
    loadPowered.transformer_primary = primaryState.powered;
    if (primaryState.powered) addPaths("transformer_primary",[
      graph.paths(circuit.supplies.phases[primaryState.fromPhase],primary.from),
      graph.paths(primary.to,circuit.supplies.phases[primaryState.toPhase])
    ],primary);
    const motorStates = {};
    circuit.components.filter(component => component.type === "motor").forEach(component => {
      const terminalPorts = component.geometry.phasePorts;
      const phases = terminalPorts.map(port => phaseSources(graph,circuit,port));
      const complete = phases.every(phase => phase.length === 1) && new Set(phases.map(phase => phase[0])).size === 3;
      const sequence = phases.map(phase => phase.length === 1 ? `L${phase[0] + 1}` : null),indices = phases.map(phase => phase[0]);
      const positive = complete && (indices[1] - indices[0] + 3) % 3 === 1 && (indices[2] - indices[1] + 3) % 3 === 1;
      const name = component.label;
      const directions = name === "M2" ? ["down","up"] : name === "M3" ? ["clamp","loosen"] : ["forward","reverse"];
      motorStates[name] = {running:complete,direction:complete ? directions[positive ? 0 : 1] : "none",phaseSequence:sequence,
        terminalSources:Object.fromEntries(["U","V","W"].map((terminal,index) => [terminal,phases[index].map(phase => `L${phase + 1}`)]))};
      if (complete) addPaths(name,terminalPorts.map((port,index) => graph.paths(circuit.supplies.phases[phases[index][0]],port)));
      if (phases.some(phase => phase.length > 1)) diagnostics.push({code:"PHASE_SHORT",motor:name,message:`${name} 端子出现多相连通，禁止演示运转`});
    });
    const edgeStates = Object.fromEntries(circuit.deviceEdges.map(edge => [edge.edgeId,{
      edgeId:edge.edgeId,
      conductive:edge.kind === "load" || edge.kind === "source" ? true : isClosed(edge.condition,values),
      energized:edge.kind === "load" ? Boolean(loadPowered[edge.edgeId]) : edge.kind === "source" ? primaryState.powered : activeEdges.has(edge.edgeId)
    }]));
    const activeMainWireIds = [],activeControlWireIds = [];
    circuit.wires.forEach(wire => {if (wireSet.has(wire.wireId)) (wire.domain === "main" ? activeMainWireIds : activeControlWireIds).push(wire.wireId);});
    const result = {
      schemaVersion:"1.0",moduleId:MODULE_ID,stableDeviceStates:{...stable},edgeStates,activeEdgeIds:[...activeEdges],
      activeMainWireIds,activeControlWireIds,partialWireIds:[],motorStates,
      protectionStates:{FR1:{state:op.fr1,tripped:op.fr1 !== "normal"},FR2:{state:op.fr2,tripped:op.fr2 !== "normal"}},
      converged,iterationCount:iterations + 1,lastAction:clone(state.lastAction),
      extension:{activeScene:op.scene,activeEdgeIds:[...activeEdges],timerState:op.kt,
        mechanical:{...clone(motorStates),rocker:motorStates.M2.direction,clamp:motorStates.M3.direction},
        limits:{SQ1_UP:op.sq1Upper,SQ1_DOWN:op.sq1Lower,SQ2:op.sq2Loose,SQ3:op.sq3Clamped,SQ4:op.sq4},
        lamps,diagnostics,transitionTrace,loadPaths,supplies:{control:primaryState.powered,lighting:primaryState.powered,indicator:primaryState.powered},
        assumptions:["教材未给出 KT 延时数值，由教学界面模拟到时。","指示回路箭头及照明 T 绕组视为同一变压器的隔离供电，不添加跨绕组导线。"]}
    };
    return {state,solverResult:result};
  }
  function reduce(inputState,command,payload = {}) {
    const state = createInitialState(clone(inputState)),op = state.operationState;
    const release = ids => ids.forEach(id => {op.buttons[id] = "released";});
    const limitValue = payload.value === undefined ? true : Boolean(payload.value);
    if (buttonCommands[command]) op.buttons[buttonCommands[command]] = "pressed";
    else switch (command) {
      case "powerToggle": return reduce(state,op.qf === "closed" ? "powerOpen" : "powerClose",payload);
      case "powerClose": op.qf = "closed";break;
      case "powerOpen": op.qf = "open";op.kt = "idle";release(buttonIds);state.stableDeviceStates = emptyStable();break;
      case "release": {const id = buttonCommands[payload.command] || payload.button;release(id && buttonIds.includes(id) ? [id] : buttonIds);break;}
      case "rockerStop": release(["sb3","sb4"]);break;
      case "hydraulicStop": release(["sb5","sb6"]);break;
      case "timerComplete": if (op.kt === "timing") op.kt = "idle";break;
      case "prepareRocker":
      case "looseLimit": op.sq2Loose = limitValue;if (limitValue) op.sq3Clamped = false;break;
      case "clampLimit": op.sq3Clamped = limitValue;if (limitValue) op.sq2Loose = false;break;
      case "upperLimit": op.sq1Upper = limitValue;if (limitValue) op.sq1Lower = false;break;
      case "lowerLimit": op.sq1Lower = limitValue;if (limitValue) op.sq1Upper = false;break;
      case "resetLimits": op.sq1Upper = op.sq1Lower = op.sq2Loose = op.sq3Clamped = false;break;
      case "fr1Trip": op.fr1 = "overload";break;
      case "fr1Reset": op.fr1 = "normal";break;
      case "fr2Trip": op.fr2 = "overload";break;
      case "fr2Reset": op.fr2 = "normal";break;
      case "lighting": op.sa1 = !op.sa1;break;
      case "coolant": op.coolant = !op.coolant;break;
      case "indicator": op.sq4 = op.sq4 === "upper" ? "normal" : "upper";break;
      case "scene": op.scene = payload.scene || op.scene;release(buttonIds);break;
      case "reset": return solve(createInitialState({operationState:{scene:payload.scene || op.scene},lastAction:{type:command,payload:clone(payload),message:"已恢复教材常态"}})).state;
      default: break;
    }
    state.lastAction = {type:command,payload:clone(payload),message:payload.message || command};
    return solve(state).state;
  }
  function runTests() {
    const checks = [],check = (id,pass) => checks.push({id,pass:Boolean(pass)});
    let state = createInitialState(),result = solve(state).solverResult;
    check("教材常态无活动路径",result.activeEdgeIds.length === 0 && !Object.values(result.motorStates).some(motor => motor.running));
    check("SB1 常闭、SB2 常开",result.edgeStates.sb1_nc.conductive && !result.edgeStates.sb2_no.conductive);
    state = reduce(state,"powerClose");result = solve(state).solverResult;
    check("SQ3 未动作时合闸自动夹紧",result.stableDeviceStates.KM5 && result.stableDeviceStates.YV && result.motorStates.M3.direction === "clamp");
    state = reduce(state,"clampLimit");result = solve(state).solverResult;
    check("SQ3 到位停止夹紧及 YV",!result.stableDeviceStates.KM5 && !result.stableDeviceStates.YV);
    state = reduce(state,"spindleStart");state = reduce(state,"release",{command:"spindleStart"});result = solve(state).solverResult;
    check("SB2 启动后 KM1 真实自锁",result.stableDeviceStates.KM1 && result.activeEdgeIds.includes("km1_self_no") && !result.activeEdgeIds.includes("sb2_no"));
    state = reduce(state,"spindleStop");state = reduce(state,"release",{command:"spindleStop"});result = solve(state).solverResult;
    check("SB1 停止后不自启动",!result.stableDeviceStates.KM1);
    state = reduce(state,"rockerUp");result = solve(state).solverResult;
    check("上升先松开且 KT 立即得电",result.stableDeviceStates.KT && result.stableDeviceStates.KM4 && !result.stableDeviceStates.KM2 && state.operationState.kt === "energized");
    state = reduce(state,"looseLimit");result = solve(state).solverResult;
    check("SQ2 到位后立即上升无需通电延时",result.stableDeviceStates.KM2 && !result.stableDeviceStates.KM4 && result.motorStates.M2.direction === "up");
    state = reduce(state,"release",{command:"rockerUp"});result = solve(state).solverResult;
    check("释放后 KT 断电延时",!result.stableDeviceStates.KT && !result.motorStates.M2.running && state.operationState.kt === "timing" && result.stableDeviceStates.YV && !result.stableDeviceStates.KM5);
    state = reduce(state,"timerComplete");result = solve(state).solverResult;
    check("延时结束恢复自动夹紧",result.stableDeviceStates.KM5 && result.stableDeviceStates.YV);
    state = reduce(state,"fr2Trip");result = solve(state).solverResult;
    check("FR2 只断开液压线圈返回",!result.stableDeviceStates.KM5 && result.stableDeviceStates.YV);
    state = reduce(state,"fr2Reset");result = solve(state).solverResult;
    check("FR2 复位恢复仍存在的自动夹紧通路",result.stableDeviceStates.KM5);
    state = reduce(state,"clampLimit");state = reduce(state,"loosen");result = solve(state).solverResult;
    check("手动松开联动 NC 切断 YV",result.stableDeviceStates.KM4 && result.edgeStates.sb5_no.conductive && !result.edgeStates.sb5_nc.conductive && !result.stableDeviceStates.YV);
    state = reduce(state,"release",{command:"loosen"});state = reduce(state,"clamp");result = solve(state).solverResult;
    check("手动夹紧联动 NC 切断 YV",result.stableDeviceStates.KM5 && !result.edgeStates.sb6_nc.conductive && !result.stableDeviceStates.YV);
    state = reduce(state,"release",{command:"clamp"});result = solve(state).solverResult;
    check("SQ4 常态 HL1 亮 HL2 灭",result.extension.lamps.HL1 && !result.extension.lamps.HL2);
    state = reduce(state,"indicator");result = solve(state).solverResult;
    check("SQ4 动作交换指示灯",!result.extension.lamps.HL1 && result.extension.lamps.HL2);
    return {passed:checks.every(item => item.pass),checks};
  }
  platform.moduleSolvers.ch02MachineToolCircuitsV2 = Object.freeze({createInitialState,solve,reduce,defaultOperation,runTests});
})(globalThis);
