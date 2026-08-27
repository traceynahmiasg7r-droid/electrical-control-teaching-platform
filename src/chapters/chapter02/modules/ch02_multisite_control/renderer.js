(function installMultisiteControlRenderer(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch02_multisite_control/renderer.js");
  const MODULE_ID = "ch02_multisite_control";
  const DEV = (localId) => `${MODULE_ID}__dev__${localId}`;
  const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const points = (routePoints) => routePoints.map((point) => `${point.x},${point.y}`).join(" ");

  function componentOn(component, operation, result) {
    if (component.type === "breaker") return operation.power === "closed";
    if (component.type === "fuse") return true;
    if (component.type === "thermal_relay") return operation.protection === "normal";
    if (component.type === "motor") return result.motorStates[DEV("m1")]?.running;
    if (component.type === "indicator") return result.extension.indicators[component.deviceId] === "on";
    if (component.deviceId === DEV("km1")) return Boolean(result.stableDeviceStates[DEV("km1")]);
    if (component.partType === "nc") return true;
    return false;
  }

  function indicatorMarkup(component, active) {
    const { x, y } = component.geometry;
    const label = escapeText(component.label.text);
    return `<g class="ectp-component ${active ? "is-active" : ""} ectp-indicator"><circle class="repo-sim-lamp-bezel" cx="${x}" cy="${y}" r="23"/><circle class="repo-sim-lamp-glass" cx="${x}" cy="${y}" r="17"/><circle class="repo-sim-lamp-filament" cx="${x}" cy="${y}" r="7"/><line class="repo-sim-lamp-cross" x1="${x - 11}" y1="${y - 11}" x2="${x + 11}" y2="${y + 11}"/><line class="repo-sim-lamp-cross" x1="${x + 11}" y1="${y - 11}" x2="${x - 11}" y2="${y + 11}"/><text class="ectp-label" x="${x}" y="${y - 31}" text-anchor="middle">${label}</text><text class="ectp-prototype-badge" x="${x + 28}" y="${y + 4}">原型</text></g>`;
  }

  function componentMarkup(component, operation, result) {
    const { x, y, width, height } = component.geometry;
    const label = escapeText(component.label.text);
    const active = componentOn(component, operation, result);
    const localDevice = component.deviceId.split("__").pop();
    const pressed = localDevice === "1sb1" ? operation.start1 === "pressed"
      : localDevice === "2sb1" ? operation.start2 === "pressed"
        : localDevice === "1sb2" ? operation.stop1 === "pressed"
          : localDevice === "2sb2" ? operation.stop2 === "pressed"
            : false;
    if (component.type === "breaker") return primitives.qf({ x, y, on: active, labelText: label, formal: true, poleSpacing: 44 });
    if (component.type === "contactor" && component.partType === "main_contact") return primitives.contactBank({ x, y, on: active, labelText: label, poleCount: 3, poleSpacing: 44 });
    if (component.type === "fuse" && component.partType === "fuse_set") return primitives.fuse({ x, y, labelText: label, poleCount: 3, poleSpacing: 44 });
    if (component.type === "thermal_relay" && component.partType === "thermal_element") return primitives.thermalRelay({ x, y, labelText: label, tripped: operation.protection !== "normal", poleSpacing: 44 });
    if (component.type === "motor") return primitives.motor({ x, y, labelText: "M", running: active, direction: result.motorStates[DEV("m1")]?.direction || "forward", subtitle: "三相异步电动机" });
    if (component.type === "fuse") return primitives.fuse({ x, y, labelText: label, poleCount: 1 });
    if (component.partType === "coil") return primitives.coil({ x, y, labelText: label, on: active, width, height });
    if (component.type === "indicator") return indicatorMarkup(component, active);
    if (component.type === "push_button") return primitives.pushButton({ x, y, labelText: label, color: component.partType === "nc" ? "stop" : "forward", pressed, contactClosed: component.partType === "nc" ? !pressed : active, normalClosed: component.partType === "nc", active: component.partType === "nc" ? !pressed : active });
    return primitives.inlineContact({ x, y, labelText: label, closed: component.partType === "nc" ? !active : active, normalClosed: component.partType === "nc", active, width });
  }

  function wiresMarkup(wires, result) {
    const active = new Set([...result.activeMainWireIds, ...result.activeControlWireIds]);
    const partial = new Set(result.partialWireIds);
    return wires.map((wire) => {
      const isActive = active.has(wire.wireId);
      const phaseClass = wire.phase ? `phase-${wire.phase.toLowerCase()}` : "";
      const kind = wire.circuitDomain === "main" ? `main ${phaseClass}` : "control";
      return `<polyline class="ectp-wire ${wire.circuitDomain} ${phaseClass} ${isActive ? "is-active" : ""} ${partial.has(wire.wireId) ? "is-partial" : ""}" points="${points(wire.routePoints)}" data-wire-id="${wire.wireId}"/>${isActive ? `<polyline class="ectp-current-flow ${kind}" points="${points(wire.routePoints)}" aria-hidden="true"/>` : ""}`;
    }).join("");
  }

  function render({ root, circuitData, internalState, solverResult }) {
    const operation = internalState.operation;
    root.innerHTML = `
      <section class="multisite-module ectp-extension-module" data-module="${MODULE_ID}">
        <div class="multisite-summary">
          <span><strong>地点一</strong> 1SB1 启动 / 1SB2 停止</span>
          <span><strong>地点二</strong> 2SB1 启动 / 2SB2 停止</span>
          <span class="multisite-rule">启动并联 · 停止串联 · 共控 KM1</span>
        </div>
        <div class="multisite-board-shell">
          <svg class="multisite-board" viewBox="0 0 940 540" role="img" aria-label="多地点远程控制电路仿真图">
            <rect class="ectp-zone" x="22" y="22" width="202" height="494" rx="13"/>
            <rect class="ectp-zone" x="262" y="22" width="656" height="494" rx="13"/>
            <text class="ectp-section-title" x="44" y="49">主电路</text><text class="ectp-section-title" x="284" y="49">控制电路</text>
            <text class="ectp-phase-label" x="68" y="34" text-anchor="middle">L1</text><text class="ectp-phase-label" x="112" y="34" text-anchor="middle">L2</text><text class="ectp-phase-label" x="156" y="34" text-anchor="middle">L3</text>
            ${wiresMarkup(circuitData.mainWires, solverResult)}${wiresMarkup(circuitData.controlWires, solverResult)}
            ${circuitData.mainComponents.map((item) => componentMarkup(item, operation, solverResult)).join("")}
            ${circuitData.controlComponents.map((item) => componentMarkup(item, operation, solverResult)).join("")}
            <g class="ectp-legend" transform="translate(284 462)"><line class="ectp-wire" x1="0" y1="0" x2="42" y2="0"/><text x="50" y="4">未导通</text><line class="ectp-current-flow control" x1="138" y1="0" x2="180" y2="0"/><text x="188" y="4">控制电流</text><line class="ectp-current-flow main phase-l2" x1="300" y1="0" x2="342" y2="0"/><text x="350" y="4">主回路电流</text></g>
          </svg>
        </div>
      </section>`;
  }

  platform.moduleRenderers.createMultisiteControlRenderer = () => Object.freeze({ render });
})(globalThis);
