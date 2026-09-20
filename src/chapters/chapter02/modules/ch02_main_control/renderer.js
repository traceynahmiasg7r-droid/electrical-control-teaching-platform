(function installMainControlRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const pathData = (points) => points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ");
  const line = (a, b) => `<path d="M ${a.x} ${a.y} L ${b.x} ${b.y}"/>`;
  const rect = (x, y, width, height, cls = "") => `<rect class="${cls}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
  const point = (x, y) => ({ x, y });
  const interactiveIds = new Set(["qf1", "sb1", "sb2", "sb3", "sb4", "fr1_main", "fr1_nc", "fr2_main", "fr2_nc"]);
  const hitboxes = {
    qf1: [105, 132, 235, 130], sb1: [825, 435, 110, 70], sb2: [1005, 435, 125, 70],
    sb3: [825, 660, 110, 70], sb4: [1005, 660, 125, 70], fr1_main: [130, 710, 210, 90], fr2_main: [435, 710, 210, 90],
    fr1_nc: [1145, 430, 110, 85], fr2_nc: [1145, 655, 110, 85]
  };

  function activeState(visual) {
    return {
      wires: new Set(visual.visualActiveWireIds || []),
      mainEdges: new Set(visual.activeMainEdgeIds || []),
      controlEdges: new Set(visual.activeControlEdgeIds || [])
    };
  }
  function componentState(visual, component) {
    return visual.components[component.componentId] || { closed: [], pressed: false, energized: false, edgeIds: [] };
  }
  function flowUse(id, attrs = "") {
    return `<use class="ch02-main-control-flow" href="#${esc(id)}" ${attrs}/>`;
  }
  function conductive(markup, component, index, visual, active, flows) {
    const state = componentState(visual, component);
    const edgeId = component.electricalEdgeIds[index];
    const enabled = Boolean(state.closed[index]) && (active.mainEdges.has(edgeId) || active.controlEdges.has(edgeId));
    let part = 0;
    const replaced = markup.replace(/<path /g, () => {
      const id = `ch02-main-control-conductor-${component.componentId}-${index}-${part++}`;
      if (enabled) flows.push(flowUse(id, `data-flow-component="${esc(component.componentId)}" data-edge-id="${esc(edgeId || "")}"`));
      return `<path id="${id}" data-conductive-geometry="true" data-edge-id="${esc(edgeId || "")}" `;
    });
    return replaced;
  }
  function controlContact(a, b, normallyClosed, closed) {
    if (normallyClosed && closed) return line(a, point(b.x + 9, b.y + 24)) + line(b, point(b.x, b.y + 28));
    if (!normallyClosed && !closed) return line(a, point(b.x + 4, b.y - 22));
    if (closed) return line(a, b);
    if (normallyClosed) return line(a, point((a.x + b.x) / 2, a.y - 18)) + line(point((a.x + b.x) / 2 + 10, a.y + 18), b);
    return line(a, point((a.x + b.x) / 2 - 10, a.y - 18)) + line(point((a.x + b.x) / 2 + 15, a.y + 18), b);
  }
  function openPowerContact(a, b) {
    const upper = point(a.x, a.y + Math.min(30, (b.y - a.y) * 0.42));
    const lower = point(b.x, b.y - Math.min(18, (b.y - a.y) * 0.25));
    return line(a, upper) + line(upper, point(b.x + 16, lower.y)) + line(lower, b);
  }
  function renderComponent(component, ports, visual, active, flows) {
    const state = componentState(visual, component);
    const p = component.portIds.map((id) => ports.get(id));
    if (p.some((item) => !item)) throw new Error("Main-control component has missing port: " + component.componentId + " [" + component.portIds.join(",") + "]");
    let body = "";
    switch (component.type) {
      case "source_bank":
        body = p.map((a) => `<ellipse class="source-terminal" cx="${a.x}" cy="${a.y}" rx="18" ry="18"/>` + line(point(a.x - 21, a.y + 15), point(a.x + 21, a.y - 15))).join("");
        break;
      case "breaker_bank":
        body = `<path class="mechanical-link" d="M ${p[0].x} ${p[0].y + 42} H ${p[2].x}"/>` + p.slice(0, 3).map((a, i) => {
          const b = p[i + 3];
          const contact = state.closed[i] ? line(a, b) : openPowerContact(a, b);
          return line(point(a.x, a.y - 3), a) + conductive(contact, component, i, visual, active, flows) + `<path d="M ${a.x - 16} ${a.y + 15} L ${a.x + 10} ${a.y + 8}"/>`;
        }).join("");
        break;
      case "fuse_bank":
        body = p.slice(0, 3).map((a, i) => {
          const b = p[i + 3];
          return conductive(line(a, b), component, i, visual, active, flows) + rect(a.x - 10, a.y + 3, 20, b.y - a.y - 6, "fuse-body");
        }).join("");
        break;
      case "main_contact_bank":
        body = p.slice(0, 3).map((a, i) => {
          const b = p[i + 3];
          const contact = state.closed[i] ? line(a, b) : openPowerContact(a, b);
          return line(point(a.x, a.y - 3), a) + conductive(contact, component, i, visual, active, flows);
        }).join("");
        break;
      case "thermal_relay_main":
        body = rect(component.geometry.x, component.geometry.y, component.geometry.width, component.geometry.height, "thermal-body")
          + p.slice(0, 3).map((a, i) => conductive(i === 1
            ? `<path d="${pathData([a, point(a.x, a.y + 5), point(a.x - 16, a.y + 5), point(a.x - 16, a.y + 19), point(a.x, a.y + 19), p[i + 3]])}"/>`
            : line(a, p[i + 3]), component, i, visual, active, flows)).join("");
        break;
      case "motor": {
        const g = component.geometry;
        body = `<ellipse class="motor-shell" cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}"/>`
          + "";
        break;
      }
      case "coil": {
        const a = p[0], b = p[1], g = component.geometry;
        body = rect(a.x, a.y - g.height / 2, b.x - a.x, g.height, "coil-body") + `<path class="coil-wave" d="M ${a.x + 8} ${a.y} q 8 -18 16 0 t 16 0 t 16 0 t 16 0"/>`;
        break;
      }
      case "push_button_nc":
      case "push_button_no":
      case "contact_no":
      case "thermal_relay_nc": {
        const [a, b] = p;
        const normallyClosed = component.type === "push_button_nc" || component.type === "thermal_relay_nc";
        body = conductive(controlContact(a, b, normallyClosed, Boolean(state.closed[0])), component, 0, visual, active, flows);
        if (component.type.startsWith("push_button")) {
          const top = a.y - 50, center = (a.x + b.x) / 2;
          body += `<path class="button-cap" d="M ${center - 23} ${top + 13} V ${top} H ${center + 23} V ${top + 13}"/>`
            + `<path class="button-actuator" d="M ${center} ${top + 13} V ${a.y - 5}"/>`;
        }
        if (component.type === "thermal_relay_nc") {
          const center = (a.x + b.x) / 2;
          body += line(point(center, a.y + 13), point(center, a.y + 29))
            + `<path class="thermal-link" d="M ${center} ${a.y + 37} L ${center} ${a.y + 43}"/>`
            + `<path d="M ${center - 30} ${a.y + 59} H ${center - 16} V ${a.y + 45} H ${center + 16} V ${a.y + 59} H ${center + 30}"/>`;
        }
        break;
      }
      default: throw new Error("Unknown main-control component " + component.type);
    }
    const activeEdge = (component.electricalEdgeIds || []).some((id) => active.mainEdges.has(id) || active.controlEdges.has(id));
    const className = `ch02-main-control-component${state.energized ? " is-energized" : ""}${state.pressed ? " is-pressed" : ""}${activeEdge ? " is-active-edge" : ""}${component.componentId.startsWith("motor") ? " motor-" + (state.energized ? "running" : "stopped") : ""}`;
    const attrs = interactiveIds.has(component.componentId) ? ` data-interactive="true" tabindex="0" role="button" aria-label="操作 ${esc(component.componentId)}"` : "";
    const h = hitboxes[component.componentId];
    const hitbox = h ? `<rect class="ch02-main-control-hitbox" x="${h[0]}" y="${h[1]}" width="${h[2]}" height="${h[3]}"/>` : "";
    const activeIds = (component.electricalEdgeIds || []).filter((id) => active.mainEdges.has(id) || active.controlEdges.has(id));
    return `<g class="${className}" data-component-id="${esc(component.componentId)}" data-closed="${state.closed.join(" ")}" data-energized="${Boolean(state.energized)}" data-active-edge-ids="${esc(activeIds.join(" "))}"${attrs}>${hitbox}${body}</g>`;
  }

  platform.moduleRenderers = platform.moduleRenderers || {};
  platform.moduleRenderers.createCh02MainControlRenderer = (data) => {
    const report = data.validateGeometry();
    if (!report.valid) throw new Error(report.errors.join("; "));
    const ports = new Map(data.ports.map((item) => [item.portId, item]));
    let rootNode = null, controller = null, actionHandler = null;
    const held = new Set();
    const release = () => { [...held].forEach((id) => actionHandler?.(id, "release")); held.clear(); };
    function attach(root) {
      if (rootNode === root) return;
      controller?.abort(); controller = new AbortController(); rootNode = root;
      const opts = { signal: controller.signal };
      root.addEventListener("pointerdown", (event) => {
        const target = event.target.closest("[data-interactive='true']");
        if (!target || !root.contains(target)) return;
        event.preventDefault(); const id = target.dataset.componentId;
        if (["sb1", "sb2", "sb3", "sb4"].includes(id)) { held.add(id); actionHandler?.(id, "press"); }
        else actionHandler?.(id, "toggle");
      }, opts);
      root.addEventListener("keydown", (event) => {
        const target = event.target.closest("[data-interactive='true']");
        if (!target || !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); actionHandler?.(target.dataset.componentId, "pulse");
      }, opts);
      global.addEventListener("pointerup", release, opts); global.addEventListener("blur", release, opts);
    }
    return Object.freeze({
      render({ root, visualState, onAction, teachingFocus = [], source = "Live" }) {
        if (!root) return;
        actionHandler = onAction; attach(root);
        const active = activeState(visualState), flows = [];
        const wires = data.wires.map((wire) => `<path class="ch02-main-control-wire" id="ch02-main-control-wire-${esc(wire.wireId)}" data-wire-id="${esc(wire.wireId)}" d="${pathData(wire.points)}"/>`).join("");
        const activeWires = data.wires.filter((wire) => active.wires.has(wire.wireId)).map((wire) => `<use class="ch02-main-control-wire-active" data-wire-id="${esc(wire.wireId)}" href="#ch02-main-control-wire-${esc(wire.wireId)}"/>`).join("");
        const flowWires = data.wires.filter((wire) => active.wires.has(wire.wireId)).map((wire) => flowUse(`ch02-main-control-wire-${wire.wireId}`, `data-flow-wire-id="${esc(wire.wireId)}"`)).join("");
        const componentLayer = data.components.map((component) => renderComponent(component, ports, visualState, active, flows)).join("");
        root.innerHTML = `<section class="ch02-main-control-static-module" data-module="ch02_main_control"><svg class="ch02-main-control-board" viewBox="0 0 ${data.viewBox.width} ${data.viewBox.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="主电路与控制电路教材原理图"><title>红色线路表示当前闭合导电路径；元件高亮表示正在起作用，不代表额外导线。</title><rect class="ch02-main-control-background" width="${data.viewBox.width}" height="${data.viewBox.height}"/><g class="ch02-main-control-wire-layer">${wires}${activeWires}</g><g class="ch02-main-control-component-layer">${componentLayer}</g><g class="ch02-main-control-flow-layer" aria-hidden="true">${flowWires}${flows.join("")}</g><g class="ch02-main-control-junction-layer">${data.junctions.map((junction) => `<circle class="ch02-main-control-junction" data-junction-id="${esc(junction.junctionId)}" cx="${junction.x}" cy="${junction.y}" r="3"/>`).join("")}</g><g class="ch02-main-control-label-layer">${data.labels.map((label) => `<text class="${esc(label.kind)}" x="${label.x}" y="${label.y}" text-anchor="${esc(label.anchor)}"${Number.isFinite(label.fontSize) ? ` font-size="${label.fontSize}"` : ""}>${esc(label.text)}</text>`).join("")}</g></svg></section>`;
        const board = root.querySelector(".ch02-main-control-board"); board.dataset.stateSource = source;
        root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId)));
      },
      releaseButtons: release,
      unmount({ root }) { release(); controller?.abort(); controller = null; if (root) root.replaceChildren(); rootNode = null; }
    });
  };
})(globalThis);
