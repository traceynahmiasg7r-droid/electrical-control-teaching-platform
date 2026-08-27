(function installTimedAutoStopRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const primitives = platform.electricalPrimitives;
  if (!primitives) throw new Error("electrical-simulation-primitives.js must load before ch01_timed_auto_stop/renderer.js");
  const live = (on) => on ? "is-live" : "";

  function terminals(x, y) {
    return primitives.terminal(x, y, 5);
  }

  function qf(x, y, on) {
    return primitives.qf({ x, y, on, labelText: "QF1", formal: true, poleSpacing: 28 });
  }

  function fuse(x, y) {
    return primitives.fuse({ x, y, labelText: "FU1", poleCount: 3, poleSpacing: 28 });
  }

  function contactor(x, y, on) {
    return primitives.contactBank({ x, y, on, labelText: "KM1", poleCount: 3, poleSpacing: 28 });
  }

  function motor(x, y, on) {
    return primitives.motor({ x, y, labelText: "M", running: on, direction: "forward", subtitle: "三相异步电动机" });
  }

  function button(x, y) {
    return primitives.pushButton({ x, y, labelText: "SB1 启动", color: "forward", pressed: false, contactClosed: false, active: false });
  }

  function coil(x, y, label, on) {
    return primitives.coil({ x, y, labelText: label, on, width: 70, height: 46, timer: label.startsWith("KT") });
  }

  function timerWindow(x, y, label, remaining, on) {
    return `<g class="sim-timer-window ${on ? "is-counting" : ""}"><rect x="${x - 31}" y="${y - 10}" width="62" height="22" rx="6"/><circle cx="${x - 20}" cy="${y + 1}" r="6"/><path d="M${x - 20} ${y + 1}l3-4"/><text class="timer-window-label" x="${x - 8}" y="${y - 1}">${label}</text><text class="timer-window-value" x="${x - 8}" y="${y + 8}">${remaining}s</text></g>`;
  }

  function timerContact(x, y, open) {
    return `<g><rect class="sim-contact-frame" x="${x - 38}" y="${y - 22}" width="76" height="44" rx="10"/><circle class="sim-contact-fixed" cx="${x - 23}" cy="${y}" r="4"/><circle class="sim-contact-fixed" cx="${x + 23}" cy="${y}" r="4"/><line class="sim-contact-arm ${open ? "" : "is-live"}" x1="${x - 19}" y1="${y}" x2="${open ? x + 11 : x + 19}" y2="${open ? y - 12 : y}"/><path class="sim-timer-mark" d="M${x - 6} ${y + 14}v-28m0 0l-7 7m7-7l7 7"/><text class="board-label" x="${x}" y="${y - 31}" text-anchor="middle">KT2 延时 NC</text></g>`;
  }

  platform.moduleRenderers.createTimedAutoStopRenderer = () => Object.freeze({
    render({ root, internalState: s }) {
      const remaining = Math.max(0, 120 - s.elapsed);
      const mainPath = "M84 112V134M112 112V134M140 112V134M84 182V221M112 182V221M140 182V221M84 269V345M112 269V345M140 269V345";
      const controlPath = "M318 126H384M436 126H612M688 126H755M825 126H874M318 270H615M685 270H874M318 350H755M825 350H874";
      const holdPath = "M360 126V205H520";
      root.innerHTML = `<section class="timed-auto-stop-module" data-module="ch01_timed_auto_stop"><div class="module-mode-strip"><strong>第一章 · 常用低压电器</strong><span>定时自动停止：120 秒（预览每步 30 秒）</span><b>${s.running ? `倒计时 ${remaining}s` : s.completed ? "已自动停止" : "待命"}</b></div><svg class="teaching-board" viewBox="0 0 920 500" role="img" aria-label="电机启动后运行四分钟自动停止电路仿真"><text class="section-title" x="24" y="32">主电路</text><text class="section-title" x="280" y="32">控制电路</text>${qf(112, 82, s.operation.power === "closed")}${fuse(112, 158)}${contactor(112, 245, s.running)}${motor(112, 390, s.running)}<path class="ectp-wire main phase-l2 ${s.running ? "is-active" : ""}" d="${mainPath}"/>${s.running ? `<path class="ectp-current-flow main phase-l2" d="${mainPath}"/>` : ""}<line class="rail" x1="318" y1="58" x2="318" y2="440"/><line class="rail" x1="874" y1="58" x2="874" y2="440"/><text class="rail-label" x="306" y="54">L</text><text class="rail-label" x="880" y="54">N</text>${button(410, 126)}${timerContact(650, 126, s.completed)}${coil(790, 126, "KM1", s.running)}${coil(650, 270, "KT1 120s", s.running)}${timerWindow(716, 270, "KT1", remaining, s.running)}${coil(790, 350, "KT2 120s", s.running)}${timerWindow(716, 350, "KT2", remaining, s.running)}<path class="ectp-wire control ${s.running ? "is-active" : ""}" d="${controlPath}"/>${s.running ? `<path class="ectp-current-flow control" d="${controlPath}"/>` : ""}<path class="ectp-wire control ${s.running ? "is-active" : ""}" d="${holdPath}"/>${s.running ? `<path class="ectp-current-flow control" d="${holdPath}"/>` : ""}<rect class="sim-contact-frame" x="520" y="183" width="82" height="44" rx="10"/><line class="sim-contact-arm ${live(s.running)}" x1="535" y1="205" x2="${s.running ? 587 : 575}" y2="${s.running ? 205 : 191}"/><text class="board-label" x="561" y="175" text-anchor="middle">KM1 自锁</text><g class="legend"><line class="ectp-wire" x1="330" y1="462" x2="370" y2="462"/><text x="378" y="466">未导通</text><line class="ectp-current-flow control" x1="470" y1="462" x2="510" y2="462"/><text x="518" y="466">动态控制电流</text><rect class="timer-progress" x="650" y="455" width="200" height="10" rx="5"/><rect class="timer-progress-fill" x="650" y="455" width="${200 * s.elapsed / 120}" height="10" rx="5"/><text x="650" y="448">KT1 / KT2 倒计时：剩余 ${remaining} 秒</text></g></svg></section>`;
      root.firstElementChild?.classList.add("ectp-extension-module");
    }
  });
})(globalThis);
