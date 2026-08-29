(function installMixedControlRenderer(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch02_mixed_control/renderer.js");
  const MODULE_ID = "ch02_mixed_control";

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function points(routePoints) {
    return routePoints.map((point) => `${point.x},${point.y}`).join(" ");
  }

  function shortId(value) {
    return value.split("__").pop();
  }

  function isDeviceOn(component, operation, result) {
    const deviceOn = Boolean(result.stableDeviceStates[component.deviceId]);
    const localDevice = shortId(component.deviceId);
    if (component.type === "breaker") return operation.power === "closed";
    if (component.type === "thermal_relay") return operation.protection === "normal";
    if (component.type === "fuse") return true;
    if (component.type === "motor") return result.motorStates[`${MODULE_ID}__dev__m1`]?.running;
    if (component.type === "selector_switch") return operation.saMode === "continuous";
    if (localDevice === "sb3") return component.partType === "nc" ? operation.jog !== "pressed" : operation.jog === "pressed";
    if (localDevice === "sb2") return operation.stop !== "pressed";
    if (localDevice === "sb1") return operation.start === "pressed";
    return deviceOn;
  }

  function componentMarkup(component, operation, result) {
    const { x, y, width, height } = component.geometry;
    const label = escapeText(component.label.text);
    const active = isDeviceOn(component, operation, result);
    const localDevice = shortId(component.deviceId);
    const pressed = localDevice === "sb1" ? operation.start === "pressed"
      : localDevice === "sb2" ? operation.stop === "pressed"
        : localDevice === "sb3" ? operation.jog === "pressed"
          : false;
    if (component.type === "breaker") return primitives.qf({ x, y, on: active, labelText: label, formal: true, poleSpacing: 44 });
    if (component.type === "contactor" && component.partType === "main_contact") return primitives.contactBank({ x, y, on: active, labelText: label, poleCount: 3, poleSpacing: 44 });
    if (component.type === "fuse" && component.partType === "fuse_set") return primitives.fuse({ x, y, labelText: label, poleCount: 3, poleSpacing: 44 });
    if (component.type === "thermal_relay" && component.partType === "thermal_element") return primitives.thermalRelay({ x, y, labelText: label, tripped: operation.protection !== "normal", poleSpacing: 44 });
    if (component.type === "motor") return primitives.motor({ x, y, labelText: "M", running: active, direction: result.motorStates[`${MODULE_ID}__dev__m1`]?.direction || "forward", subtitle: "三相异步电动机" });
    if (component.type === "fuse") return primitives.fuse({ x, y, labelText: label, poleCount: 1 });
    if (component.partType === "coil") return primitives.coil({ x, y, labelText: label, on: active, width, height });
    if (component.type === "selector_switch") return primitives.selectorSwitch({ x, y, labelText: label, mode: active ? "continuous" : "jog" });
    if (component.type === "push_button") return primitives.pushButton({ x, y, labelText: label, color: component.label.text.includes("停止") ? "stop" : component.label.text.includes("SB3") ? "reverse" : "forward", pressed, contactClosed: active, normalClosed: component.partType === "nc", active });
    return primitives.inlineContact({ x, y, labelText: label, closed: component.partType === "nc" ? !active : active, normalClosed: component.partType === "nc", active, width });
  }

  function wiresMarkup(wires, result) {
    const activeMain = new Set(result.activeMainWireIds);
    const activeControl = new Set(result.activeControlWireIds);
    const partial = new Set(result.partialWireIds);
    return wires.map((wire) => {
      const active = activeMain.has(wire.wireId) || activeControl.has(wire.wireId);
      const phaseClass = wire.phase ? `phase-${wire.phase.toLowerCase()}` : "";
      const currentKind = wire.circuitDomain === "main" ? `main ${phaseClass}` : "control";
      const base = `<polyline class="ectp-wire ${wire.circuitDomain} ${phaseClass} ${active ? "is-active" : ""} ${partial.has(wire.wireId) ? "is-partial" : ""}" points="${points(wire.routePoints)}" data-wire-id="${wire.wireId}"/>`;
      const flow = active ? `<polyline class="ectp-current-flow ${currentKind}" points="${points(wire.routePoints)}" aria-hidden="true"/>` : "";
      return base + flow;
    }).join("");
  }

  function render(options) {
    const { root, circuitData, internalState, solverResult, dispatch } = options;
    const operation = internalState.operation;
    const variant = circuitData.variants[operation.scheme];
    const schemeButtons = [
      ["one", "方式一"], ["two", "方式二"], ["three", "方式三"]
    ].map(([value, label]) => `<button type="button" class="mixed-scheme-btn ${operation.scheme === value ? "is-active" : ""}" data-mixed-scheme="${value}" aria-pressed="${operation.scheme === value}">${label}</button>`).join("");
    const saControls = operation.scheme === "one" ? `
      <div class="mixed-sa-control" role="group" aria-label="SA 转换开关">
        <span>SA</span>
        <button type="button" class="${operation.saMode === "jog" ? "is-active" : ""}" data-mixed-sa="jog">点动</button>
        <button type="button" class="${operation.saMode === "continuous" ? "is-active" : ""}" data-mixed-sa="continuous">长动</button>
      </div>` : "";

    root.innerHTML = `
      <section class="mixed-module ectp-extension-module" data-module="${MODULE_ID}">
        <div class="mixed-toolbar">
          <div class="mixed-scheme-tabs" role="group" aria-label="接线方式">${schemeButtons}</div>
          ${saControls}
          <span class="mixed-scheme-title">${escapeText(variant.title)}</span>
        </div>
        <div class="mixed-board-shell">
          <svg class="mixed-board" viewBox="0 0 940 540" role="img" aria-label="${escapeText(variant.title)}电路仿真图">
            <rect class="ectp-zone" x="22" y="22" width="202" height="494" rx="13"/>
            <rect class="ectp-zone" x="262" y="22" width="656" height="494" rx="13"/>
            <text class="ectp-section-title" x="44" y="49">主电路</text>
            <text class="ectp-section-title" x="284" y="49">控制电路</text>
            <text class="ectp-phase-label" x="68" y="34" text-anchor="middle">L1</text>
            <text class="ectp-phase-label" x="112" y="34" text-anchor="middle">L2</text>
            <text class="ectp-phase-label" x="156" y="34" text-anchor="middle">L3</text>
            ${wiresMarkup(circuitData.mainWires, solverResult)}
            ${wiresMarkup(variant.wires, solverResult)}
            ${circuitData.mainComponents.map((item) => componentMarkup(item, operation, solverResult)).join("")}
            ${variant.components.map((item) => componentMarkup(item, operation, solverResult)).join("")}
            ${operation.scheme === "three" ? `<line class="ectp-mechanical-link" x1="662" y1="151" x2="500" y2="229"/><text class="ectp-micro-label" x="579" y="196">SB3 机械联动</text>` : ""}
            <g class="ectp-legend" transform="translate(284 462)">
              <line class="ectp-wire" x1="0" y1="0" x2="42" y2="0"/><text x="50" y="4">未导通</text>
              <line class="ectp-current-flow control" x1="138" y1="0" x2="180" y2="0"/><text x="188" y="4">控制电流</text>
              <line class="ectp-current-flow main phase-l2" x1="300" y1="0" x2="342" y2="0"/><text x="350" y="4">主回路电流</text>
            </g>
          </svg>
        </div>
      </section>`;

    root.querySelectorAll("[data-mixed-scheme]").forEach((button) => {
      button.addEventListener("click", () => dispatch("START_SECONDARY_PRESS", { scheme: button.dataset.mixedScheme }));
    });
    root.querySelectorAll("[data-mixed-sa]").forEach((button) => {
      button.addEventListener("click", () => dispatch("START_SECONDARY_PRESS", { kind: "sa", position: button.dataset.mixedSa }));
    });
  }

  platform.moduleRenderers.createMixedControlRenderer = () => Object.freeze({ render });
})(globalThis);
