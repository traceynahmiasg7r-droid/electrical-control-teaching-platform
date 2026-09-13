(function installCh01ForwardReverseRenderer(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch01_forward_reverse/renderer.js");

  const M = "ch01_forward_reverse";
  const id = (kind, name) => `${M}__${kind}__${name}`;

  function pathData(wire) {
    const breaks = new Set(wire.routeBreaks || []);
    return wire.routePoints.map((point, index, points) => {
      if (index === 0 || breaks.has(index)) return `M${point.x} ${point.y}`;
      const previous = points[index - 1];
      if (point.x === previous.x) return `V${point.y}`;
      if (point.y === previous.y) return `H${point.x}`;
      return `L${point.x} ${point.y}`;
    }).join("");
  }

  function renderWire(wire, activeWireIds, partialWireIds, direction) {
    const path = pathData(wire);
    const active = activeWireIds.has(wire.wireId);
    const partial = !active && partialWireIds.has(wire.wireId);
    const flowClass = wire.directionalFlowClass?.[direction] || wire.flowClass || "";
    const overlay = active || partial
      ? `<path class="ectp-current-flow ${wire.circuitDomain} ${flowClass} ${partial ? "partial" : ""}" data-wire-id="${wire.wireId}" d="${path}" aria-hidden="true"/>`
      : "";
    return `<path class="ectp-wire ${wire.circuitDomain}" data-wire-id="${wire.wireId}" d="${path}"/>${overlay}`;
  }

  function button(x, y, label, color, normalClosed = false) {
    return primitives.pushButton({ x, y, labelText: label, color, pressed: false, contactClosed: normalClosed, normalClosed, active: normalClosed });
  }

  function contact(x, y, label, closed, normalClosed = false, active = false) {
    return primitives.inlineContact({ x, y, labelText: label, closed: normalClosed ? !closed : closed, normalClosed, active, width: 76 });
  }

  function coil(x, y, label, on) {
    return primitives.coil({ x, y, labelText: label, on, width: 100, height: 62 });
  }

  function mainContactor(x, y, label, on) {
    return primitives.contactBank({ x, y, on, labelText: label, poleCount: 3, poleSpacing: 70 });
  }

  platform.moduleRenderers.createCh01ForwardReverseRenderer = (circuitData) => {
    const wireMap = new Map(circuitData.wires.map((wire) => [wire.wireId, wire]));
    const circuitWire = (name) => {
      const value = wireMap.get(id("wire", name));
      if (!value) throw new Error(`${M} renderer requires formal wire ${name}`);
      return value;
    };

    return Object.freeze({
    render({ root, internalState: state, solverResult }) {
      const activeWireIds = new Set([...(solverResult.activeMainWireIds || []), ...(solverResult.activeControlWireIds || [])]);
      const partialWireIds = new Set(solverResult.partialWireIds || []);
      const forward = Boolean(solverResult.stableDeviceStates?.[id("dev", "km1")]);
      const reverse = Boolean(solverResult.stableDeviceStates?.[id("dev", "km2")]);
      const running = Boolean(solverResult.motorStates?.[id("dev", "motor")]?.running);
      const powered = state.power === "closed";
      const direction = forward ? "forward" : reverse ? "reverse" : "stopped";
      const drawWire = (name) => renderWire(circuitWire(name), activeWireIds, partialWireIds, direction);
      const status = forward ? "正转运行" : reverse ? "反转运行" : powered ? "已上电待命" : "电源断开";

      root.innerHTML = `<section class="ch01-forward-reverse-module ectp-extension-module ${forward ? "state-forward" : reverse ? "state-reverse" : "state-idle"}" data-module="${M}">
        <div class="ch01-fr-mode-strip"><strong>第一章 · 常用低压电器</strong><span>第61页 · 接触器互锁正反转</span><b class="${forward ? "forward" : reverse ? "reverse" : "idle"}">${status}</b></div>
        <svg class="ch01-fr-board" viewBox="0 0 1509 1134" preserveAspectRatio="xMidYMid meet" role="img" aria-label="第一章第61页A-N控制电源接触器互锁正反转电路">
          <text class="ch01-fr-section-title" x="105" y="82">主电路</text><text class="ch01-fr-section-title" x="620" y="82">控制电路</text>
          <text class="ch01-fr-phase phase-a" x="190" y="128">A</text><text class="ch01-fr-phase phase-b" x="260" y="128">B</text><text class="ch01-fr-phase phase-c" x="330" y="128">C</text>
          ${drawWire("main_forward_a")}${drawWire("main_forward_b")}${drawWire("main_forward_c")}
          ${drawWire("main_reverse_a")}${drawWire("main_reverse_b")}${drawWire("main_reverse_c")}
          ${mainContactor(260, 330, "KM1 正转主触点", forward)}${mainContactor(430, 500, "KM2 反转主触点", reverse)}
          <rect class="ch01-fr-terminal-board" x="275" y="695" width="110" height="58" rx="12"/>
          ${primitives.terminal(300, 735, 4.4)}${primitives.terminal(330, 735, 4.4)}${primitives.terminal(360, 735, 4.4)}
          <text class="ch01-fr-terminal-label" x="300" y="719" text-anchor="middle">U</text><text class="ch01-fr-terminal-label" x="330" y="719" text-anchor="middle">V</text><text class="ch01-fr-terminal-label" x="360" y="719" text-anchor="middle">W</text>
          <text class="ch01-fr-terminal-caption" x="330" y="687" text-anchor="middle">电机接线端子排</text>
          ${drawWire("motor_terminal_u")}
          ${drawWire("motor_terminal_v")}
          ${drawWire("motor_terminal_w")}
          <text class="ch01-fr-small-note" x="430" y="425" text-anchor="middle">KM2：A、C两相换接</text>
          ${primitives.motor({ x: 330, y: 825, labelText: "M", running, direction: reverse ? "reverse" : "forward", subtitle: "三相异步电动机" })}
          <g class="ch01-fr-direction-badge ${forward ? "forward" : reverse ? "reverse" : "idle"}"><rect x="260" y="920" width="140" height="40" rx="20"/><text x="330" y="946" text-anchor="middle">${forward ? "↻  顺时针正转" : reverse ? "↺  逆时针反转" : "停止"}</text></g>

          <line class="ch01-fr-rail" x1="650" y1="135" x2="650" y2="855"/><line class="ch01-fr-rail" x1="1400" y1="135" x2="1400" y2="855"/>
          <text class="ch01-fr-rail-label" x="650" y="118" text-anchor="middle">A</text><text class="ch01-fr-rail-label" x="1400" y="118" text-anchor="middle">N</text><text class="ch01-fr-voltage" x="1025" y="118" text-anchor="middle">A—N 控制电源 220V</text>
          ${drawWire("control_common")}${button(760, 220, "SB3 停止", "stop", true)}

          <text class="ch01-fr-branch-title forward" x="850" y="330">正转支路</text>
          ${drawWire("control_forward_start")}${drawWire("control_forward_hold")}${drawWire("control_forward_interlock")}${drawWire("control_forward_return")}
          ${button(920, 400, "SB1 正转", "forward")}${contact(920, 500, "KM1 常开（自锁）", forward, false, forward)}${contact(1100, 400, "KM2 常闭（互锁）", !reverse, true, forward)}${coil(1280, 400, "KM1 线圈", forward)}

          <text class="ch01-fr-branch-title reverse" x="850" y="580">反转支路</text>
          ${drawWire("control_reverse_start")}${drawWire("control_reverse_hold")}${drawWire("control_reverse_interlock")}${drawWire("control_reverse_return")}
          ${button(920, 650, "SB2 反转", "reverse")}${contact(920, 750, "KM2 常开（自锁）", reverse, false, reverse)}${contact(1100, 650, "KM1 常闭（互锁）", !forward, true, reverse)}${coil(1280, 650, "KM2 线圈", reverse)}

          <rect class="ch01-fr-principle-box" x="610" y="930" width="830" height="105" rx="14"/>
          <text class="ch01-fr-principle" x="1025" y="968" text-anchor="middle">${forward ? "KM1自锁；KM1常闭互锁触点断开KM2支路" : reverse ? "KM2自锁；KM2常闭互锁触点断开KM1支路" : "SB1控制KM1正转，SB2控制KM2反转，SB3公共停止"}</text>
          <text class="ch01-fr-principle sub" x="1025" y="997" text-anchor="middle">${running ? "运行中按相反方向按钮无效，必须先停止再换向" : "KM1与KM2不能同时吸合"}</text>
          <g class="ch01-fr-sequence ${forward ? "forward" : reverse ? "reverse" : "idle"}"><text x="720" y="1022" text-anchor="end">相序</text>${(forward ? ["A", "B", "C"] : reverse ? ["C", "B", "A"] : ["A", "B", "C"]).map((phase, index) => `<g class="phase-step step-${index + 1}"><circle cx="${750 + index * 42}" cy="1017" r="14"/><text x="${750 + index * 42}" y="1022" text-anchor="middle">${phase}</text></g>`).join("")}</g>
        </svg>
      </section>`;
    }
  });
  };
})(globalThis);
