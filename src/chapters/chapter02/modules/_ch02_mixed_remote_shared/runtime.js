(function installMixedRemoteSharedRuntime(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const shared = platform.mixedRemoteShared = platform.mixedRemoteShared || {};

  const SVG_NS = "http://www.w3.org/2000/svg";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  }

  function ns(moduleId, kind, localId) {
    return `${moduleId}__${kind}__${localId}`;
  }

  function buildCircuitData(config) {
    const { moduleId, variant } = config;
    const component = (localId, type, partType, label, circuitDomain, ports, geometry) => ({
      schemaVersion: "1.0",
      componentId: ns(moduleId, "cmp", localId),
      deviceId: ns(moduleId, "dev", localId.startsWith("k_") ? "k" : localId.replace(/_(coil|main|aux_no|aux_nc|nc|no)$/u, "")),
      type,
      partType,
      label: { text: label, anchor: "top", offset: { x: 0, y: -8 } },
      geometry,
      ports: ports.map((name) => ({ portId: ns(moduleId, "port", `${localId}_${name}`), terminal: name })),
      state: {},
      circuitDomain
    });
    const components = [
      component("qf1", "breaker", "three_pole", "QF1", "main", ["L1", "L2", "L3", "T1", "T2", "T3"], { x: 86, y: 96, width: 150, height: 56, orientation: 90 }),
      component("fu1", "fuse", "three_pole", "FU1", "main", ["L1", "L2", "L3", "T1", "T2", "T3"], { x: 86, y: 172, width: 150, height: 54, orientation: 90 }),
      component("km1_main", "contactor", "main_contact", "KM1", "main", ["L1", "L2", "L3", "T1", "T2", "T3"], { x: 86, y: 250, width: 150, height: 58, orientation: 90 }),
      component("fr1_main", "thermal_relay", "thermal_element", "FR1", "main", ["L1", "L2", "L3", "T1", "T2", "T3"], { x: 86, y: 330, width: 150, height: 50, orientation: 90 }),
      component("m", "motor", "three_phase", "M", "main", ["U", "V", "W"], { x: 118, y: 410, width: 88, height: 88, orientation: 0 }),
      component("fu2", "fuse", "single_pole", variant === "mode2" ? "FU3" : variant === "mode3" ? "FU4" : "FU2", "control", ["L", "T"], { x: 350, y: 112, width: 34, height: 50, orientation: 90 }),
      component("sb1_no", "push_button", "no", variant === "multi" ? "1SB1" : "SB1", "control", ["13", "14"], { x: 470, y: 104, width: 70, height: 48, orientation: 0 }),
      component("sb2_nc", "push_button", "nc", variant === "multi" ? "1SB2" : "SB2", "control", ["21", "22"], { x: 680, y: 104, width: 70, height: 48, orientation: 0 }),
      component("km1_coil", "contactor", "coil", "KM1", "control", ["A1", "A2"], { x: 828, y: 104, width: 70, height: 48, orientation: 0 }),
      component("fr1_nc", "thermal_relay", "protection_nc", "FR1", "control", ["95", "96"], { x: 930, y: 104, width: 70, height: 48, orientation: 0 }),
      component("km1_aux_no", "contactor", "aux_no", "KM1", "control", ["13", "14"], { x: 560, y: 188, width: 70, height: 48, orientation: 0 })
    ];

    if (variant === "mode1") {
      components.push(component("sa", "selector_switch", "maintained", "SA", "control", ["1", "2"], { x: 470, y: 188, width: 70, height: 48, orientation: 0 }));
    }
    if (variant === "mode2") {
      components.push(component("sb3_no", "push_button", "no", "SB3", "control", ["13", "14"], { x: 470, y: 188, width: 70, height: 48, orientation: 0 }));
      components.push(component("sb3_nc", "push_button", "nc", "SB3", "control", ["21", "22"], { x: 470, y: 252, width: 70, height: 48, orientation: 0 }));
    }
    if (variant === "mode3") {
      components.push(component("sb3_no", "push_button", "no", "SB3", "control", ["13", "14"], { x: 470, y: 250, width: 70, height: 48, orientation: 0 }));
      components.push(component("sb3_nc", "push_button", "nc", "SB3", "control", ["21", "22"], { x: 760, y: 104, width: 70, height: 48, orientation: 0 }));
      components.push(component("k_coil", "relay", "coil", "K", "control", ["A1", "A2"], { x: 846, y: 184, width: 70, height: 48, orientation: 0 }));
      components.push(component("k_aux_no_hold", "relay", "aux_no", "K", "control", ["13", "14"], { x: 560, y: 184, width: 70, height: 48, orientation: 0 }));
      components.push(component("k_aux_no_motor", "relay", "aux_no", "K", "control", ["23", "24"], { x: 560, y: 250, width: 70, height: 48, orientation: 0 }));
    }
    if (variant === "multi") {
      components.push(component("sb1_station2_no", "push_button", "no", "2SB1", "control", ["13", "14"], { x: 560, y: 188, width: 70, height: 48, orientation: 0 }));
      components.push(component("sb2_station2_nc", "push_button", "nc", "2SB2", "control", ["21", "22"], { x: 600, y: 104, width: 70, height: 48, orientation: 0 }));
      components.push(component("hl1", "indicator", "derived_output", "HL1", "control", ["X1", "X2"], { x: 720, y: 285, width: 56, height: 56, orientation: 0 }));
      components.push(component("hl2", "indicator", "derived_output", "HL2", "control", ["X1", "X2"], { x: 820, y: 285, width: 56, height: 56, orientation: 0 }));
    }

    const ports = new Set(components.flatMap((item) => item.ports.map((port) => port.portId)));
    const mainSequence = ["qf1", "fu1", "km1_main", "fr1_main", "m"];
    const wires = [];
    let wireIndex = 1;
    const addWire = (domain, from, fromTerminal, to, toTerminal, routePoints) => {
      wires.push({
        wireId: ns(moduleId, "wire", String(wireIndex++).padStart(3, "0")),
        circuitDomain: domain,
        fromPort: ns(moduleId, "port", `${from}_${fromTerminal}`),
        toPort: ns(moduleId, "port", `${to}_${toTerminal}`),
        routePoints
      });
    };
    for (let i = 0; i < mainSequence.length - 1; i += 1) {
      ["L1", "L2", "L3"].forEach((phase, phaseIndex) => {
        const fromTerminal = i === 0 ? phase : `T${phaseIndex + 1}`;
        const toTerminal = i === mainSequence.length - 2 ? ["U", "V", "W"][phaseIndex] : phase;
        addWire("main", mainSequence[i], fromTerminal, mainSequence[i + 1], toTerminal, []);
      });
    }
    const controlPairs = variant === "multi"
      ? [["fu2", "T", "sb2_nc", "21"], ["sb2_nc", "22", "sb2_station2_nc", "21"], ["sb2_station2_nc", "22", "sb1_no", "13"], ["sb1_no", "14", "km1_coil", "A1"], ["km1_coil", "A2", "fr1_nc", "95"]]
      : [["fu2", "T", "sb1_no", "13"], ["sb1_no", "14", "sb2_nc", "21"], ["sb2_nc", "22", "km1_coil", "A1"], ["km1_coil", "A2", "fr1_nc", "95"]];
    controlPairs.forEach((pair) => addWire("control", ...pair, []));

    const deviceEdges = components
      .filter((item) => item.type !== "motor" && item.type !== "indicator")
      .map((item) => ({
        edgeId: ns(moduleId, "edge", item.componentId.split("__").pop()),
        deviceId: item.deviceId,
        fromPort: item.ports[0]?.portId || "",
        toPort: item.ports[item.ports.length - 1]?.portId || "",
        circuitDomain: item.circuitDomain,
        electricalRole: item.partType.includes("coil") ? "coil" : item.partType.includes("contact") || ["no", "nc", "maintained"].includes(item.partType) ? "contact" : "protection",
        behavior: item.partType
      }));

    return freezeDeep({
      schemaVersion: "1.0",
      moduleId,
      variant,
      reference: config.reference,
      geometryLockId: config.geometryLockId,
      components,
      wires,
      deviceEdges,
      audit: {
        portCount: ports.size,
        danglingWireCount: wires.filter((wire) => !ports.has(wire.fromPort) || !ports.has(wire.toPort)).length,
        ambiguousCrossingCount: 0,
        geometryLocked: true
      }
    });
  }

  function createInitialRawState(config) {
    return {
      operation: {
        power: "open",
        fr1: "normal",
        sb1: "released",
        sb2: "released",
        station2Start: "released",
        station2Stop: "released",
        jog: "released",
        selector: config.variant === "mode1" ? "jog" : "not_applicable"
      },
      devices: { km1: false, k: false },
      jogCycle: false,
      lastAction: { type: "RESET_MODULE", message: "模块已复位，等待 QF1 合闸。" },
      solver: null
    };
  }

  function solveRaw(config, raw) {
    const power = raw.operation.power === "closed";
    const protection = raw.operation.fr1 === "normal";
    const stop1Closed = raw.operation.sb2 !== "pressed";
    const stop2Closed = raw.operation.station2Stop !== "pressed";
    const start1 = raw.operation.sb1 === "pressed";
    const start2 = raw.operation.station2Start === "pressed";
    const jog = raw.operation.jog === "pressed";
    let km1 = Boolean(raw.devices.km1);
    let relayK = Boolean(raw.devices.k);
    let iterationCount = 0;

    for (let iteration = 1; iteration <= 8; iteration += 1) {
      let nextKm1 = false;
      let nextK = relayK;
      if (config.variant === "mode1") {
        const selfHold = raw.operation.selector === "continuous" && km1;
        nextKm1 = power && protection && stop1Closed && (start1 || jog || selfHold);
        nextK = false;
      } else if (config.variant === "mode2") {
        const sb3Nc = !jog;
        const selfHold = km1 && sb3Nc && !raw.jogCycle;
        nextKm1 = power && protection && stop1Closed && (start1 || jog || selfHold);
        nextK = false;
      } else if (config.variant === "mode3") {
        const sb3Nc = !jog;
        nextK = power && protection && stop1Closed && sb3Nc && (start1 || relayK);
        nextKm1 = power && protection && stop1Closed && (jog || nextK);
      } else {
        nextKm1 = power && protection && stop1Closed && stop2Closed && (start1 || start2 || km1);
        nextK = false;
      }
      iterationCount = iteration;
      if (nextKm1 === km1 && nextK === relayK) break;
      km1 = nextKm1;
      relayK = nextK;
    }

    raw.devices.km1 = km1;
    raw.devices.k = relayK;
    const motorRunning = power && protection && km1;
    const activeMainWireIds = motorRunning ? config.circuitData.wires.filter((wire) => wire.circuitDomain === "main").map((wire) => wire.wireId) : [];
    const activeControlWireIds = km1 ? config.circuitData.wires.filter((wire) => wire.circuitDomain === "control").map((wire) => wire.wireId) : [];
    const partialWireIds = power && !km1 ? config.circuitData.wires.filter((wire) => wire.circuitDomain === "control").slice(0, 1).map((wire) => wire.wireId) : [];
    raw.solver = {
      stableDeviceStates: {
        [ns(config.moduleId, "dev", "km1")]: km1,
        [ns(config.moduleId, "dev", "k")]: relayK
      },
      edgeStates: {
        [ns(config.moduleId, "edge", "km1_main")]: km1,
        [ns(config.moduleId, "edge", "km1_aux_no")]: km1,
        [ns(config.moduleId, "edge", "fr1_nc")]: protection
      },
      activeMainWireIds,
      activeControlWireIds,
      partialWireIds,
      motorStates: {
        [ns(config.moduleId, "dev", "m")]: { running: motorRunning, direction: motorRunning ? "forward" : "none" }
      },
      protectionStates: {
        [ns(config.moduleId, "dev", "fr1")]: { state: raw.operation.fr1, tripped: !protection }
      },
      converged: true,
      iterationCount,
      lastAction: clone(raw.lastAction),
      extension: {
        variant: config.variant,
        selectorMode: raw.operation.selector,
        relayK,
        indicatorStates: config.variant === "multi" ? { HL1: motorRunning, HL2: motorRunning } : {},
        indicatorModelStatus: config.variant === "multi" ? "derived-visual-output; not a solver input" : "not_applicable"
      }
    };
    return raw.solver;
  }

  function contactSymbol(x, y, label, closed, kind = "no", action = "") {
    const isNc = kind === "nc";
    const contactClosed = isNc ? !closed : closed;
    const bladeY = contactClosed ? y : y - 16;
    const attrs = action ? ` data-action="${action}" tabindex="0" role="button"` : "";
    return `<g class="component interactive"${attrs} aria-label="${label}"><text x="${x + 35}" y="${y - 27}" text-anchor="middle">${label}</text><circle cx="${x}" cy="${y}" r="4"/><circle cx="${x + 70}" cy="${y}" r="4"/><path d="M${x + 4} ${y} L${x + 62} ${bladeY}" class="symbol ${contactClosed ? "closed" : ""}"/><path d="M${x - 22} ${y} H${x} M${x + 70} ${y} H${x + 92}" class="wire"/></g>`;
  }

  function coilSymbol(x, y, label, active) {
    return `<g><text x="${x + 34}" y="${y - 18}" text-anchor="middle">${label}</text><rect x="${x}" y="${y - 4}" width="68" height="42" rx="6" class="coil ${active ? "energized" : ""}"/><text x="${x + 34}" y="${y + 24}" text-anchor="middle" class="coil-mark">A1 · A2</text></g>`;
  }

  function renderControl(config, raw) {
    const active = raw.devices.km1;
    const relayK = raw.devices.k;
    const stopPressed = raw.operation.sb2 === "pressed";
    const startPressed = raw.operation.sb1 === "pressed";
    const jogPressed = raw.operation.jog === "pressed";
    const activeClass = active ? " active" : "";
    let branches = "";
    let subtitle = "";

    if (config.variant === "mode1") {
      subtitle = raw.operation.selector === "continuous" ? "长动模式：SA 闭合，自锁支路允许保持" : "点动模式：SA 断开，松开 SB1 即停";
      branches = `${contactSymbol(470, 175, "SB1", startPressed || jogPressed, "no", "JOG_PRESS")}${contactSymbol(665, 175, "SB2", stopPressed, "nc", "STOP_PRIMARY_PRESS")}${coilSymbol(820, 155, "KM1", active)}
        <path d="M448 175 H420 V265 H470" class="wire${activeClass}"/><path d="M562 265 H585" class="wire${activeClass}"/>
        ${contactSymbol(492, 265, "SA", raw.operation.selector === "continuous", "no", "START_SECONDARY_PRESS")}${contactSymbol(610, 265, "KM1", active, "no")}
        <path d="M702 265 H735 V175 H643" class="wire${activeClass}"/><text x="565" y="315" text-anchor="middle" class="branch-note">SA + KM1 辅助常开组成可选自锁支路</text>`;
    } else if (config.variant === "mode2") {
      subtitle = "SB1 长动；SB3 复合触点先断自锁、后接通点动路径";
      branches = `${contactSymbol(470, 175, "SB1 长动", startPressed, "no", "START_PRIMARY_PRESS")}${contactSymbol(665, 175, "SB2 停止", stopPressed, "nc", "STOP_PRIMARY_PRESS")}${coilSymbol(820, 155, "KM1", active)}
        <path d="M448 175 H420 V255 H470" class="wire${activeClass}"/>${contactSymbol(492, 255, "SB3 NO", jogPressed, "no", "JOG_PRESS")}<path d="M584 255 H735 V175 H643" class="wire${activeClass}"/>
        <path d="M420 255 V335 H470" class="wire${activeClass}"/>${contactSymbol(492, 335, "SB3 NC", jogPressed, "nc")} ${contactSymbol(610, 335, "KM1", active, "no")}<path d="M702 335 H735 V175" class="wire${activeClass}"/>
        <path d="M527 275 V315" class="mechanical-link"/><text x="585" y="385" text-anchor="middle" class="branch-note">虚线表示 SB3 的 NO/NC 机械联动；点动循环禁止误自锁</text>`;
    } else if (config.variant === "mode3") {
      subtitle = "中间继电器 K 只负责长动记忆；SB3 直接点动 KM1";
      branches = `${contactSymbol(470, 155, "SB1 长动", startPressed, "no", "START_PRIMARY_PRESS")}${contactSymbol(650, 155, "SB2 停止", stopPressed, "nc", "STOP_PRIMARY_PRESS")}${contactSymbol(755, 155, "SB3 NC", jogPressed, "nc")}${coilSymbol(865, 135, "K", relayK)}
        <path d="M448 155 H420 V230 H470" class="wire${relayK ? " active" : ""}"/>${contactSymbol(492, 230, "K 自锁", relayK, "no")}<path d="M584 230 H625 V155 H628" class="wire${relayK ? " active" : ""}"/>
        <path d="M420 155 V330 H470" class="wire${activeClass}"/>${contactSymbol(492, 330, "SB3 NO", jogPressed, "no", "JOG_PRESS")}<path d="M584 330 H610" class="wire${activeClass}"/>${contactSymbol(632, 330, "K NO", relayK, "no")}<path d="M724 330 H790" class="wire${activeClass}"/>${coilSymbol(790, 310, "KM1", active)}<path d="M858 330 H1008" class="wire${activeClass}"/>
        <path d="M790 175 V307" class="mechanical-link"/><text x="650" y="390" text-anchor="middle" class="branch-note">K 失电后其两组常开同时复位，长动记忆与 KM1 驱动职责分离</text>`;
    } else {
      subtitle = "两处启动并联、两处停止串联；任一地点均可启动或停止同一电机";
      const stop2Pressed = raw.operation.station2Stop === "pressed";
      branches = `${contactSymbol(430, 155, "1SB2", stopPressed, "nc", "STOP_PRIMARY_PRESS")}${contactSymbol(565, 155, "2SB2", stop2Pressed, "nc", "STOP_SECONDARY_PRESS")}${contactSymbol(700, 155, "1SB1", startPressed, "no", "START_PRIMARY_PRESS")}${coilSymbol(900, 135, "KM1", active)}
        <path d="M678 155 H650 V245 H700" class="wire${activeClass}"/>${contactSymbol(722, 245, "2SB1", raw.operation.station2Start === "pressed", "no", "START_SECONDARY_PRESS")}<path d="M814 245 H850 V155 H792" class="wire${activeClass}"/>
        <path d="M650 245 V330 H700" class="wire${activeClass}"/>${contactSymbol(722, 330, "KM1 自锁", active, "no")}<path d="M814 330 H850 V155" class="wire${activeClass}"/>
        <g transform="translate(700 410)"><text x="0" y="-18">运行指示（派生显示）</text><circle cx="80" cy="0" r="22" class="lamp ${active ? "on" : ""}"/><path d="M65 -15 L95 15 M95 -15 L65 15" class="lamp-cross"/><text x="80" y="38" text-anchor="middle">HL1</text><circle cx="170" cy="0" r="22" class="lamp ${active ? "on" : ""}"/><path d="M155 -15 L185 15 M185 -15 L155 15" class="lamp-cross"/><text x="170" y="38" text-anchor="middle">HL2</text></g>
        <text x="690" y="495" text-anchor="middle" class="branch-note">HL1/HL2 仅由 Solver 结果派生显示，不参与导通判定</text>`;
    }

    return `<g class="control-circuit"><text x="380" y="112" class="section-title">控制电路</text><text x="380" y="136" class="section-subtitle">${subtitle}</text><path d="M380 148 V520 M1028 148 V520" class="rail${raw.operation.power === "closed" ? " live" : ""}"/><g class="fuse-symbol"><rect x="366" y="154" width="28" height="44" rx="3"/><path d="M380 148 V154 M380 198 V214"/></g>${branches}<path d="M380 175 H448 M912 175 H1028" class="wire${activeClass}"/>${contactSymbol(916, 175, "FR1", raw.operation.fr1 === "overload", "nc", "PROTECTION_TOGGLE")}</g>`;
  }

  function renderSvg(config, raw) {
    const motorRunning = Boolean(raw.solver?.motorStates?.[ns(config.moduleId, "dev", "m")]?.running);
    const phaseClass = motorRunning ? " active current" : "";
    const mainX = [120, 180, 240];
    const phases = mainX.map((x, index) => `<path d="M${x} 110 V455" class="wire phase p${index + 1}${phaseClass}"/>`).join("");
    const switches = mainX.map((x) => `<circle cx="${x}" cy="215" r="4"/><path d="M${x} 215 L${x + (raw.devices.km1 ? 0 : 13)} ${raw.devices.km1 ? 250 : 240}" class="symbol ${raw.devices.km1 ? "closed" : ""}"/>`).join("");
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 1100 600" class="optimized-circuit" role="img" aria-label="${config.title}优化交互电路图"><defs><filter id="softShadow"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-opacity="0.12"/></filter></defs><rect x="18" y="18" width="1064" height="564" rx="24" class="sheet"/><text x="52" y="58" class="drawing-title">${config.title}</text><text x="52" y="84" class="drawing-purpose">${config.purpose}</text><g class="main-circuit"><text x="74" y="112" class="section-title">主电路</text>${phases}<g transform="translate(0 0)"><text x="72" y="160">QF1</text><path d="M108 175 L132 195 M168 175 L192 195 M228 175 L252 195" class="symbol ${raw.operation.power === "closed" ? "closed" : ""}"/><text x="72" y="210">FU1</text><rect x="111" y="195" width="18" height="36"/><rect x="171" y="195" width="18" height="36"/><rect x="231" y="195" width="18" height="36"/><text x="72" y="266">KM1</text>${switches}<text x="72" y="345">FR1</text><rect x="102" y="326" width="156" height="32" rx="5"/></g><circle cx="180" cy="482" r="42" class="motor ${motorRunning ? "running" : ""}"/><text x="180" y="490" text-anchor="middle" class="motor-label">M</text><text x="180" y="548" text-anchor="middle" class="state-label">${motorRunning ? "运行" : "停止"}</text></g>${renderControl(config, raw)}<g class="legend" transform="translate(380 548)"><path d="M0 0 H48" class="wire active current"/><text x="58" y="5">真实导通路径 / Current Flow</text><path d="M290 0 H338" class="wire"/><text x="348" y="5">未导通路径</text><circle cx="530" cy="0" r="5" class="junction"/><text x="542" y="5">明确连接点</text></g></svg>`;
  }

  function feedbackFor(config, raw) {
    const running = Boolean(raw.solver?.motorStates?.[ns(config.moduleId, "dev", "m")]?.running);
    const action = raw.lastAction.type;
    const base = { title: "当前动作原理", summary: raw.lastAction.message, steps: [], tone: running ? "forward" : raw.operation.fr1 === "overload" ? "error" : "off" };
    if (running) {
      base.steps = ["控制电源与保护触点均满足导通条件。", config.runReason, "KM1 线圈得电，主触点闭合。", "三相主回路完整，电动机 M 运行。"];
    } else if (action === "PROTECTION_TOGGLE") {
      base.steps = ["FR1 检测为过载状态。", "FR1 控制常闭触点断开。", "KM1 线圈失电，主触点复位。", "电动机 M 停止。"];
    } else {
      base.steps = ["Solver 已依据当前按钮、开关与保护状态重算。", "当前未形成持续的 KM1 线圈通路。", "KM1 主触点保持断开，电动机停止。"];
    }
    return base;
  }

  function replayFor(config) {
    const common = [
      { id: "power", title: "合上 QF1", description: "三相主回路与控制电源具备供电条件。" },
      ...config.replay,
      { id: "coil", title: "观察 KM1", description: "KM1 线圈状态决定主触点及辅助触点的统一状态。" },
      { id: "motor", title: "观察电机", description: "只有真实三相主回路完整时，M 才进入运行状态。" }
    ];
    return common;
  }

  function createControlFacade(config, context = {}) {
    const contracts = platform.contracts;
    let raw = createInitialRawState(config);
    let mountedNode = null;
    let previousDisplays = [];

    function solve(message = raw.lastAction.message) {
      raw.lastAction.message = String(message || "Solver 重算完成。");
      solveRaw(config, raw);
      return normalizeSolverResult();
    }

    function normalizeSolverResult() {
      return {
        ...contracts.createEmptySolverResult(config.moduleId),
        ...clone(raw.solver)
      };
    }

    function getStateSnapshot() {
      const motor = raw.solver?.motorStates?.[ns(config.moduleId, "dev", "m")] || { running: false, direction: "none" };
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: config.moduleId,
        routeId: config.routeId,
        operation: clone(raw.operation),
        devices: {
          primaryContactor: { id: ns(config.moduleId, "dev", "km1"), energized: raw.devices.km1 },
          modeRelay: { id: ns(config.moduleId, "dev", "k"), energized: raw.devices.k }
        },
        motor: { id: ns(config.moduleId, "dev", "m"), state: motor.running ? "running" : "stopped", running: motor.running, direction: motor.direction }
      };
    }

    function pulse(field) {
      raw.operation[field] = "pressed";
      solveRaw(config, raw);
      raw.operation[field] = "released";
      solveRaw(config, raw);
    }

    function dispatchAction(actionInput) {
      const action = typeof actionInput === "string" ? contracts.createAction(actionInput) : actionInput;
      const report = contracts.validateAction(action);
      if (!report.valid) throw new Error(`Invalid ${config.moduleId} action: ${report.errors.join("; ")}`);
      raw.lastAction = { type: action.type, payload: clone(action.payload), message: "" };
      switch (action.type) {
        case "POWER_CLOSE": raw.operation.power = "closed"; raw.lastAction.message = "QF1 已合闸，Solver 建立供电边界。"; break;
        case "POWER_OPEN": raw.operation.power = "open"; raw.lastAction.message = "QF1 已分闸，所有电气保持状态被清除。"; break;
        case "START_PRIMARY_PRESS": pulse("sb1"); raw.lastAction.message = config.primaryStartMessage; break;
        case "STOP_PRIMARY_PRESS": pulse("sb2"); raw.lastAction.message = config.primaryStopMessage; break;
        case "START_SECONDARY_PRESS":
          if (config.variant === "mode1") {
            raw.operation.selector = raw.operation.selector === "jog" ? "continuous" : "jog";
            raw.lastAction.message = `SA 已切换为${raw.operation.selector === "continuous" ? "长动" : "点动"}模式。`;
          } else {
            pulse("station2Start");
            raw.lastAction.message = "第二地点启动按钮动作，启动并联支路接通。";
          }
          break;
        case "STOP_SECONDARY_PRESS": pulse("station2Stop"); raw.lastAction.message = "第二地点停止按钮动作，串联停止链断开。"; break;
        case "JOG_PRESS": raw.jogCycle = true; raw.operation.jog = "pressed"; raw.lastAction.message = config.jogPressMessage; break;
        case "JOG_RELEASE":
          raw.operation.jog = "released";
          solveRaw(config, raw);
          raw.jogCycle = false;
          raw.lastAction.message = config.jogReleaseMessage;
          break;
        case "PROTECTION_TOGGLE": raw.operation.fr1 = "overload"; raw.lastAction.message = "FR1 过载动作，控制常闭触点断开。"; break;
        case "PROTECTION_RESET": raw.operation.fr1 = "normal"; raw.lastAction.message = "FR1 已复位；复位本身不会启动电动机。"; break;
        case "RESET_MODULE": raw = createInitialRawState(config); break;
        default: throw new Error(`${config.moduleId} does not support ${action.type}`);
      }
      solveRaw(config, raw);
      render();
      return { action, state: getStateSnapshot(), solverResult: normalizeSolverResult(), operationViewModel: getOperationViewModel(), statusViewModel: getStatusViewModel(), feedback: buildTeachingFeedback() };
    }

    function getOperationViewModel() {
      const running = getStateSnapshot().motor.running;
      const controls = config.controls.map((control) => ({ ...control, stateText: running ? control.runningText || "运行中" : control.idleText || "待命" }));
      const protection = { slot: "primary", visible: true, label: "FR1 过载", resetLabel: "FR1 复位", tripped: raw.operation.fr1 === "overload", toggleAction: "PROTECTION_TOGGLE", resetAction: "PROTECTION_RESET" };
      return {
        schemaVersion: contracts.facadeSchemaVersion,
        moduleId: config.moduleId,
        power: { deviceId: "QF1", closed: raw.operation.power === "closed", closeLabel: "QF1 合闸", openLabel: "QF1 分闸", closeEnabled: raw.operation.power !== "closed", openEnabled: raw.operation.power === "closed" },
        controls,
        protection,
        protections: [protection],
        actionStates: controls.filter((item) => item.visible).map((item) => ({ id: item.id, label: item.label, currentState: running ? "running" : "ready", availableTransitions: [item.action], onAction: item.action, feedbackText: item.help }))
      };
    }

    function getStatusViewModel() {
      const snapshot = getStateSnapshot();
      const rows = [
        { id: "power", label: "QF1", value: raw.operation.power === "closed" ? "已合闸" : "断开", tone: raw.operation.power === "closed" ? "on" : "off" },
        ...(config.variant === "mode1" ? [{ id: "selector", label: "SA 模式", value: raw.operation.selector === "continuous" ? "长动" : "点动", tone: "on" }] : []),
        ...(config.variant === "mode3" ? [{ id: "relay", label: "K", value: raw.devices.k ? "得电" : "失电", tone: raw.devices.k ? "forward" : "off" }] : []),
        { id: "contactor", label: "KM1", value: raw.devices.km1 ? "得电" : "失电", tone: raw.devices.km1 ? "forward" : "off" },
        { id: "motor", label: "M", value: snapshot.motor.running ? "运行" : "停止", tone: snapshot.motor.running ? "forward" : "off" },
        { id: "protection", label: "FR1", value: raw.operation.fr1 === "overload" ? "已过载" : "正常", tone: raw.operation.fr1 === "overload" ? "error" : "on" }
      ];
      if (config.variant === "multi") rows.push({ id: "indicators", label: "HL1 / HL2", value: snapshot.motor.running ? "点亮" : "熄灭", tone: snapshot.motor.running ? "forward" : "off" });
      return { schemaVersion: contracts.facadeSchemaVersion, moduleId: config.moduleId, rows };
    }

    function buildTeachingFeedback() { return feedbackFor(config, raw); }
    function buildReplaySteps() { return replayFor(config); }

    function render() {
      if (!mountedNode) return renderSvg(config, raw);
      mountedNode.innerHTML = renderSvg(config, raw);
      return mountedNode;
    }

    function mount() {
      const root = context.mountRoot;
      if (!root || typeof root.appendChild !== "function" || !global.document) return undefined;
      previousDisplays = Array.from(root.children).map((node) => [node, node.style.display]);
      previousDisplays.forEach(([node]) => { node.style.display = "none"; });
      mountedNode = global.document.createElement("section");
      mountedNode.dataset.module = config.moduleId;
      mountedNode.className = "mixed-remote-module-canvas";
      root.appendChild(mountedNode);
      const onClick = (event) => {
        const target = event.target.closest?.("[data-action]");
        if (!target) return;
        const action = target.dataset.action;
        if (action === "JOG_PRESS") {
          dispatchAction("JOG_PRESS");
          if (context.scope?.timeout) context.scope.timeout(() => dispatchAction("JOG_RELEASE"), 500);
        } else {
          dispatchAction(action);
        }
      };
      mountedNode.addEventListener("click", onClick);
      context.scope?.addCleanup?.(() => mountedNode?.removeEventListener("click", onClick));
      render();
      return mountedNode;
    }

    function unmount() {
      mountedNode?.remove();
      mountedNode = null;
      previousDisplays.forEach(([node, display]) => { node.style.display = display; });
      previousDisplays = [];
    }

    function validateGeometry() {
      const data = config.circuitData;
      const unique = (items, key) => new Set(items.map((item) => item[key])).size === items.length;
      const portIds = new Set(data.components.flatMap((item) => item.ports.map((port) => port.portId)));
      const danglingWires = data.wires.filter((wire) => !portIds.has(wire.fromPort) || !portIds.has(wire.toPort));
      return {
        valid: unique(data.components, "componentId") && unique(data.wires, "wireId") && unique(data.deviceEdges, "edgeId") && danglingWires.length === 0 && data.audit.ambiguousCrossingCount === 0,
        geometryLockId: data.geometryLockId,
        componentCount: data.components.length,
        wireCount: data.wires.length,
        danglingWires: danglingWires.map((wire) => wire.wireId),
        ambiguousCrossingCount: data.audit.ambiguousCrossingCount
      };
    }

    function runTests() {
      const failures = [];
      const expect = (condition, message) => { if (!condition) failures.push(message); };
      const resetLocal = () => { raw = createInitialRawState(config); solveRaw(config, raw); };
      resetLocal();
      expect(validateGeometry().valid, "Geometry audit failed");
      dispatchAction("POWER_CLOSE");
      if (config.variant === "mode1") {
        dispatchAction("JOG_PRESS"); expect(getStateSnapshot().motor.running, "Mode 1 should run while SB1 is held in jog mode");
        dispatchAction("JOG_RELEASE"); expect(!getStateSnapshot().motor.running, "Mode 1 should stop after SB1 release in jog mode");
        dispatchAction("START_SECONDARY_PRESS"); dispatchAction("START_PRIMARY_PRESS"); expect(getStateSnapshot().motor.running, "Mode 1 should self-hold in continuous mode");
      } else if (config.variant === "mode2") {
        dispatchAction("START_PRIMARY_PRESS"); expect(getStateSnapshot().motor.running, "Mode 2 SB1 should establish long run");
        dispatchAction("STOP_PRIMARY_PRESS"); dispatchAction("JOG_PRESS"); expect(getStateSnapshot().motor.running, "Mode 2 SB3 should jog while held");
        dispatchAction("JOG_RELEASE"); expect(!getStateSnapshot().motor.running, "Mode 2 SB3 release must not create false self-hold");
      } else if (config.variant === "mode3") {
        dispatchAction("START_PRIMARY_PRESS"); expect(raw.devices.k && getStateSnapshot().motor.running, "Mode 3 relay K should latch long run");
        dispatchAction("STOP_PRIMARY_PRESS"); dispatchAction("JOG_PRESS"); expect(!raw.devices.k && getStateSnapshot().motor.running, "Mode 3 SB3 should bypass K only while held");
        dispatchAction("JOG_RELEASE"); expect(!getStateSnapshot().motor.running, "Mode 3 should stop after jog release");
      } else {
        dispatchAction("START_SECONDARY_PRESS"); expect(getStateSnapshot().motor.running, "Station 2 should start shared KM1");
        dispatchAction("STOP_PRIMARY_PRESS"); expect(!getStateSnapshot().motor.running, "Station 1 stop should interrupt series stop chain");
        dispatchAction("START_PRIMARY_PRESS"); expect(getStateSnapshot().motor.running, "Station 1 should start shared KM1");
        dispatchAction("STOP_SECONDARY_PRESS"); expect(!getStateSnapshot().motor.running, "Station 2 stop should interrupt series stop chain");
      }
      dispatchAction("START_PRIMARY_PRESS");
      dispatchAction("PROTECTION_TOGGLE");
      expect(!getStateSnapshot().motor.running, "FR1 overload must stop motor");
      dispatchAction("PROTECTION_RESET");
      expect(!getStateSnapshot().motor.running, "FR1 reset must not auto-start motor");
      resetLocal();
      return { valid: failures.length === 0, failures, passed: failures.length === 0 ? 8 : Math.max(0, 8 - failures.length), geometry: validateGeometry() };
    }

    solveRaw(config, raw);
    return Object.freeze({
      createInitialState: () => { raw = createInitialRawState(config); solveRaw(config, raw); return getStateSnapshot(); },
      getStateSnapshot,
      dispatchAction,
      solve,
      normalizeSolverResult,
      getOperationViewModel,
      getStatusViewModel,
      buildTeachingFeedback,
      buildReplaySteps,
      mount,
      render,
      reset: () => { raw = createInitialRawState(config); solveRaw(config, raw); render(); return getStateSnapshot(); },
      pause: () => undefined,
      resume: () => undefined,
      unmount,
      validateGeometry,
      runTests
    });
  }

  function createDefinition(config) {
    const circuitData = config.circuitData || buildCircuitData(config);
    const normalized = freezeDeep({ ...config, circuitData });
    return platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData,
      createFacade: (context) => createControlFacade(normalized, context),
      meta: normalized.meta,
      aliases: normalized.aliases || [normalized.moduleId]
    });
  }

  shared.ns = ns;
  shared.buildCircuitData = buildCircuitData;
  shared.createControlFacade = createControlFacade;
  shared.createDefinition = createDefinition;
})(globalThis);
