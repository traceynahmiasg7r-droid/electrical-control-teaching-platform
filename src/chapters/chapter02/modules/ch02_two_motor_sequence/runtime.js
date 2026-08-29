(function installTwoMotorSequenceRuntime(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const MODULE_ID = "ch02_two_motor_sequence";
  const GEOMETRY_LOCK_ID = "two_motor_sequence_geometry_v1";

  const PRIMARY_MAIN_WIRES = Object.freeze([
    "mw_01", "mw_02", "mw_03", "mw_04", "mw_05", "mw_06", "mw_07",
    "mw_09", "mw_10", "mw_11", "mw_13", "mw_14", "mw_16", "mw_17",
    "mw_18", "mw_19", "mw_20"
  ]);
  const SECONDARY_MAIN_WIRES = Object.freeze([
    "mw_01", "mw_02", "mw_03", "mw_04", "mw_05", "mw_06", "mw_07",
    "mw_08", "mw_10", "mw_12", "mw_13", "mw_15", "mw_21", "mw_22",
    "mw_23", "mw_24", "mw_25", "mw_26"
  ]);
  const PRIMARY_CONTROL_WIRES = Object.freeze([
    "cw_01", "cw_05", "cw_06", "cw_07", "cw_08", "cw_09", "cw_10",
    "cw_11", "cw_12"
  ]);
  const SECONDARY_CONTROL_WIRES = Object.freeze([
    "cw_01", "cw_02", "cw_03", "cw_14", "cw_15", "cw_16", "cw_17",
    "cw_18", "cw_19", "cw_20"
  ]);
  const POWERED_PARTIAL_WIRES = Object.freeze([
    "mw_01", "mw_02", "mw_03", "mw_04", "mw_05", "mw_06", "mw_07",
    "mw_08", "mw_10", "mw_12", "mw_13", "mw_15",
    "cw_01", "cw_02", "cw_03", "cw_05", "cw_06"
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function createCircuitData(baseCircuitData) {
    if (!baseCircuitData?.ports || !Array.isArray(baseCircuitData.wires)) {
      throw new Error(`${MODULE_ID} requires the formal main-control circuit data`);
    }
    const wires = baseCircuitData.wires.filter((wire) => wire.wireId !== "cw_13");
    const junctions = (baseCircuitData.junctions || []).map((junction) => Object.freeze({
      ...junction,
      wireIds: Object.freeze((junction.wireIds || []).filter((wireId) => wireId !== "cw_13"))
    }));
    const sequenceComponent = Object.freeze({
      componentId: "cmp_km1_sequence",
      deviceId: "dev_km1",
      x: 916,
      y: 681,
      width: 34,
      height: 32,
      label: "KM1 顺序允许"
    });
    const sequenceEdge = Object.freeze({
      edgeId: "edge_km1_sequence_no",
      fromPort: "sb3_r",
      toPort: "km2_after_stop",
      deviceId: "dev_km1",
      domain: "control",
      label: "KM1 顺序允许 NO"
    });
    return Object.freeze({
      schemaVersion: "1.0",
      moduleId: MODULE_ID,
      geometryLockId: GEOMETRY_LOCK_ID,
      reference: baseCircuitData.reference,
      ports: baseCircuitData.ports,
      junctions: Object.freeze(junctions),
      components: Object.freeze([...(baseCircuitData.components || []), sequenceComponent]),
      wires: Object.freeze(wires),
      deviceEdges: Object.freeze([...(baseCircuitData.deviceEdges || []), sequenceEdge])
    });
  }

  function createInitialInternalState() {
    return {
      operationState: {
        qf1: "open",
        sb1: "released",
        sb2: "released",
        sb3: "released",
        sb4: "released",
        fr1: "normal",
        fr2: "normal"
      },
      stableControlState: { km1: false, km2: false },
      solver: null,
      feedback: {
        title: "两台电动机顺序控制待命",
        text: "先合上 QF1，再启动 1M；只有 KM1 吸合后，2M 才具备启动条件。",
        tone: "info",
        source: "solver"
      },
      replaySteps: []
    };
  }

  function createPort(options) {
    const { context, circuitData } = options;
    const wireIds = new Set(circuitData.wires.map((wire) => wire.wireId));
    const edgeIds = new Set(circuitData.deviceEdges.map((edge) => edge.edgeId));
    let internal = createInitialInternalState();

    function available(ids) {
      return unique(ids).filter((wireId) => wireIds.has(wireId));
    }

    function buildEdgeStates(km1, km2) {
      const op = internal.operationState;
      const states = {};
      circuitData.deviceEdges.forEach((edge) => {
        let conductive = true;
        if (edge.edgeId.startsWith("qf1_edge")) conductive = op.qf1 === "closed";
        else if (edge.edgeId === "edge_sb1_nc") conductive = op.sb1 !== "pressed";
        else if (edge.edgeId === "edge_sb2_no") conductive = op.sb2 === "pressed";
        else if (edge.edgeId === "edge_sb3_nc") conductive = op.sb3 !== "pressed";
        else if (edge.edgeId === "edge_sb4_no") conductive = op.sb4 === "pressed";
        else if (edge.edgeId.startsWith("edge_km1_")) conductive = km1;
        else if (edge.edgeId.startsWith("edge_km2_")) conductive = km2;
        else if (edge.edgeId.startsWith("edge_fr1_")) conductive = op.fr1 === "normal";
        else if (edge.edgeId.startsWith("edge_fr2_")) conductive = op.fr2 === "normal";
        states[edge.edgeId] = conductive;
      });
      return states;
    }

    function solve(actionMessage = "two motor sequence solve") {
      const op = internal.operationState;
      let km1 = Boolean(internal.stableControlState.km1);
      let km2 = Boolean(internal.stableControlState.km2);
      let iterationCount = 0;
      let converged = false;
      for (let index = 0; index < 8; index += 1) {
        iterationCount = index + 1;
        const nextKm1 = op.qf1 === "closed"
          && op.fr1 === "normal"
          && op.sb1 !== "pressed"
          && (op.sb2 === "pressed" || km1);
        const nextKm2 = op.qf1 === "closed"
          && op.fr2 === "normal"
          && nextKm1
          && op.sb3 !== "pressed"
          && (op.sb4 === "pressed" || km2);
        if (nextKm1 === km1 && nextKm2 === km2) {
          converged = true;
          break;
        }
        km1 = nextKm1;
        km2 = nextKm2;
      }
      internal.stableControlState = { km1, km2 };
      const activeMainWireIds = available([
        ...(km1 ? PRIMARY_MAIN_WIRES : []),
        ...(km2 ? SECONDARY_MAIN_WIRES : [])
      ]);
      const activeControlWireIds = available([
        ...(km1 ? PRIMARY_CONTROL_WIRES : []),
        ...(km2 ? SECONDARY_CONTROL_WIRES : [])
      ]);
      const activeSet = new Set([...activeMainWireIds, ...activeControlWireIds]);
      const partialControlWireIds = op.qf1 === "closed"
        ? available(POWERED_PARTIAL_WIRES).filter((wireId) => !activeSet.has(wireId))
        : [];
      const edgeStates = buildEdgeStates(km1, km2);
      internal.solver = {
        stableDeviceStates: { KM1: km1, KM2: km2 },
        edgeStates,
        activeMainWireIds,
        activeControlWireIds,
        partialControlWireIds,
        activeMainEdgeIds: [...edgeIds].filter((edgeId) => edgeStates[edgeId] && circuitData.deviceEdges.find((edge) => edge.edgeId === edgeId)?.domain === "main"),
        activeControlEdgeIds: [...edgeIds].filter((edgeId) => edgeStates[edgeId] && circuitData.deviceEdges.find((edge) => edge.edgeId === edgeId)?.domain !== "main"),
        motorStates: {
          motor1: km1 ? "running" : "stopped",
          motor2: km2 ? "running" : "stopped"
        },
        controlSupplyBoundary: op.qf1 === "closed" ? "energized" : "isolated",
        converged,
        iterationCount,
        lastAction: actionMessage
      };
      return readRawState();
    }

    function setFeedback(title, text, tone = "info", steps = []) {
      internal.feedback = { title, text, tone, source: "solver" };
      internal.replaySteps = steps;
    }

    function replay(label, action, text) {
      return [
        { label: "操作前", action: "RESET_MODULE", text: "确认 QF1、按钮、保护器和两台电动机的当前状态。" },
        { label, action, text },
        { label: "求解结果", action: "SOLVE", text: "Solver 重新计算接触器、保护和电流路径。" }
      ];
    }

    function renderAndNotify() {
      render();
      context.services?.renderShell?.();
    }

    function momentary(key, label, message) {
      internal.operationState[key] = "pressed";
      solve(`${label} pressed`);
      internal.operationState[key] = "released";
      solve(`${label} released`);
      const { km1, km2 } = internal.stableControlState;
      setFeedback(
        label,
        `${message} 当前 1M ${km1 ? "运行" : "停止"}，2M ${km2 ? "运行" : "停止"}。`,
        km1 || km2 ? "on" : "info",
        replay(label, `${key.toUpperCase()}_PRESS`, message)
      );
      renderAndNotify();
      return readRawState();
    }

    function readRawState() {
      return {
        operationState: clone(internal.operationState),
        stableControlState: clone(internal.stableControlState),
        solver: clone(internal.solver)
      };
    }

    function reset() {
      internal = createInitialInternalState();
      solve("two motor sequence reset");
      render();
      return readRawState();
    }

    function togglePower() {
      const closing = internal.operationState.qf1 !== "closed";
      internal.operationState.qf1 = closing ? "closed" : "open";
      solve(closing ? "QF1 closed" : "QF1 opened");
      setFeedback(
        closing ? "QF1 已合闸" : "QF1 已分闸",
        closing ? "控制电源接通，两条控制支路进入待命。" : "主电源和控制电源断开，KM1、KM2 均释放。",
        closing ? "on" : "off",
        replay(closing ? "QF1 合闸" : "QF1 分闸", closing ? "POWER_CLOSE" : "POWER_OPEN", closing ? "系统进入待命。" : "两台电动机停止。")
      );
      renderAndNotify();
      return readRawState();
    }

    function toggleProtection(key, label, actionId) {
      const tripping = internal.operationState[key] !== "overload";
      internal.operationState[key] = tripping ? "overload" : "normal";
      solve(`${label} ${tripping ? "overload" : "normal"}`);
      setFeedback(
        `${label} ${tripping ? "过载动作" : "恢复正常"}`,
        key === "fr1"
          ? (tripping ? "FR1 动作使 KM1 释放，并通过顺序条件使 KM2 同步释放。" : "FR1 已恢复，但 1M 和 2M 不会自动重启。")
          : (tripping ? "FR2 动作只切断 2M 支路，1M 保持运行。" : "FR2 已恢复，但 2M 不会自动重启。"),
        tripping ? "error" : "info",
        replay(`${label} ${tripping ? "过载" : "复位"}`, actionId, "保护状态改变后由 Solver 重新计算。")
      );
      renderAndNotify();
      return readRawState();
    }

    function resetProtection(key, label, actionId) {
      internal.operationState[key] = "normal";
      solve(`${label} reset`);
      setFeedback(`${label} 已复位`, "保护触点恢复闭合，电动机保持停止，需重新按启动按钮。", "info", replay(`${label} 复位`, actionId, "保护恢复但禁止自动重启。"));
      renderAndNotify();
      return readRawState();
    }

    function pathData(routePoints) {
      return (routePoints || []).map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
      })[character]);
    }

    function edgeConductive(edgeId) {
      return Boolean(internal.solver?.edgeStates?.[edgeId]);
    }

    function edgeMarkup(edge) {
      const from = circuitData.ports[edge.fromPort];
      const to = circuitData.ports[edge.toPort];
      if (!from || !to) return "";
      const conductive = edgeConductive(edge.edgeId);
      const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
      if (conductive) {
        return `<path class="two-motor-device-edge conductive" data-edge-id="${escapeHtml(edge.edgeId)}" d="M ${from.x} ${from.y} L ${to.x} ${to.y}" />`;
      }
      if (horizontal) {
        const middle = (from.x + to.x) / 2;
        return `<g class="two-motor-device-edge open" data-edge-id="${escapeHtml(edge.edgeId)}"><path d="M ${from.x} ${from.y} L ${middle - 8} ${from.y}"/><path d="M ${middle - 8} ${from.y} L ${middle + 8} ${from.y - 12}"/><path d="M ${middle + 8} ${to.y} L ${to.x} ${to.y}"/></g>`;
      }
      const middle = (from.y + to.y) / 2;
      return `<g class="two-motor-device-edge open" data-edge-id="${escapeHtml(edge.edgeId)}"><path d="M ${from.x} ${from.y} L ${from.x} ${middle - 8}"/><path d="M ${from.x} ${middle - 8} L ${from.x + 12} ${middle + 8}"/><path d="M ${to.x} ${middle + 8} L ${to.x} ${to.y}"/></g>`;
    }

    function componentMarkup(component) {
      const active = component.deviceId === "dev_km1"
        ? internal.stableControlState.km1
        : component.deviceId === "dev_km2"
          ? internal.stableControlState.km2
          : component.deviceId === "dev_motor_1"
            ? internal.solver.motorStates.motor1 === "running"
            : component.deviceId === "dev_motor_2"
              ? internal.solver.motorStates.motor2 === "running"
              : false;
      const centerX = component.x + component.width / 2;
      const centerY = component.y + component.height / 2;
      if (component.componentId.startsWith("cmp_motor")) {
        return `<g class="two-motor-component motor ${active ? "active" : ""}" data-component-id="${escapeHtml(component.componentId)}"><circle cx="${centerX}" cy="${centerY}" r="48"/><text x="${centerX}" y="${centerY - 2}">${escapeHtml(component.label)}</text><text class="motor-state" x="${centerX}" y="${centerY + 24}">${active ? "运行" : "停止"}</text></g>`;
      }
      if (component.componentId.startsWith("cmp_coil")) {
        return `<g class="two-motor-component coil ${active ? "active" : ""}" data-component-id="${escapeHtml(component.componentId)}"><rect x="${component.x + 8}" y="${component.y + 20}" width="${component.width - 16}" height="36" rx="4"/><text x="${centerX}" y="${component.y + 14}">${escapeHtml(component.label)}</text></g>`;
      }
      if (component.componentId.startsWith("cmp_fr") && component.componentId.endsWith("_main")) {
        return `<g class="two-motor-component protection" data-component-id="${escapeHtml(component.componentId)}"><rect x="${component.x}" y="${component.y + 10}" width="${component.width}" height="34" rx="5"/><text x="${centerX}" y="${component.y + 5}">${escapeHtml(component.label)}</text></g>`;
      }
      if (component.componentId.startsWith("cmp_fu")) {
        return `<g class="two-motor-component fuse" data-component-id="${escapeHtml(component.componentId)}"><rect x="${component.x + 3}" y="${component.y + 18}" width="${Math.max(10, component.width - 6)}" height="34"/><text x="${centerX}" y="${component.y + 12}">${escapeHtml(component.label)}</text></g>`;
      }
      return `<g class="two-motor-component ${active ? "active" : ""}" data-component-id="${escapeHtml(component.componentId)}"><text x="${centerX}" y="${component.y - 7}">${escapeHtml(component.label)}</text></g>`;
    }

    function render() {
      if (!context.mountRoot || !internal.solver) return;
      const activeMain = new Set(internal.solver.activeMainWireIds);
      const activeControl = new Set(internal.solver.activeControlWireIds);
      const partial = new Set(internal.solver.partialControlWireIds);
      const wireMarkup = circuitData.wires.map((wire) => `<path class="two-motor-wire base ${escapeHtml(wire.kind)}" data-wire-id="${escapeHtml(wire.wireId)}" d="${pathData(wire.routePoints)}" />`).join("");
      const partialMarkup = circuitData.wires.filter((wire) => partial.has(wire.wireId)).map((wire) => `<path class="two-motor-wire partial" data-current-wire-id="${escapeHtml(wire.wireId)}" d="${pathData(wire.routePoints)}" />`).join("");
      const activeMarkup = circuitData.wires.filter((wire) => activeMain.has(wire.wireId) || activeControl.has(wire.wireId)).map((wire) => `<path class="two-motor-wire current ${escapeHtml(wire.kind)}" data-current-wire-id="${escapeHtml(wire.wireId)}" d="${pathData(wire.routePoints)}" />`).join("");
      const edges = circuitData.deviceEdges.map(edgeMarkup).join("");
      const components = circuitData.components.map(componentMarkup).join("");
      const junctions = circuitData.junctions.map((junction) => `<circle class="two-motor-junction" cx="${junction.x}" cy="${junction.y}" r="4" />`).join("");
      context.mountRoot.innerHTML = `
        <article class="two-motor-sequence-module" data-module-id="${MODULE_ID}">
          <header class="two-motor-module-heading">
            <div><span class="two-motor-kicker">顺序启动实验</span><h3>两台电动机顺序控制</h3></div>
            <div class="two-motor-sequence-rule"><strong>KM1 顺序允许</strong><span>1M 运行后，2M 才可启动</span></div>
          </header>
          <div class="two-motor-canvas-wrap">
            <svg class="two-motor-circuit" viewBox="0 0 1509 1030" role="img" aria-label="两台电动机顺序控制电路">
              <text class="two-motor-zone-title" x="120" y="92">主电路</text>
              <text class="two-motor-zone-title" x="792" y="350">控制电路</text>
              <text class="two-motor-supply-label" x="135" y="145">L1</text>
              <text class="two-motor-supply-label" x="210" y="145">L2</text>
              <text class="two-motor-supply-label" x="284" y="145">L3</text>
              <text class="two-motor-supply-label" x="788" y="405">L</text>
              <text class="two-motor-supply-label" x="1404" y="405">N</text>
              <g class="two-motor-wire-layer">${wireMarkup}${partialMarkup}${activeMarkup}</g>
              <g class="two-motor-edge-layer">${edges}</g>
              <g class="two-motor-component-layer">${components}</g>
              <g class="two-motor-junction-layer">${junctions}</g>
            </svg>
          </div>
        </article>`;
    }

    function validateGeometry() {
      const errors = [];
      const seenWireIds = new Set();
      circuitData.wires.forEach((wire) => {
        if (seenWireIds.has(wire.wireId)) errors.push(`duplicate wireId ${wire.wireId}`);
        seenWireIds.add(wire.wireId);
        if (!circuitData.ports[wire.fromPort] || !circuitData.ports[wire.toPort]) errors.push(`${wire.wireId} has missing port`);
        if (!Array.isArray(wire.routePoints) || wire.routePoints.length < 2) errors.push(`${wire.wireId} has invalid routePoints`);
      });
      if (seenWireIds.has("cw_13")) errors.push("legacy cw_13 must be replaced by the KM1 sequence device edge");
      if (!edgeIds.has("edge_km1_sequence_no")) errors.push("sequence permit edge is missing");
      const solverWireIds = new Set([
        ...(internal.solver?.activeMainWireIds || []),
        ...(internal.solver?.activeControlWireIds || []),
        ...(internal.solver?.partialControlWireIds || [])
      ]);
      solverWireIds.forEach((wireId) => {
        if (!seenWireIds.has(wireId)) errors.push(`solver wireId ${wireId} is not formal circuit data`);
      });
      return {
        valid: errors.length === 0,
        errors,
        geometryLockId: circuitData.geometryLockId,
        counts: { ports: Object.keys(circuitData.ports).length, wires: circuitData.wires.length, deviceEdges: circuitData.deviceEdges.length }
      };
    }

    function runTests() {
      const saved = clone(internal);
      const results = [];
      const check = (name, pass, detail = "") => results.push({ name, pass: Boolean(pass), detail });
      try {
        reset();
        togglePower();
        momentary("sb4", "SB4 启动 2M", "尝试先启动 2M。 ");
        check("M2 cannot start before M1", !internal.stableControlState.km2);

        momentary("sb2", "SB2 启动 1M", "KM1 建立自锁。 ");
        check("M1 self-holds after SB2 release", internal.stableControlState.km1 && internal.operationState.sb2 === "released");

        momentary("sb4", "SB4 启动 2M", "KM1 已提供顺序允许。 ");
        check("M2 starts after KM1 permit", internal.stableControlState.km1 && internal.stableControlState.km2);

        momentary("sb1", "SB1 停止 1M", "KM1 释放。 ");
        check("stopping M1 cascades M2", !internal.stableControlState.km1 && !internal.stableControlState.km2);

        momentary("sb2", "SB2 启动 1M", "重新启动 1M。 ");
        momentary("sb4", "SB4 启动 2M", "重新启动 2M。 ");
        toggleProtection("fr2", "FR2", "PROTECTION_SECONDARY_TOGGLE");
        check("FR2 stops only M2", internal.stableControlState.km1 && !internal.stableControlState.km2);

        resetProtection("fr2", "FR2", "PROTECTION_SECONDARY_RESET");
        check("FR2 reset does not auto restart M2", internal.stableControlState.km1 && !internal.stableControlState.km2);

        momentary("sb4", "SB4 启动 2M", "再次启动 2M。 ");
        toggleProtection("fr1", "FR1", "PROTECTION_TOGGLE");
        check("FR1 overload cascades both motors", !internal.stableControlState.km1 && !internal.stableControlState.km2);

        check("solver converges", internal.solver.converged && internal.solver.iterationCount <= 8);
        const geometry = validateGeometry();
        check("formal geometry and solver wire IDs are valid", geometry.valid, geometry.errors.join("; "));
      } finally {
        internal = saved;
        render();
      }
      return results;
    }

    solve("two motor sequence initial solve");

    return Object.freeze({
      readRawState,
      reset,
      solve,
      togglePower,
      startPrimary: () => momentary("sb2", "SB2 启动 1M", "KM1 线圈得电并建立自锁。"),
      stopPrimary: () => momentary("sb1", "SB1 停止 1M", "KM1 释放，顺序允许触点断开，KM2 同步释放。"),
      startSecondary: () => momentary("sb4", "SB4 启动 2M", internal.stableControlState.km1 ? "KM1 顺序允许触点已闭合。" : "KM1 尚未吸合，2M 被顺序条件锁定。"),
      stopSecondary: () => momentary("sb3", "SB3 停止 2M", "只切断 KM2 控制支路，1M 保持原状态。"),
      toggleProtection: () => toggleProtection("fr1", "FR1", "PROTECTION_TOGGLE"),
      resetProtection: () => resetProtection("fr1", "FR1", "PROTECTION_RESET"),
      toggleSecondaryProtection: () => toggleProtection("fr2", "FR2", "PROTECTION_SECONDARY_TOGGLE"),
      resetSecondaryProtection: () => resetProtection("fr2", "FR2", "PROTECTION_SECONDARY_RESET"),
      render,
      pause: () => undefined,
      unmount: () => context.mountRoot?.replaceChildren(),
      validateGeometry,
      runTests,
      getFeedback: () => clone(internal.feedback),
      getReplaySteps: () => clone(internal.replaySteps)
    });
  }

  platform.twoMotorSequenceRuntime = Object.freeze({ createCircuitData, createPort });
})(globalThis);
