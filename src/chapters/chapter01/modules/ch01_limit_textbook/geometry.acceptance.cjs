const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = path.resolve(__dirname);
const context = vm.createContext({ console, globalThis: {} });
vm.runInContext(fs.readFileSync(path.join(root, "circuit.data.js"), "utf8"), context, { filename: "circuit.data.js" });
const data = context.globalThis.ECTPPlatform.moduleCircuitData.ch01LimitTextbook;
const report = data.validateGeometry();
const port = (id) => data.ports.find((item) => item.portId === id);
const wire = (id) => data.wires.find((item) => item.wireId === id);
const component = (id) => data.components.find((item) => item.componentId === id);
const samePoint = (value, x, y) => value && value.x === x && value.y === y;
const hasPath = (value, expected) => Array.isArray(value)
  && value.length === expected.length
  && value.every((item, index) => samePoint(item, expected[index][0], expected[index][1]));
const expectedControlRoute = [
  ["control-source-to-branch", "control_a", "control_start_branch"],
  ["control-branch-to-sb1", "control_start_branch", "sb1_a"],
  ["control-sb1-to-join", "sb1_b", "control_hold_join"],
  ["control-join-to-sb2", "control_hold_join", "sb2_a"],
  ["control-sb2-to-coil", "sb2_b", "km_coil_a"],
  ["control-coil-to-return", "km_coil_b", "control_return_right"],
  ["control-return-drop", "control_return_right", "control_return_corner"],
  ["control-return-to-sq", "control_return_corner", "sq_b"],
  ["control-sq-to-fr1", "sq_a", "fr1_nc_b"],
  ["control-fr1-to-n", "fr1_nc_a", "control_n"]
];
const sourceSplit = [
  ["phase-b-source-to-return", "src_b", "control_n"],
  ["phase-b-return-to-contact", "control_n", "km_main_b_a"],
  ["phase-c-source-to-control", "src_c", "control_a"],
  ["phase-c-control-to-contact", "control_a", "km_main_c_a"]
];
const motor = component("motor").geometry;
const heater = component("fr1_main").geometry;
const fr1 = component("fr1_nc").geometry;
const sq = component("sq").geometry;
const checks = [
  ["geometry valid", report.valid],
  ["native source metadata", data.reference.width === 1713 && data.reference.height === 1186 && data.reference.sha256 === "D5CB8C85112FDAFBF9A1B12F3FF4FBD0BDE34784AF305DD26E8409402259F357"],
  ["source-native crop", data.reference.sourceCrop.left === 175 && data.reference.sourceCrop.top === 420 && data.reference.sourceCrop.right === 1500 && data.reference.sourceCrop.bottom === 1140 && data.viewBox.x === 175 && data.viewBox.y === 420 && data.viewBox.width === 1325 && data.viewBox.height === 720],
  ["native title only", data.labels.length === 1 && data.labels[0].text === "控制电路" && samePoint(data.labels[0], 310, 487)],
  ["three motor leads", motor.phasePorts.length === 3 && new Set(motor.phasePorts).size === 3],
  ["native motor geometry", motor.x === 596 && motor.y === 1079 && motor.rx === 57 && motor.ry === 42],
  ["main KM contacts", ["km_main_a", "km_main_b", "km_main_c"].every((id) => data.deviceEdges.some((e) => e.edgeId === id))],
  ["native main-contact anchors", ["a", "b", "c"].every((phase, index) => samePoint(port(`km_main_${phase}_a`), [520, 596, 671][index], 866) && samePoint(port(`km_main_${phase}_b`), [520, 596, 671][index], 900))],
  ["FR1 main heaters", ["fr1_main_a", "fr1_main_b", "fr1_main_c"].every((id) => data.deviceEdges.some((e) => e.edgeId === id))],
  ["native FR1 main outline and notch", hasPath(heater.outline, [[502, 951], [688, 951], [688, 981], [502, 981], [502, 951]]) && hasPath(heater.notch, [[577, 951], [577, 970], [625, 970], [625, 981]])],
  ["control contacts", ["sb1_no", "km_self_no", "sb2_nc", "fr1_nc", "sq_nc"].every((id) => data.deviceEdges.some((e) => e.edgeId === id))],
  ["phase C source and phase B return", samePoint(port("control_a"), 671, 706) && port("control_a").electricalNodeId === "phase:C" && samePoint(port("control_n"), 596, 814) && port("control_n").electricalNodeId === "phase:B" && data.supplies.controlPhase === "C" && data.supplies.controlReturnPhase === "B"],
  ["source feeds split at true taps", sourceSplit.every(([id, from, to]) => wire(id)?.from === from && wire(id)?.to === to)],
  ["self-hold branches at x838", samePoint(port("control_start_branch"), 838, 706) && wire("control-self-feed")?.from === "control_start_branch" && hasPath(wire("control-self-feed")?.points, [[838, 706], [838, 781], [913, 781]])],
  ["native series control route", expectedControlRoute.every(([id, from, to]) => wire(id)?.from === from && wire(id)?.to === to)],
  ["FR1 thermal sign and linkage", hasPath(fr1.thermalSign, [[786, 879], [805, 879], [805, 863], [843, 863], [843, 879], [863, 879]]) && hasPath(fr1.linkage, [[825, 830], [825, 856]])],
  ["SQ striker", hasPath(sq.striker, [[1250, 814], [1250, 854], [1270, 854]])],
  ["source-native invisible junctions and explicit unconnected crossing", data.junctions.length === 4 && data.junctions.every((item) => item.visible === false) && data.crossings.length === 1 && data.crossings[0].connected === false],
  ["C trunk crosses B return without connection", data.crossings[0].crossingId === "phase-c-over-control-return" && samePoint(data.crossings[0], 671, 814) && data.crossings[0].wireIds.includes("phase-c-control-to-contact") && data.crossings[0].wireIds.includes("control-fr1-to-n")],
  ["single control return route", !data.wires.some((w) => w.wireId === "control-coil-to-return" && w.to === "control_n")]
];
const failed = checks.filter(([, ok]) => !ok);
console.log(JSON.stringify({ moduleId: data.moduleId, counts: report.counts, checks: checks.map(([name, passed]) => ({ name, passed })), errors: report.errors }, null, 2));
if (failed.length) process.exitCode = 1;
