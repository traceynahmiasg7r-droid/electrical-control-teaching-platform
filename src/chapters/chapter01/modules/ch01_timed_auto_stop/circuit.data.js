(function installTimedAutoStopData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {}; platform.moduleData = platform.moduleData || {};
  const M = "ch01_timed_auto_stop", id = (kind, name) => `${M}__${kind}__${name}`;
  const cmp = (name, device, type, partType, label, x, y, domain = "control") => Object.freeze({ schemaVersion: "1.0", componentId: id("cmp", name), deviceId: id("dev", device), type, partType, label: Object.freeze({ text: label }), geometry: Object.freeze({ x, y, width: 64, height: 42, orientation: 0 }), ports: Object.freeze([]), state: Object.freeze({}), circuitDomain: domain, behavior: partType });
  const wire = (name, domain, points) => Object.freeze({ wireId: id("wire", name), circuitDomain: domain, electricalRole: "supply", fromPort: id("port", `${name}_a`), toPort: id("port", `${name}_b`), routePoints: Object.freeze(points.map(([x,y]) => Object.freeze({x,y}))), phase: "" });
  const mainComponents = Object.freeze([
    cmp("qf1","qf1","breaker","main_contact","QF1",100,76,"main"), cmp("fu1","fu1","fuse","fuse_set","FU1",100,148,"main"), cmp("km1_main","km1","contactor","main_contact","KM1",100,238,"main"), cmp("m1","m1","motor","three_phase_motor","M",100,390,"main")
  ]);
  const controlComponents = Object.freeze([
    cmp("fu2","fu2","fuse","control_fuse","FU2",350,76), cmp("sb1","sb1","push_button","no","SB1 启动",445,130), cmp("km1_hold","km1","contactor","aux_no","KM1 自锁",535,190), cmp("kt2_nc","kt2","timer","timed_nc","KT2 延时断开",650,130), cmp("km1_coil","km1","contactor","coil","KM1",780,130), cmp("kt1_coil","kt1","timer","coil","KT1 120s",650,260), cmp("kt2_coil","kt2","timer","coil","KT2 120s",780,330)
  ]);
  const mainWires = Object.freeze([wire("main_1","main",[[56,40],[56,350]]),wire("main_2","main",[[100,40],[100,350]]),wire("main_3","main",[[144,40],[144,350]])]);
  const controlWires = Object.freeze([wire("ctl_supply","control",[[350,50],[350,390]]),wire("ctl_run","control",[[350,130],[812,130]]),wire("ctl_kt1","control",[[350,260],[812,260]]),wire("ctl_kt2","control",[[350,330],[812,330]]),wire("ctl_return","control",[[840,50],[840,390]])]);
  platform.moduleData[M] = Object.freeze({ schemaVersion:"1.0", moduleId:M, geometryLockId:"ch01_timed_auto_stop_geometry_v1_locked", referenceImages:Object.freeze(["./assets/reference/timed-auto-stop.jpg"]), mainComponents, mainWires, controlComponents, controlWires, deviceEdges:Object.freeze([]) });
})(globalThis);
