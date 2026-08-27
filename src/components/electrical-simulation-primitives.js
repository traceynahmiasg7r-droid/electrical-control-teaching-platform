(function installElectricalSimulationPrimitives(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const escapeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const stateClass = (active) => active ? " is-active is-live" : "";

  function terminal(x, y, radius = 4.4) {
    return `<g class="sim-terminal"><circle class="sim-terminal-outer" cx="${x}" cy="${y}" r="${radius}"/><circle class="sim-terminal-inner" cx="${x}" cy="${y}" r="${Math.max(2.2, radius - 1.8)}"/><line class="sim-terminal-slot" x1="${x - 2}" y1="${y}" x2="${x + 2}" y2="${y}"/></g>`;
  }

  function label(x, y, text, anchor = "middle", className = "sim-piece-label") {
    if (!text) return "";
    return `<text class="${className}" x="${x}" y="${y}" text-anchor="${anchor}">${escapeText(text)}</text>`;
  }

  function qf({ x, y, on = false, labelText = "QF1", formal = true, poleSpacing = 28 }) {
    const offsets = [-poleSpacing, 0, poleSpacing];
    const width = poleSpacing * 2 + 40;
    const top = y - 38;
    const bottom = y + 38;
    const housing = formal ? "" : `<rect class="sim-qf-body" x="${x - width / 2}" y="${top}" width="${width}" height="76" rx="18"/><rect class="sim-qf-top" x="${x - 27}" y="${top + 8}" width="54" height="12" rx="6"/><rect class="sim-qf-window" x="${x - 17}" y="${top + 18}" width="34" height="42" rx="10"/><rect class="sim-qf-link-bar" x="${x - 36}" y="${bottom - 14}" width="72" height="10" rx="5"/><circle class="sim-qf-indicator" cx="${x}" cy="${top + 40}" r="7"/><text class="sim-qf-status ${on ? "is-on" : "is-off"}" x="${x}" y="${top + 43}">${on ? "ON" : "OFF"}</text>`;
    const poles = offsets.map((offset, index) => {
      const px = x + offset;
      const bridgeX = on ? px : px + 8;
      const bridgeY = on ? bottom - 18 : y + 10 + index * 2;
      return `${terminal(px, top - 5, 4.7)}${terminal(px, bottom + 5, 4.7)}<rect class="sim-qf-pole" x="${px - 9}" y="${top + 12}" width="18" height="52" rx="7"/><line class="sim-qf-copper" x1="${px - 4}" y1="${top + 28}" x2="${px + 4}" y2="${top + 28}"/><line class="sim-detail" x1="${px}" y1="${top - 5}" x2="${px}" y2="${top + 16}"/><line class="sim-detail" x1="${px}" y1="${bottom - 12}" x2="${px}" y2="${bottom + 5}"/><line class="${on ? "sim-contact-bridge-live" : "sim-contact-bridge-open"}" x1="${px}" y1="${top + 20}" x2="${bridgeX}" y2="${bridgeY}"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-qf${stateClass(on)}" data-component-kind="qf">${housing}${poles}<line class="sim-qf-handle" x1="${x}" y1="${y - 3}" x2="${on ? x - 15 : x + 14}" y2="${on ? y - 28 : y - 22}"/>${label(x - width / 2 - 10, y + 5, labelText, "end")}</g>`;
  }

  function fuse({ x, y, labelText = "FU1", poleCount = 3, poleSpacing = 28 }) {
    const offsets = poleCount === 1 ? [0] : Array.from({ length: poleCount }, (_, index) => (index - (poleCount - 1) / 2) * poleSpacing);
    const poles = offsets.map((offset) => {
      const px = x + offset;
      return `${terminal(px, y - 31, 4.2)}${terminal(px, y + 31, 4.2)}<rect class="sim-fuse-shell" x="${px - 11}" y="${y - 25}" width="22" height="50" rx="9"/><line class="sim-fuse-strap" x1="${px}" y1="${y - 31}" x2="${px}" y2="${y - 18}"/><line class="sim-fuse-strap" x1="${px}" y1="${y + 18}" x2="${px}" y2="${y + 31}"/><rect class="sim-fuse-window" x="${px - 6}" y="${y - 17}" width="12" height="34" rx="6"/><path class="sim-fuse-core" d="M ${px} ${y - 13} L ${px - 3} ${y - 6} L ${px + 3} ${y} L ${px - 2} ${y + 8} L ${px + 3} ${y + 15}"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-fuse" data-component-kind="fuse">${poles}${label(x - (poleCount === 1 ? 18 : poleSpacing + 20), y + 5, labelText, "end")}</g>`;
  }

  function contactBank({ x, y, on = false, labelText = "KM1", poleCount = 3, poleSpacing = 28 }) {
    const offsets = poleCount === 1 ? [0] : Array.from({ length: poleCount }, (_, index) => (index - (poleCount - 1) / 2) * poleSpacing);
    const poles = offsets.map((offset) => {
      const px = x + offset;
      return `${terminal(px, y - 29, 4.4)}${terminal(px, y + 29, 4.4)}<line class="sim-detail" x1="${px}" y1="${y - 29}" x2="${px}" y2="${y - 13}"/><line class="sim-detail" x1="${px}" y1="${y + 13}" x2="${px}" y2="${y + 29}"/><circle class="sim-contact-fixed" cx="${px}" cy="${y - 11}" r="3.8"/><circle class="sim-contact-fixed" cx="${px}" cy="${y + 11}" r="3.8"/><line class="${on ? "sim-contact-bridge-live" : "sim-contact-bridge-open"}" x1="${px}" y1="${y + 8}" x2="${on ? px : px + 10}" y2="${on ? y - 8 : y - 1}"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-contact-bank${stateClass(on)}" data-component-kind="contactor">${poles}${label(x - (poleCount === 1 ? 18 : poleSpacing + 20), y + 5, labelText, "end")}</g>`;
  }

  function inlineContact({ x, y, closed = false, labelText = "", normalClosed = false, active = false, width = 76 }) {
    const left = x - width / 2;
    const right = x + width / 2;
    const effectiveClosed = normalClosed ? !closed : closed;
    return `<g class="ectp-sim-piece ectp-inline-contact${stateClass(active)}" data-component-kind="contact">${terminal(left, y, 4.4)}${terminal(right, y, 4.4)}<line class="sim-detail" x1="${left}" y1="${y}" x2="${left + 15}" y2="${y}"/><line class="sim-detail" x1="${right - 15}" y1="${y}" x2="${right}" y2="${y}"/><circle class="sim-contact-fixed" cx="${left + 15}" cy="${y}" r="3.6"/><circle class="sim-contact-fixed" cx="${right - 15}" cy="${y}" r="3.6"/><line class="${effectiveClosed ? "sim-contact-bridge-live" : "sim-contact-bridge-open"}" x1="${left + 18}" y1="${y}" x2="${effectiveClosed ? right - 18 : right - 24}" y2="${effectiveClosed ? y : y - 10}"/><path class="sim-contact-spring" d="M ${x + 3} ${y + 9} q 3 -4 6 0 q 3 4 6 0"/>${normalClosed ? `<line class="sim-contact-nc-mark" x1="${x + 12}" y1="${y - 13}" x2="${x + 18}" y2="${y - 5}"/>` : ""}${label(x, y - 24, labelText)}</g>`;
  }

  function pushButton({ x, y, labelText, color = "forward", pressed = false, contactClosed = false, active = false, normalClosed = false }) {
    const left = x - 42;
    const right = x + 42;
    const pressOffset = pressed ? 4 : 0;
    const effectiveClosed = normalClosed ? !pressed : contactClosed;
    const capClass = color === "stop" ? "sim-button-cap-stop" : color === "reverse" ? "sim-button-cap-reverse" : "sim-button-cap-forward";
    return `<g class="ectp-sim-piece ectp-push-button${pressed ? " is-pressed" : ""}${stateClass(active)}" data-component-kind="push-button"><rect class="sim-button-contactblock" x="${left - 4}" y="${y - 11}" width="92" height="22" rx="8"/>${terminal(left, y, 4.4)}${terminal(right, y, 4.4)}<line class="sim-detail" x1="${left}" y1="${y}" x2="${left + 15}" y2="${y}"/><line class="sim-detail" x1="${right - 15}" y1="${y}" x2="${right}" y2="${y}"/><line class="${effectiveClosed ? "sim-contact-bridge-live" : "sim-contact-bridge-open"}" x1="${left + 15}" y1="${y}" x2="${effectiveClosed ? right - 15 : right - 18}" y2="${effectiveClosed ? y : y - 8}"/><path class="sim-contact-spring" d="M ${x + 3} ${y + 9} q 3 -4 6 0 q 3 4 6 0"/><line class="sim-button-stem" x1="${x}" y1="${y - 8 + pressOffset}" x2="${x}" y2="${y - 24}"/><rect class="sim-button-backplate" x="${x - 22}" y="${y - 52}" width="44" height="18" rx="9"/><circle class="${capClass}" cx="${x}" cy="${y - 36 + pressOffset}" r="16"/><circle class="sim-button-ring" cx="${x}" cy="${y - 36 + pressOffset}" r="21"/>${normalClosed ? `<line class="sim-contact-nc-mark" x1="${x + 12}" y1="${y - 13}" x2="${x + 18}" y2="${y - 5}"/>` : ""}${label(x, y - 62, labelText)}</g>`;
  }

  function coil({ x, y, labelText, on = false, width = 70, height = 46, timer = false }) {
    const left = x - width / 2;
    const right = x + width / 2;
    const timerMark = timer ? `<circle class="sim-timer-dial" cx="${x + width / 2 - 11}" cy="${y - height / 2 + 11}" r="7"/><line class="sim-timer-hand" x1="${x + width / 2 - 11}" y1="${y - height / 2 + 11}" x2="${x + width / 2 - 7}" y2="${y - height / 2 + 6}"/>` : "";
    return `<g class="ectp-sim-piece ectp-coil${stateClass(on)}" data-component-kind="${timer ? "timer" : "coil"}"><rect class="sim-coil-body" x="${left}" y="${y - height / 2}" width="${width}" height="${height}" rx="12"/>${on ? `<rect class="sim-coil-highlight" x="${left + 7}" y="${y - height / 2 + 7}" width="${width - 14}" height="${height - 14}" rx="9"/>` : ""}${terminal(left, y, 4.4)}${terminal(right, y, 4.4)}<line class="sim-detail" x1="${left}" y1="${y}" x2="${left + 10}" y2="${y}"/><line class="sim-detail" x1="${right - 10}" y1="${y}" x2="${right}" y2="${y}"/><rect class="sim-coil-core" x="${x - 11}" y="${y - 10}" width="22" height="20" rx="6"/><path class="sim-coil-winding" d="M ${left + 8} ${y} q 7 -12 14 0 q 7 12 14 0 q 7 -12 14 0 q 7 12 14 0"/>${timerMark}${label(x, y - height / 2 - 10, labelText)}</g>`;
  }

  function thermalRelay({ x, y, labelText = "FR1", tripped = false, poleSpacing = 28 }) {
    const offsets = [-poleSpacing, 0, poleSpacing];
    const poles = offsets.map((offset) => {
      const px = x + offset;
      return `${terminal(px, y - 30, 4.4)}${terminal(px, y + 30, 4.4)}<rect class="sim-fr-channel${tripped ? " emphasized" : ""}" x="${px - 10}" y="${y - 22}" width="20" height="44" rx="7"/><line class="sim-detail" x1="${px}" y1="${y - 30}" x2="${px}" y2="${y - 20}"/><line class="sim-detail" x1="${px}" y1="${y + 20}" x2="${px}" y2="${y + 30}"/><path class="sim-fr-heater${tripped ? " emphasized" : ""}" d="M ${px - 5} ${y - 16} l 10 6 l -10 6 l 10 6 l -10 6 l 10 6"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-fr${tripped ? " is-tripped" : ""}" data-component-kind="thermal-relay">${poles}${label(x - poleSpacing - 20, y + 5, labelText, "end")}</g>`;
  }

  function motor({ x, y, labelText = "M", running = false, direction = "forward", subtitle = "三相异步电动机" }) {
    const directionClass = running ? (direction === "reverse" ? " reverse" : " forward") : "";
    return `<g class="ectp-sim-piece ectp-motor${stateClass(running)}" data-component-kind="motor"><rect class="sim-motor-box" x="${x - 25}" y="${y - 55}" width="50" height="17" rx="5"/><circle class="sim-motor-shell" cx="${x}" cy="${y}" r="43"/><circle class="sim-motor-endcap" cx="${x - 31}" cy="${y}" r="12"/><circle class="sim-motor-endcap" cx="${x + 31}" cy="${y}" r="12"/>${[-22, -11, 0, 11, 22].map((offset) => `<line class="sim-motor-fin" x1="${x + offset}" y1="${y - 33}" x2="${x + offset}" y2="${y + 33}"/>`).join("")}<rect class="sim-motor-shaft" x="${x + 38}" y="${y - 5}" width="17" height="10" rx="4"/><rect class="sim-motor-base" x="${x - 45}" y="${y + 39}" width="90" height="11" rx="5"/><g class="motor-rotor-assembly${directionClass}${stateClass(running)}" style="transform-origin:${x}px ${y}px"><circle class="sim-motor-rotor-hub" cx="${x}" cy="${y}" r="11"/><line class="sim-motor-rotor-spoke" x1="${x - 18}" y1="${y}" x2="${x + 18}" y2="${y}"/><line class="sim-motor-rotor-spoke" x1="${x}" y1="${y - 18}" x2="${x}" y2="${y + 18}"/></g><text class="sim-motor-name" x="${x}" y="${y + 6}" text-anchor="middle">${escapeText(labelText)}</text>${label(x, y + 62, subtitle, "middle", "sim-small-label")}</g>`;
  }

  function selectorSwitch({ x, y, labelText = "SA", mode = "jog" }) {
    const continuous = mode === "continuous";
    const left = x - 34;
    const right = x + 34;
    return `<g class="ectp-sim-piece ectp-selector${continuous ? " is-continuous" : " is-jog"}" data-component-kind="selector-switch"><rect class="sim-selector-contactblock" x="${left - 4}" y="${y - 11}" width="76" height="22" rx="8"/>${terminal(left, y, 4.4)}${terminal(right, y, 4.4)}<line class="sim-detail" x1="${left}" y1="${y}" x2="${left + 14}" y2="${y}"/><line class="sim-detail" x1="${right - 14}" y1="${y}" x2="${right}" y2="${y}"/><line class="sim-contact-bridge-live" x1="${left + 14}" y1="${y}" x2="${right - 14}" y2="${y}"/><rect class="sim-button-backplate" x="${x - 24}" y="${y - 53}" width="48" height="18" rx="9"/><circle class="sim-selector-ring" cx="${x}" cy="${y - 37}" r="20"/><line class="sim-selector-handle" x1="${x}" y1="${y - 37}" x2="${x + (continuous ? 13 : -13)}" y2="${y - 49}"/><text class="sim-selector-state" x="${x}" y="${y + 26}" text-anchor="middle">${continuous ? "长动" : "点动"}</text>${label(x, y - 65, labelText)}<text class="sim-prototype-badge" x="${x + 29}" y="${y - 55}">PROTOTYPE</text></g>`;
  }

  platform.electricalPrimitives = Object.freeze({
    terminal,
    label,
    qf,
    fuse,
    contactBank,
    inlineContact,
    pushButton,
    coil,
    thermalRelay,
    motor,
    selectorSwitch
  });
})(globalThis);
