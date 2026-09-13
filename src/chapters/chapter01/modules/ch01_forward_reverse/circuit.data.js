(function installCh01ForwardReverseData(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleData = platform.moduleData || {};
  const M = "ch01_forward_reverse";
  const id = (kind, name) => `${M}__${kind}__${name}`;
  const component = (name, device, label, domain, x, y, width = 64, height = 42) => Object.freeze({
    componentId: id("cmp", name),
    deviceId: id("dev", device),
    label,
    circuitDomain: domain,
    geometry: Object.freeze({ x, y, width, height })
  });
  const wire = (name, domain, points, options = {}) => Object.freeze({
    wireId: id("wire", name),
    circuitDomain: domain,
    routePoints: Object.freeze(points.map(([x, y]) => Object.freeze({ x, y }))),
    routeBreaks: Object.freeze([...(options.routeBreaks || [])]),
    flowClass: options.flowClass || "",
    directionalFlowClass: Object.freeze({ ...(options.directionalFlowClass || {}) })
  });
  const edge = (name, device, contactType, domain) => Object.freeze({
    edgeId: id("edge", name),
    deviceId: id("dev", device),
    contactType,
    circuitDomain: domain
  });

  platform.moduleData[M] = Object.freeze({
    schemaVersion: "1.0",
    moduleId: M,
    geometryLockId: "ch01_forward_reverse_page61_geometry_v2_locked",
    reference: Object.freeze({ chapter: "第一章", page: 61, title: "正反转电路" }),
    electricalBasis: Object.freeze({
      controlSupply: Object.freeze({ live: "A", neutral: "N", nominalVoltage: 220 }),
      mainSupply: Object.freeze(["A", "B", "C"]),
      forwardPhaseOrder: Object.freeze({ U: "A", V: "B", W: "C" }),
      reversePhaseOrder: Object.freeze({ U: "C", V: "B", W: "A" }),
      stopButton: "SB3",
      forwardButton: "SB1",
      reverseButton: "SB2",
      interlockType: "contactor-electrical"
    }),
    components: Object.freeze([
      component("source_a", "source_a", "A", "main", 52, 35, 24, 24),
      component("source_b", "source_b", "B", "main", 126, 35, 24, 24),
      component("source_c", "source_c", "C", "main", 200, 35, 24, 24),
      component("km1_main", "km1", "KM1 三极主触点", "main", 62, 145, 180, 76),
      component("km2_main", "km2", "KM2 换相主触点", "main", 62, 250, 180, 76),
      component("motor", "motor", "M 三相异步电动机", "main", 92, 392, 120, 92),
      component("control_a", "control_a", "A", "control", 390, 48, 24, 24),
      component("control_n", "control_n", "N", "control", 850, 48, 24, 24),
      component("sb3_stop", "sb3", "SB3 停止（常闭）", "control", 460, 85, 84, 36),
      component("sb1_forward", "sb1", "SB1 正转（常开）", "control", 555, 168, 84, 36),
      component("km1_self", "km1", "KM1 自锁（常开）", "control", 555, 222, 84, 36),
      component("km2_interlock", "km2", "KM2 互锁（常闭）", "control", 680, 168, 92, 36),
      component("km1_coil", "km1", "KM1 线圈 220V", "control", 805, 168, 70, 50),
      component("sb2_reverse", "sb2", "SB2 反转（常开）", "control", 555, 322, 84, 36),
      component("km2_self", "km2", "KM2 自锁（常开）", "control", 555, 376, 84, 36),
      component("km1_interlock", "km1", "KM1 互锁（常闭）", "control", 680, 322, 92, 36),
      component("km2_coil", "km2", "KM2 线圈 220V", "control", 805, 322, 70, 50)
    ]),
    wires: Object.freeze([
      wire("main_forward_a", "main", [[190, 150], [190, 296], [190, 364], [190, 580], [300, 580], [300, 735]], { routeBreaks: [2], flowClass: "direction-forward phase-a" }),
      wire("main_forward_b", "main", [[260, 150], [260, 296], [260, 364], [260, 600], [330, 600], [330, 735]], { routeBreaks: [2], flowClass: "direction-forward phase-b" }),
      wire("main_forward_c", "main", [[330, 150], [330, 296], [330, 364], [330, 620], [360, 620], [360, 735]], { routeBreaks: [2], flowClass: "direction-forward phase-c" }),
      wire("main_reverse_a", "main", [[190, 150], [190, 220], [360, 220], [360, 466], [360, 534], [360, 580], [360, 735]], { routeBreaks: [4], flowClass: "direction-reverse phase-a" }),
      wire("main_reverse_b", "main", [[260, 150], [260, 235], [430, 235], [430, 466], [430, 534], [430, 600], [330, 600], [330, 735]], { routeBreaks: [4], flowClass: "direction-reverse phase-b" }),
      wire("main_reverse_c", "main", [[330, 150], [330, 250], [500, 250], [500, 466], [500, 534], [500, 620], [300, 620], [300, 735]], { routeBreaks: [4], flowClass: "direction-reverse phase-c" }),
      wire("motor_terminal_u", "main", [[300, 739], [300, 770]], { directionalFlowClass: { forward: "direction-forward phase-a", reverse: "direction-reverse phase-c" } }),
      wire("motor_terminal_v", "main", [[330, 739], [330, 770]], { directionalFlowClass: { forward: "direction-forward phase-b", reverse: "direction-reverse phase-b" } }),
      wire("motor_terminal_w", "main", [[360, 739], [360, 770]], { directionalFlowClass: { forward: "direction-forward phase-c", reverse: "direction-reverse phase-a" } }),
      wire("control_common", "control", [[650, 220], [718, 220], [802, 220], [850, 220], [850, 750]], { routeBreaks: [2] }),
      wire("control_forward_start", "control", [[850, 400], [878, 400], [962, 400], [1062, 400]], { routeBreaks: [2] }),
      wire("control_forward_hold", "control", [[850, 500], [882, 500], [958, 500], [1000, 500], [1000, 400], [1062, 400]], { routeBreaks: [2], flowClass: "direction-forward" }),
      wire("control_forward_interlock", "control", [[1138, 400], [1230, 400]], { flowClass: "direction-forward" }),
      wire("control_forward_return", "control", [[1330, 400], [1400, 400]], { flowClass: "direction-forward" }),
      wire("control_reverse_start", "control", [[850, 650], [878, 650], [962, 650], [1062, 650]], { routeBreaks: [2] }),
      wire("control_reverse_hold", "control", [[850, 750], [882, 750], [958, 750], [1000, 750], [1000, 650], [1062, 650]], { routeBreaks: [2], flowClass: "direction-reverse" }),
      wire("control_reverse_interlock", "control", [[1138, 650], [1230, 650]], { flowClass: "direction-reverse" }),
      wire("control_reverse_return", "control", [[1330, 650], [1400, 650]], { flowClass: "direction-reverse" })
    ]),
    deviceEdges: Object.freeze([
      edge("sb3_stop_nc", "sb3", "NC", "control"),
      edge("sb1_forward_no", "sb1", "NO", "control"),
      edge("sb2_reverse_no", "sb2", "NO", "control"),
      edge("km1_self_no", "km1", "NO", "control"),
      edge("km2_self_no", "km2", "NO", "control"),
      edge("km2_interlock_nc", "km2", "NC", "control"),
      edge("km1_interlock_nc", "km1", "NC", "control"),
      edge("km1_coil", "km1", "COIL", "control"),
      edge("km2_coil", "km2", "COIL", "control"),
      edge("km1_main", "km1", "NO-3P", "main"),
      edge("km2_main", "km2", "NO-3P-REVERSING", "main")
    ])
  });
})(globalThis);
