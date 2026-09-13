(function installCh01ForwardReverseRenderer(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch01_forward_reverse/renderer.js");

  const M = "ch01_forward_reverse";
  const id = (kind, name) => `${M}__${kind}__${name}`;

  function wire(name, path, active, kind = "control", direction = "") {
    const wireId = id("wire", name);
    return `<path class="ectp-wire ${kind}" data-wire-id="${wireId}" d="${path}"/>${active ? `<path class="ectp-current-flow ${kind} ${direction}" data-wire-id="${wireId}" d="${path}" aria-hidden="true"/>` : ""}`;
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

  platform.moduleRenderers.createCh01ForwardReverseRenderer = () => Object.freeze({
    render({ root, internalState: state }) {
      const powered = state.power === "closed";
      const forward = powered && state.direction === "forward";
      const reverse = powered && state.direction === "reverse";
      const running = forward || reverse;
      const status = forward ? "正转运行" : reverse ? "反转运行" : powered ? "已上电待命" : "电源断开";
      const forwardMainA = "M190 150V296M190 364V580H300V735";
      const forwardMainB = "M260 150V296M260 364V600H330V735";
      const forwardMainC = "M330 150V296M330 364V620H360V735";
      const reverseMainA = "M190 150V220H360V466M360 534V580H360V735";
      const reverseMainB = "M260 150V235H430V466M430 534V600H330V735";
      const reverseMainC = "M330 150V250H500V466M500 534V620H300V735";

      root.innerHTML = `<section class="ch01-forward-reverse-module ectp-extension-module ${forward ? "state-forward" : reverse ? "state-reverse" : "state-idle"}" data-module="${M}">
        <div class="ch01-fr-mode-strip"><strong>第一章 · 常用低压电器</strong><span>第61页 · 接触器互锁正反转</span><b class="${forward ? "forward" : reverse ? "reverse" : "idle"}">${status}</b></div>
        <svg class="ch01-fr-board" viewBox="0 0 1509 1134" preserveAspectRatio="xMidYMid meet" role="img" aria-label="第一章第61页A-N控制电源接触器互锁正反转电路">
          <text class="ch01-fr-section-title" x="105" y="82">主电路</text><text class="ch01-fr-section-title" x="620" y="82">控制电路</text>
          <text class="ch01-fr-phase phase-a" x="190" y="128">A</text><text class="ch01-fr-phase phase-b" x="260" y="128">B</text><text class="ch01-fr-phase phase-c" x="330" y="128">C</text>
          ${wire("main_forward_a", forwardMainA, forward, "main", "direction-forward phase-a")}${wire("main_forward_b", forwardMainB, forward, "main", "direction-forward phase-b")}${wire("main_forward_c", forwardMainC, forward, "main", "direction-forward phase-c")}
          ${wire("main_reverse_a", reverseMainA, reverse, "main", "direction-reverse phase-a")}${wire("main_reverse_b", reverseMainB, reverse, "main", "direction-reverse phase-b")}${wire("main_reverse_c", reverseMainC, reverse, "main", "direction-reverse phase-c")}
          ${mainContactor(260, 330, "KM1 正转主触点", forward)}${mainContactor(430, 500, "KM2 反转主触点", reverse)}
          <rect class="ch01-fr-terminal-board" x="275" y="695" width="110" height="58" rx="12"/>
          ${primitives.terminal(300, 735, 4.4)}${primitives.terminal(330, 735, 4.4)}${primitives.terminal(360, 735, 4.4)}
          <text class="ch01-fr-terminal-label" x="300" y="719" text-anchor="middle">U</text><text class="ch01-fr-terminal-label" x="330" y="719" text-anchor="middle">V</text><text class="ch01-fr-terminal-label" x="360" y="719" text-anchor="middle">W</text>
          <text class="ch01-fr-terminal-caption" x="330" y="687" text-anchor="middle">电机接线端子排</text>
          ${wire("motor_terminal_u", "M300 739V770", running, "main", forward ? "direction-forward phase-a" : "direction-reverse phase-c")}
          ${wire("motor_terminal_v", "M330 739V770", running, "main", forward ? "direction-forward phase-b" : "direction-reverse phase-b")}
          ${wire("motor_terminal_w", "M360 739V770", running, "main", forward ? "direction-forward phase-c" : "direction-reverse phase-a")}
          <text class="ch01-fr-small-note" x="430" y="425" text-anchor="middle">KM2：A、C两相换接</text>
          ${primitives.motor({ x: 330, y: 825, labelText: "M", running, direction: reverse ? "reverse" : "forward", subtitle: "三相异步电动机" })}
          <g class="ch01-fr-direction-badge ${forward ? "forward" : reverse ? "reverse" : "idle"}"><rect x="260" y="920" width="140" height="40" rx="20"/><text x="330" y="946" text-anchor="middle">${forward ? "↻  顺时针正转" : reverse ? "↺  逆时针反转" : "停止"}</text></g>

          <line class="ch01-fr-rail" x1="650" y1="135" x2="650" y2="855"/><line class="ch01-fr-rail" x1="1400" y1="135" x2="1400" y2="855"/>
          <text class="ch01-fr-rail-label" x="650" y="118" text-anchor="middle">A</text><text class="ch01-fr-rail-label" x="1400" y="118" text-anchor="middle">N</text><text class="ch01-fr-voltage" x="1025" y="118" text-anchor="middle">A—N 控制电源 220V</text>
          ${wire("control_common", "M650 220H718M802 220H850V750", powered, "control")}${button(760, 220, "SB3 停止", "stop", true)}

          <text class="ch01-fr-branch-title forward" x="850" y="330">正转支路</text>
          ${wire("control_forward_start", "M850 400H878M962 400H1062", false, "control")}${wire("control_forward_hold", "M850 500H882M958 500H1000V400H1062", forward, "control", "direction-forward")}${wire("control_forward_interlock", "M1138 400H1230", forward, "control", "direction-forward")}${wire("control_forward_return", "M1330 400H1400", forward, "control", "direction-forward")}
          ${button(920, 400, "SB1 正转", "forward")}${contact(920, 500, "KM1 常开（自锁）", forward, false, forward)}${contact(1100, 400, "KM2 常闭（互锁）", !reverse, true, forward)}${coil(1280, 400, "KM1 线圈", forward)}

          <text class="ch01-fr-branch-title reverse" x="850" y="580">反转支路</text>
          ${wire("control_reverse_start", "M850 650H878M962 650H1062", false, "control")}${wire("control_reverse_hold", "M850 750H882M958 750H1000V650H1062", reverse, "control", "direction-reverse")}${wire("control_reverse_interlock", "M1138 650H1230", reverse, "control", "direction-reverse")}${wire("control_reverse_return", "M1330 650H1400", reverse, "control", "direction-reverse")}
          ${button(920, 650, "SB2 反转", "reverse")}${contact(920, 750, "KM2 常开（自锁）", reverse, false, reverse)}${contact(1100, 650, "KM1 常闭（互锁）", !forward, true, reverse)}${coil(1280, 650, "KM2 线圈", reverse)}

          <rect class="ch01-fr-principle-box" x="610" y="930" width="830" height="105" rx="14"/>
          <text class="ch01-fr-principle" x="1025" y="968" text-anchor="middle">${forward ? "KM1自锁；KM1常闭互锁触点断开KM2支路" : reverse ? "KM2自锁；KM2常闭互锁触点断开KM1支路" : "SB1控制KM1正转，SB2控制KM2反转，SB3公共停止"}</text>
          <text class="ch01-fr-principle sub" x="1025" y="997" text-anchor="middle">${running ? "运行中按相反方向按钮无效，必须先停止再换向" : "KM1与KM2不能同时吸合"}</text>
          <g class="ch01-fr-sequence ${forward ? "forward" : reverse ? "reverse" : "idle"}"><text x="720" y="1022" text-anchor="end">相序</text>${(forward ? ["A", "B", "C"] : reverse ? ["C", "B", "A"] : ["A", "B", "C"]).map((phase, index) => `<g class="phase-step step-${index + 1}"><circle cx="${750 + index * 42}" cy="1017" r="14"/><text x="${750 + index * 42}" y="1022" text-anchor="middle">${phase}</text></g>`).join("")}</g>
        </svg>
      </section>`;
    }
  });
})(globalThis);
