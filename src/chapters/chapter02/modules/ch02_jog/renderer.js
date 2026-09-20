(function installJogRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const d = (points) => points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ");
  const line = (a, b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const hitboxes = { qf: [175, 360, 240, 120], sb: [630, 525, 150, 110], fr_nc: [1090, 390, 145, 130] };
  function renderJogComponent(component, ports, visual, active) {
    const p = component.portIds.map((id) => ports.get(id));
    const state = visual.components?.[component.componentId] || { closed: [], pressed: false, energized: false };
    const edgeActive = (component.electricalEdgeIds || []).map((id) => active.edges.has(id));
    const stroke = (edge, path, extra = "") => `<path class="jog-conductor${edge ? " is-conductive" : ""}" data-conductive-geometry="true" data-edge-id="${esc(component.electricalEdgeIds[edge] || "")}" d="${path}"${extra}/>`;
    let body = "";
    switch (component.type) {
      case "source_bank": body = p.map((point) => `<circle class="source-terminal" cx="${point.x}" cy="${point.y}" r="17"/>`).join(""); break;
      case "breaker_bank": {
        body = [0, 1, 2].map((i) => {
          const top = p[i], bottom = p[i + 3];
          const blade = state.closed[i] ? line(top, bottom) : `M ${top.x - 27} ${top.y} L ${bottom.x} ${bottom.y}`;
          return stroke(edgeActive[i], blade) + `<path class="jog-fixed-terminal" d="M ${top.x} ${top.y - 1} V ${top.y + 17}"/><path class="jog-fixed-terminal" d="M ${bottom.x} ${bottom.y - 17} V ${bottom.x ? bottom.y + 1 : bottom.y + 1}"/>`;
        }).join("");
        body += `<path class="jog-mechanical-link" d="M 201 421 H 279 M 323 421 H 401"/>`;
        break;
      }
      case "fuse_bank": body = p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; return stroke(edgeActive[i], line(top, bottom)) + `<rect class="jog-fuse" x="${top.x - 12}" y="${top.y + 7}" width="24" height="${bottom.y - top.y - 14}"/>`; }).join(""); break;
      case "fuse_control_bank": body = [[p[0], p[1]], [p[2], p[3]]].map(([a, b], i) => stroke(edgeActive[i], line(a, b)) + `<rect class="jog-fuse-control" x="${a.x}" y="${a.y - 10}" width="${b.x - a.x}" height="20"/>`).join(""); break;
      case "main_contact_bank": {
        body = p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; const blade = state.closed[i] ? line(top, bottom) : `M ${top.x} ${top.y} L ${top.x - 24} ${bottom.y}`; return stroke(edgeActive[i], blade) + `<path class="jog-fixed-terminal" d="M ${top.x} ${top.y} h 16"/><path class="jog-fixed-terminal" d="M ${bottom.x - 16} ${bottom.y} h 16"/>`; }).join("");
        body += `<path class="jog-mechanical-link" d="M 225 754 H 377"/>`; break;
      }
      case "thermal_relay_main": { const g = component.geometry; body = `<rect class="jog-thermal-body" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/>`; body += p.slice(0, 3).map((top, i) => { const bottom = p[i + 3]; const thermal = `M ${top.x} ${top.y} L ${top.x - 11} ${top.y + 10} V ${top.y + 25} H ${top.x + 11} L ${bottom.x} ${bottom.y}`; return stroke(edgeActive[i], thermal); }).join(""); break; }
      case "motor": { const g = component.geometry; body = `<circle class="jog-motor-shell" cx="${g.cx}" cy="${g.cy}" r="${g.r}"/><text class="jog-motor-mark" x="${g.cx}" y="${g.cy - 5}">M</text><text class="jog-motor-phase" x="${g.cx}" y="${g.cy + 35}">3~</text>`; break; }
      case "push_button_no": { const a = p[0], b = p[1], mid = (a.x + b.x) / 2; const contact = state.closed[0] ? line(a, b) : `M ${a.x} ${a.y} L ${mid - 8} ${a.y - 28} M ${mid + 8} ${a.y} L ${b.x} ${b.y}`; body = stroke(edgeActive[0], contact) + `<path class="jog-button-cap" d="M ${mid - 24} 550 H ${mid + 24}"/><path class="jog-button-actuator" d="M ${mid} 550 V 596"/>`; break; }
      case "coil": { const g = component.geometry; body = `<rect class="jog-coil-body" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/>` + stroke(edgeActive[0], line(p[0], p[1])); break; }
      case "thermal_relay_nc": { const a = p[0], b = p[1], mid = (a.x + b.x) / 2; const contact = state.closed[0] ? line(a, b) : `M ${a.x} ${a.y} L ${mid - 10} ${a.y - 18} M ${mid + 10} ${a.y + 18} L ${b.x} ${b.y}`; body = stroke(edgeActive[0], contact) + `<path class="jog-thermal-link" d="M ${mid} ${a.y + 17} V ${a.y + 64}"/><path class="jog-thermal-arm" d="M ${mid - 28} ${a.y + 64} H ${mid + 28}"/>`; break; }
      default: break;
    }
    const cls = `ch02-jog-component${state.energized ? " is-energized" : ""}${state.pressed ? " is-pressed" : ""}${edgeActive.some(Boolean) ? " is-active-edge" : ""}`;
    const interactive = ["qf", "sb", "fr_nc"].includes(component.componentId);
    const hit = hitboxes[component.componentId];
    return `<g class="${cls}" data-component-id="${esc(component.componentId)}"${interactive ? " data-interactive=\"true\" tabindex=\"0\" role=\"button\"" : ""}>${hit ? `<rect class="ch02-jog-hitbox" x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}"/>` : ""}${body}</g>`;
  }
  platform.moduleRenderers = platform.moduleRenderers || {};
  platform.moduleRenderers.createCh02JogRenderer = (data) => {
    const report = data.validateGeometry(); if (!report.valid) throw new Error(report.errors.join("; "));
    const ports = new Map(data.ports.map((item) => [item.portId, item]));
    let rootNode = null, controller = null, actionHandler = null; const held = new Set();
    const release = () => { if (!held.size) return; held.clear(); actionHandler?.("sb", "release"); };
    function attach(root) { if (rootNode === root) return; controller?.abort(); controller = new AbortController(); rootNode = root; const opts = { signal: controller.signal };
      root.addEventListener("pointerdown", (event) => { const target = event.target.closest("[data-interactive='true']"); if (!target) return; event.preventDefault(); target.focus?.(); const id = target.dataset.componentId; if (id === "sb") { held.add(id); actionHandler?.(id, "press"); } else actionHandler?.(id, "toggle"); }, opts);
      root.addEventListener("keydown", (event) => { const target = event.target.closest("[data-interactive='true']"); if (!target || !["Enter", " "].includes(event.key) || event.repeat) return; event.preventDefault(); if (target.dataset.componentId === "sb") { held.add("sb"); actionHandler?.("sb", "press"); } else actionHandler?.(target.dataset.componentId, "toggle"); }, opts);
      root.addEventListener("keyup", (event) => { if (["Enter", " "].includes(event.key) && held.has("sb")) release(); }, opts);
      // A press re-renders the SVG, replacing the focused node.  Listen at
      // window level as well so the physical key-up still releases SB.
      global.addEventListener("keyup", (event) => { if (["Enter", " "].includes(event.key) && held.has("sb")) release(); }, opts);
      global.addEventListener("pointerup", release, opts); global.addEventListener("pointercancel", release, opts); global.addEventListener("blur", release, opts);
    }
    return Object.freeze({ render({ root, visualState, onAction, teachingFocus = [], source = "Live" }) { if (!root) return; actionHandler = onAction; attach(root); const visual = visualState || {}; const activeWireIds = new Set(visual.visualActiveWireIds || []); const activeEdges = new Set([...(visual.activeMainEdgeIds || []), ...(visual.activeControlEdgeIds || [])]);
      const defs = data.wires.map((item) => `<path id="ch02-jog-geometry-${esc(item.wireId)}" d="${d(item.points)}"/>`).join("");
      const base = data.wires.map((item) => `<use class="ch02-jog-wire" href="#ch02-jog-geometry-${esc(item.wireId)}" data-wire-id="${esc(item.wireId)}"/>`).join("");
      const active = data.wires.filter((item) => activeWireIds.has(item.wireId)).map((item) => `<use class="ch02-jog-wire-active" href="#ch02-jog-geometry-${esc(item.wireId)}" data-wire-id="${esc(item.wireId)}"/>`).join("");
      const flow = data.wires.filter((item) => activeWireIds.has(item.wireId)).map((item) => `<use class="ch02-jog-flow" href="#ch02-jog-geometry-${esc(item.wireId)}" data-flow-wire-id="${esc(item.wireId)}"/>`).join("");
      const components = data.components.map((component) => renderJogComponent(component, ports, visual, { edges: activeEdges })).join("");
      const junctions = data.junctions.map((item) => `<circle class="ch02-jog-junction" cx="${item.x}" cy="${item.y}" r="6" data-junction-id="${esc(item.junctionId)}"/>`).join("");
      // Crossings are metadata only: a crossing without a junction must not
      // paint a white or black dot over either real wire.
      const crossings = "";
      const labels = data.labels.map((label) => `${label.frame ? `<rect class="jog-label-frame" x="${label.frame.x}" y="${label.frame.y}" width="${label.frame.width}" height="${label.frame.height}"/>` : ""}<text class="jog-label-${esc(label.kind)}" x="${label.x}" y="${label.y}" text-anchor="middle" font-size="${label.fontSize}">${esc(label.text)}</text>`).join("");
      root.innerHTML = `<section class="ch02-jog-module" data-module="ch02_jog"><svg class="ch02-jog-board" viewBox="${data.viewBox.x} ${data.viewBox.y} ${data.viewBox.width} ${data.viewBox.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="点动控制教材原理图"><title>红色线路为实际导通路径，元件高亮表示动作状态</title><defs>${defs}</defs><rect class="ch02-jog-background" x="${data.viewBox.x}" y="${data.viewBox.y}" width="${data.viewBox.width}" height="${data.viewBox.height}"/><g class="ch02-jog-wire-layer">${base}${active}</g><g class="ch02-jog-component-layer">${components}</g><g class="ch02-jog-flow-layer" aria-hidden="true">${flow}</g><g class="ch02-jog-junction-layer">${junctions}${crossings}</g><g class="ch02-jog-label-layer">${labels}</g></svg></section>`;
      root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId))); root.querySelector("svg").dataset.stateSource = source;
    }, releaseButtons: release, unmount({ root }) { release(); controller?.abort(); controller = null; rootNode = null; if (root) root.replaceChildren(); } });
  };
})(globalThis);
