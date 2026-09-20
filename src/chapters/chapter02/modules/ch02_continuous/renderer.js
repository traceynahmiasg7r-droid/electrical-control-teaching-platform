(function installContinuousRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const path = (points) => points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ");
  const line = (a, b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  function openPowerContact(a, b) {
    const upper = { x: a.x, y: a.y + Math.min(30, (b.y - a.y) * 0.42) };
    const lower = { x: b.x, y: b.y - Math.min(18, (b.y - a.y) * 0.25) };
    return `${line(a, upper)} ${line({ x: a.x - 16, y: upper.y }, { x: b.x, y: lower.y })} ${line(lower, b)}`;
  }
  function controlContact(a, b, normallyClosed, closed) {
    if (closed) return line(a, b);
    const mid = (a.x + b.x) / 2;
    return normallyClosed
      ? `${line(a, { x: mid, y: a.y - 18 })} ${line({ x: mid + 10, y: a.y + 18 }, b)}`
      : `${line(a, { x: mid - 10, y: a.y - 18 })} ${line({ x: mid + 15, y: a.y + 18 }, b)}`;
  }
  function normallyOpenContact(a, b, closed) {
    if (closed) return line(a, b);
    return line(a, { x: (a.x + b.x) / 2 + 2, y: a.y - 29 });
  }
  function normallyClosedContact(a, b, closed) {
    const lower = { x: b.x, y: b.y + 27 };
    const fixed = line(b, lower);
    if (closed) return `${line(a, lower)} ${fixed}`;
    const bladeEnd = { x: b.x - 14, y: lower.y };
    return `${line(a, bladeEnd)} ${fixed}`;
  }
  const hits = { qf1: [135, 205, 230, 90], sb1: [620, 205, 145, 95], sb2: [845, 205, 145, 100], fr1_nc: [1210, 245, 150, 110] };
  function renderComponent(component, ports, visual, active) {
    const p = component.portIds.map((id) => ports.get(id));
    const state = visual.components?.[component.componentId] || { closed: [], pressed: false, energized: false };
    const edgeActive = (component.electricalEdgeIds || []).map((id) => active.edges.has(id));
    const conductor = (index, d) => `<path class="continuous-conductor${edgeActive[index] ? " is-conductive" : ""}" data-conductive-geometry="true" data-edge-id="${esc(component.electricalEdgeIds[index] || "")}" d="${d}"/>`;
    let body = "";
    switch (component.type) {
      case "source_bank": body = p.map((q) => `<circle class="continuous-source-terminal" cx="${q.x}" cy="${q.y}" r="16"/><path class="continuous-source-slash" d="M ${q.x - 11} ${q.y + 11} L ${q.x + 11} ${q.y - 11}"/>`).join(""); break;
      case "breaker_bank": body = `<path class="continuous-mechanical" d="M 160 247 H 318"/>` + p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; return conductor(i, state.closed[i] ? line(top, bottom) : openPowerContact(top, bottom)); }).join(""); break;
      case "fuse_bank": body = p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; return conductor(i, line(top, bottom)) + `<rect class="continuous-fuse" x="${top.x - 11}" y="${top.y}" width="22" height="${bottom.y - top.y}"/>`; }).join(""); break;
      case "main_contact_bank": body = p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; return conductor(i, state.closed[i] ? line(top, bottom) : openPowerContact(top, bottom)); }).join(""); break;
      case "thermal_relay_main": { const g = component.geometry; body = `<rect class="continuous-thermal" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/>` + p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; const thermal = i === 1 ? `M ${top.x} ${top.y} L ${top.x - 11} ${top.y + 7} V ${top.y + 20} H ${top.x + 11} L ${bottom.x} ${bottom.y}` : line(top, bottom); return conductor(i, thermal); }).join(""); break; }
      case "motor": { const g = component.geometry; body = `<ellipse class="continuous-motor" cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}"/><circle class="continuous-motor-shell" cx="${g.cx}" cy="${g.cy}" r="${g.ry}" aria-hidden="true"/><text class="continuous-motor-mark" x="${g.cx}" y="${g.cy + 8}">M</text>`; break; }
      case "fuse_control_vertical": body = `<rect class="continuous-fuse-control-vertical" x="497" y="194" width="28" height="57"/>`; break;
      case "fuse_control_return": body = `<rect class="continuous-fuse-control-return" x="1353" y="187" width="26" height="54"/>`; break;
      case "push_button_no": { const a = p[0], b = p[1]; body = conductor(0, normallyOpenContact(a, b, Boolean(state.closed[0]))) + `<path class="continuous-button-cap" d="M ${component.geometry.capX - 29} ${component.geometry.capY} H ${component.geometry.capX + 29}"/><path class="continuous-button-rod" d="M ${component.geometry.capX} ${component.geometry.capY + 18} V ${a.y - 5}"/>`; break; }
      case "push_button_nc": { const a = p[0], b = p[1]; body = conductor(0, normallyClosedContact(a, b, Boolean(state.closed[0]))) + `<path class="continuous-button-cap" d="M ${component.geometry.capX - 29} ${component.geometry.capY} H ${component.geometry.capX + 29}"/><path class="continuous-button-rod" d="M ${component.geometry.capX} ${component.geometry.capY + 18} V ${a.y - 5}"/>`; break; }
      case "aux_contact_no": { const a = p[0], b = p[1]; body = conductor(0, normallyOpenContact(a, b, Boolean(state.closed[0]))); break; }
      case "coil": { const g = component.geometry; body = `<rect class="continuous-coil" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/>` + conductor(0, line(p[0], p[1])); break; }
      case "thermal_relay_nc": { const a = p[0], b = p[1]; body = conductor(0, normallyClosedContact(a, b, Boolean(state.closed[0]))) + `<path class="continuous-thermal-link" d="M 1274 305 V 329"/><path class="continuous-thermal-arm" d="M 1254 349 H 1294"/>`; break; }
      default: break;
    }
    const cls = `ch02-continuous-component${state.energized ? " is-energized" : ""}${state.pressed ? " is-pressed" : ""}${edgeActive.some(Boolean) ? " is-active-edge" : ""}`;
    const interactive = ["qf1", "sb1", "sb2", "fr1_nc"].includes(component.componentId), hit = hits[component.componentId];
    return `<g class="${cls}" data-component-id="${esc(component.componentId)}" data-component-type="${esc(component.type)}" data-closed="${esc(state.closed.join(" "))}" data-energized="${Boolean(state.energized)}" data-pressed="${Boolean(state.pressed)}"${interactive ? " data-interactive=\"true\" tabindex=\"0\" role=\"button\"" : ""}>${hit ? `<rect class="continuous-hitbox" x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}"/>` : ""}${body}</g>`;
  }
  platform.moduleRenderers = platform.moduleRenderers || {};
  platform.moduleRenderers.createCh02ContinuousRenderer = (data) => {
    const report = data.validateGeometry(); if (!report.valid) throw new Error(report.errors.join("; "));
    const ports = new Map(data.ports.map((item) => [item.portId, item]));
    let rootNode = null, controller = null, actionHandler = null;
    function attach(root) { if (rootNode === root) return; controller?.abort(); controller = new AbortController(); rootNode = root; const opts = { signal: controller.signal };
      const activate = (target) => { const id = target.dataset.componentId; actionHandler?.(id, "pulse"); };
      root.addEventListener("pointerdown", (event) => { const target = event.target.closest("[data-interactive='true']"); if (!target) return; event.preventDefault(); target.focus?.(); activate(target); }, opts);
      root.addEventListener("keydown", (event) => { const target = event.target.closest("[data-interactive='true']"); if (!target || !["Enter", " "].includes(event.key) || event.repeat) return; event.preventDefault(); activate(target); }, opts);
    }
    return Object.freeze({ render({ root, visualState, onAction, teachingFocus = [], source = "Live" }) { if (!root) return; actionHandler = onAction; attach(root); const visual = visualState || {}, activeWires = new Set(visual.visualActiveWireIds || []), activeEdges = new Set([...(visual.activeMainEdgeIds || []), ...(visual.activeControlEdgeIds || [])]);
      const defs = data.wires.map((item) => `<path id="ch02-continuous-geometry-${esc(item.wireId)}" d="${path(item.points)}"/>`).join("") + data.wires.filter((item) => /^motor_/.test(item.toPort)).map((item) => `<path id="ch02-continuous-motor-${esc(item.toPort.replace(/^motor_/, ""))}" d="${path(item.points)}"/>`).join("");
      const base = data.wires.map((item) => `<use class="ch02-continuous-wire" href="#ch02-continuous-geometry-${esc(item.wireId)}" data-wire-id="${esc(item.wireId)}"/>`).join("");
      const active = data.wires.filter((item) => activeWires.has(item.wireId)).map((item) => `<use class="ch02-continuous-wire-active" href="#ch02-continuous-geometry-${esc(item.wireId)}" data-wire-id="${esc(item.wireId)}"/>`).join("");
      const flow = data.wires.filter((item) => activeWires.has(item.wireId)).map((item) => `<use class="ch02-continuous-flow" href="#ch02-continuous-geometry-${esc(item.wireId)}" data-flow-wire-id="${esc(item.wireId)}"/>`).join("");
      const components = data.components.map((component) => renderComponent(component, ports, visual, { edges: activeEdges })).join("");
      const labels = data.labels.map((label) => `${label.frame ? `<rect class="continuous-label-frame" x="${label.frame.x}" y="${label.frame.y}" width="${label.frame.width}" height="${label.frame.height}"/>` : ""}<text class="continuous-label-${esc(label.kind)}" x="${label.x}" y="${label.y}" text-anchor="middle" font-size="${label.fontSize}">${esc(label.text)}</text>`).join("");
      root.innerHTML = `<section class="ch02-continuous-module" data-module="ch02_continuous"><svg class="ch02-continuous-board" viewBox="${data.viewBox.x} ${data.viewBox.y} ${data.viewBox.width} ${data.viewBox.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="长动控制教材原理图"><title>红色线路表示实际导通路径，元件高亮表示动作状态</title><defs>${defs}</defs><rect class="continuous-background" x="${data.viewBox.x}" y="${data.viewBox.y}" width="${data.viewBox.width}" height="${data.viewBox.height}"/> <g class="continuous-wire-layer">${base}${active}</g><g class="continuous-component-layer">${components}</g><g class="continuous-flow-layer" aria-hidden="true">${flow}</g><g class="continuous-junction-layer">${data.junctions.map((junction) => `<circle class="continuous-junction" cx="${junction.x}" cy="${junction.y}" r="0" data-junction-id="${esc(junction.junctionId)}"/>`).join("")}</g><g class="continuous-label-layer">${labels}</g></svg></section>`;
      const svgNode = root.querySelector("svg"); svgNode.setAttribute("aria-label", "长动控制教材原图"); svgNode.querySelector("title").textContent = "红色线路表示实际导通路径，元件几何表示当前动作状态"; root.querySelectorAll(".continuous-junction").forEach((node) => node.classList.add("ch02-continuous-junction")); root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId))); svgNode.dataset.stateSource = source;
    }, releaseButtons: () => undefined, unmount({ root }) { controller?.abort(); controller = null; rootNode = null; if (root) root.replaceChildren(); } });
  };
})(globalThis);
