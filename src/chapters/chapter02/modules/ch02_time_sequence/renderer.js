(function installTimeSequenceRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch02_time_sequence/renderer.js");
  const activeClass = (on) => on ? "is-active" : "";

  function terminal(x, y) {
    return primitives.terminal(x, y, 5);
  }

  function currentPath(path, on, kind = "control") {
    const phase = kind === "main" ? "main phase-l2" : "control";
    return `<path class="ectp-wire ${phase} ${activeClass(on)}" d="${path}"/>${on ? `<path class="ectp-current-flow ${phase}" d="${path}" aria-hidden="true"/>` : ""}`;
  }

  function qf(x, y, on) {
    return primitives.qf({ x, y, on, labelText: "QF1", formal: true, poleSpacing: 28 });
  }

  function block(x, y, label, on) {
    return primitives.contactBank({ x, y, on, labelText: label, poleCount: 3, poleSpacing: 28 });
  }

  function fuse(x, y) {
    return primitives.fuse({ x, y, labelText: "FU1", poleCount: 3, poleSpacing: 28 });
  }

  function motor(x, y, on) {
    const resistorTerminals = [-20, 0, 20].map((dy, index) => `${terminal(x + 49, y + dy)}<text class="micro-label" x="${x + 59}" y="${y + dy + 4}">R${index + 1}</text>`).join("");
    return `${primitives.motor({ x, y, labelText: "M 3~", running: on, direction: "forward", subtitle: "绕线转子电动机" })}${resistorTerminals}`;
  }

  function button(x, y, label, color) {
    const stop = color === "red";
    return primitives.pushButton({ x, y, labelText: label, color: stop ? "stop" : color === "blue" ? "reverse" : "forward", pressed: false, contactClosed: stop, normalClosed: stop, active: false });
  }

  function coil(x, y, label, on) {
    return primitives.coil({ x, y, labelText: label, on, width: 64, height: 42, timer: label.startsWith("KT") });
  }

  function timerContact(x, y, label, on) {
    return `<g><rect class="sim-contact-frame" x="${x - 34}" y="${y - 20}" width="68" height="40" rx="9"/><circle class="sim-contact-fixed" cx="${x - 20}" cy="${y}" r="4"/><circle class="sim-contact-fixed" cx="${x + 20}" cy="${y}" r="4"/><line class="sim-contact-arm ${on ? "is-live" : ""}" x1="${x - 16}" y1="${y}" x2="${on ? x + 16 : x + 8}" y2="${on ? y : y - 11}"/><path class="sim-timer-mark" d="M${x - 5} ${y + 14}v-27m0 0l-6 6m6-6l6 6"/><text class="board-label" x="${x}" y="${y - 28}" text-anchor="middle">${label}</text></g>`;
  }

  function resistorBank(x, y, stage) {
    return `<g><text class="board-label" x="${x}" y="${y - 54}" text-anchor="middle">转子电阻分级切除</text>${[0, 1, 2].map((index) => { const yy = y + index * 45; const on = stage <= index; return `<path class="resistor ${on ? "is-in" : "is-bypassed"}" d="M${x - 55} ${yy}h10l6-10 12 20 12-20 12 20 6-10h10"/><text class="board-label" x="${x + 72}" y="${yy + 5}">R${index + 1}</text><circle class="stage-lamp ${stage > index ? "on" : ""}" cx="${x - 72}" cy="${yy}" r="8"/>`; }).join("")}</g>`;
  }

  platform.moduleRenderers.createTimeSequenceRenderer = () => Object.freeze({
    render({ root, internalState: s }) {
      const run = s.running;
      const mainFeed = "M77 103V116M105 103V116M133 103V116M77 164V191M105 164V191M133 164V191M77 239V255M105 239V255M133 239V255M77 299V322M105 299V322M133 299V322";
      const rotorFeed = "M145 345H158V335H175M145 365H165V380H175M145 385H172V425H175";
      const controlFeed = "M340 120H430M480 120H515V180H530M580 180H758M822 180H875";
      const stage1 = "M515 180V270H511M579 270H658M722 270H875";
      const stage2 = "M515 270V345H511M579 345H658M722 345H875";
      const stage3 = "M515 345V420H511M579 420H758M822 420H875";
      root.innerHTML = `
        <section class="time-sequence-module" data-module="ch02_time_sequence">
          <div class="module-mode-strip"><strong>第二章 · 电器控制系统</strong><span>时间原则控制线路</span><b>${run ? `第 ${s.stage}/3 阶段` : "待命"}</b></div>
          <svg class="teaching-board" viewBox="0 0 920 500" role="img" aria-label="时间原则三级电阻启动电路仿真">
            <text class="section-title" x="24" y="32">主电路</text><text class="section-title" x="310" y="32">控制电路</text>
            <g class="circuit-wire-layer">
              ${currentPath(mainFeed, run, "main")}${currentPath(rotorFeed, run, "main")}${currentPath(controlFeed, run)}
              ${currentPath(stage1, run && s.stage >= 1)}${currentPath(stage2, run && s.stage >= 2)}${currentPath(stage3, run && s.stage >= 3)}
            </g>
            <line class="rail" x1="340" y1="55" x2="340" y2="450"/><line class="rail" x1="875" y1="55" x2="875" y2="450"/>
            ${qf(105, 72, s.operation.power === "closed")}${fuse(105, 140)}${block(105, 215, "KM", run)}
            <rect class="sim-fr-body" x="60" y="255" width="90" height="44" rx="11"/>${[-28, 0, 28].map((d) => `<rect class="sim-fr-channel" x="${105 + d - 8}" y="262" width="16" height="30" rx="5"/><path class="sim-fr-heater" d="M${105 + d - 4} 266l8 5-8 5 8 5-8 5"/>`).join("")}<text class="board-label" x="49" y="282" text-anchor="end">FR</text>
            ${motor(105, 365, run)}${resistorBank(230, 335, s.stage)}
            ${button(455, 120, "SB2 停止", "red")}${button(555, 180, "SB1 启动", "green")}${coil(790, 180, "KM", run)}
            ${timerContact(545, 270, "KT1", s.stage >= 1)}${coil(690, 270, "KM1", s.stage >= 1)}
            ${timerContact(545, 345, "KT2", s.stage >= 2)}${coil(690, 345, "KM2", s.stage >= 2)}
            ${timerContact(545, 420, "KT3", s.stage >= 3)}${coil(790, 420, "KM3", s.stage >= 3)}
            <g class="sequence-track">${[0, 1, 2, 3].map((index) => `<circle class="step-dot ${s.stage >= index && run ? "active" : ""}" cx="${420 + index * 105}" cy="470" r="10"/><text x="${420 + index * 105}" y="493" text-anchor="middle">${index === 0 ? "全电阻" : `KT${index}`}</text>${index < 3 ? `<line x1="${432 + index * 105}" y1="470" x2="${513 + index * 105}" y2="470"/>` : ""}`).join("")}</g>
          </svg>
        </section>`;
      root.firstElementChild?.classList.add("ectp-extension-module");
    }
  });
})(globalThis);
