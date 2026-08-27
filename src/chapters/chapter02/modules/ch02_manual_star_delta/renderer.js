(function installManualStarDeltaRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch02_manual_star_delta/renderer.js");
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

  function block(x, y, label, on, labelAbove = false) {
    return primitives.contactBank({ x, y, on, labelText: label, poleCount: 3, poleSpacing: 28, labelAbove });
  }

  function fuse(x, y) {
    return primitives.fuse({ x, y, labelText: "FU1", poleCount: 3, poleSpacing: 28 });
  }

  function motor(x, y, mode) {
    const on = mode !== "stopped";
    const terminalColumns = [x + 54, x + 75, x + 96];
    const terminalBoard = `<g class="motor-terminal-board"><rect class="sim-button-contactblock" x="${x + 42}" y="${y - 35}" width="66" height="70" rx="10"/><text class="micro-label" x="${x + 75}" y="${y - 42}" text-anchor="middle">电机六端子</text>${terminalColumns.map((cx, index) => `${primitives.terminal(cx, y - 18, 4)}<text class="micro-label" x="${cx}" y="${y - 24}" text-anchor="middle">${["U1", "V1", "W1"][index]}</text>${primitives.terminal(cx, y + 15, 4)}<text class="micro-label" x="${cx}" y="${y + 29}" text-anchor="middle">${["U2", "V2", "W2"][index]}</text>`).join("")}</g>`;
    return `${primitives.motor({ x, y, labelText: "M 3~", running: on, direction: "forward", subtitle: "" })}${terminalBoard}`;
  }

  function button(x, y, label, color) {
    const stop = color === "red";
    return primitives.pushButton({ x, y, labelText: label, color: stop ? "stop" : color === "blue" ? "reverse" : "forward", pressed: false, contactClosed: stop, normalClosed: stop, active: false });
  }

  function coil(x, y, label, on) {
    return primitives.coil({ x, y, labelText: label, on, width: 70, height: 46 });
  }

  platform.moduleRenderers.createManualStarDeltaRenderer = () => Object.freeze({
    render({ root, internalState: s }) {
      const star = s.mode === "star";
      const delta = s.mode === "delta";
      const run = star || delta;
      const mainFeed = "M82 106V121M110 106V121M138 106V121M82 169V196M110 169V196M138 169V196M82 244V265M110 244V265M138 244V265M82 309V332M110 309V332M138 309V332";
      const starMain = "M164 390L232 419M185 390L260 419M206 390L288 419";
      const deltaMain = "M164 357L232 351M185 357L260 351M206 357L288 351";
      const controlFeed = "M330 135H435M485 135H525V200H540M610 200H755M825 200H875";
      const starControl = "M525 200V315H540M610 315H755M825 315H875";
      const deltaControl = "M525 315V405H755M825 405H875";
      root.innerHTML = `
        <section class="manual-star-delta-module" data-module="ch02_manual_star_delta">
          <div class="module-mode-strip"><strong>第二章 · 电器控制系统</strong><span>手动星形—三角形启动</span><b>${star ? "星形启动" : delta ? "三角形运行" : "待命"}</b></div>
          <svg class="teaching-board" viewBox="0 0 920 500" role="img" aria-label="手动星形三角形启动电路仿真">
            <text class="section-title" x="24" y="32">主电路</text><text class="section-title" x="310" y="32">控制电路</text>
            <g class="circuit-wire-layer">
              ${currentPath(mainFeed, run, "main")}${currentPath(starMain, star, "main")}${currentPath(deltaMain, delta, "main")}
              ${currentPath(controlFeed, run)}${currentPath(starControl, star)}${currentPath(deltaControl, delta)}
            </g>
            <line class="rail" x1="330" y1="58" x2="330" y2="450"/><line class="rail" x1="875" y1="58" x2="875" y2="450"/>
            ${qf(110, 75, s.operation.power === "closed")}${fuse(110, 145)}${block(110, 220, "KM", run)}
            <rect class="sim-fr-body" x="65" y="265" width="90" height="44" rx="11"/>${[-28, 0, 28].map((d) => `<rect class="sim-fr-channel" x="${110 + d - 8}" y="271" width="16" height="30" rx="5"/><path class="sim-fr-heater" d="M${110 + d - 4} 275l8 5-8 5 8 5-8 5"/>`).join("")}<text class="board-label" x="54" y="292" text-anchor="end">FR</text>
            ${motor(110, 375, s.mode)}${block(260, 340, "KMΔ", delta, true)}${block(260, 430, "KMY", star, true)}
            ${button(460, 135, "SB3 停止", "red")}${button(575, 200, "SB1 星形", "green")}${button(575, 315, "SB2 三角", "blue")}
            ${coil(790, 200, "KM", run)}${coil(790, 315, "KMY", star)}${coil(790, 405, "KMΔ", delta)}
            <g class="interlock"><rect x="660" y="250" width="150" height="74" rx="12"/><text class="board-label" x="735" y="274" text-anchor="middle">电气互锁</text><text x="735" y="296" text-anchor="middle">KMY 与 KMΔ</text><text class="state-text" x="735" y="316" text-anchor="middle">${run ? "禁止同时吸合" : "待命"}</text></g>
            <g class="legend"><line class="ectp-wire" x1="350" y1="474" x2="390" y2="474"/><text x="398" y="478">未导通</text><line class="ectp-current-flow control" x1="485" y1="474" x2="525" y2="474"/><text x="533" y="478">动态控制电流</text><text class="mode-chip ${star ? "active" : ""}" x="675" y="478">Y 星形</text><text class="mode-chip ${delta ? "active" : ""}" x="770" y="478">Δ 三角形</text></g>
          </svg>
        </section>`;
      root.firstElementChild?.classList.add("ectp-extension-module");
    }
  });
})(globalThis);
