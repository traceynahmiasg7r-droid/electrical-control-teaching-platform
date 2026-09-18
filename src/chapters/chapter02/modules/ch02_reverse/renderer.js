(function installCh02ReverseRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pathData = (points) => points.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ");
  const p = (x, y) => ({ x, y });
  const line = (a, b) => '<path d="' + pathData([a, b]) + '"/>';
  const rect = (x, y, width, height) => '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '"/>';
  const interactiveIds = new Set(["qf1", "sb1", "sb2", "sb3", "fr1_main", "fr1_nc"]);
  const interactionBoxes = Object.freeze({
    qf1: [188, 45, 170, 105], sb1: [493, 120, 90, 70], sb2: [682, 120, 86, 70],
    sb3: [682, 259, 86, 70], fr1_main: [196, 452, 170, 42], fr1_nc: [1286, 224, 84, 90]
  });

  // In the normal state this reproduces the accepted Stage 1 textbook symbol.
  function contact(a, b, normallyClosed, closed) {
    if (normallyClosed && closed) return line(a, p(b.x + 9, b.y + 24)) + line(b, p(b.x, b.y + 28));
    if (!normallyClosed && !closed) return line(a, p(b.x + 4, b.y - 22));
    return closed ? line(a, b) : line(a, p(b.x + 4, b.y - 22));
  }

  function componentState(component, visualState) {
    return visualState.components[component.componentId] || { closed: [], pressed: false, energized: false };
  }

  function activeState(visualState) {
    return {
      mainWires: new Set(visualState.activeMainWireIds || []),
      controlWires: new Set(visualState.activeControlWireIds || []),
      mainEdges: new Set(visualState.activeMainEdgeIds || []),
      controlEdges: new Set(visualState.activeControlEdgeIds || [])
    };
  }

  function flowUse(id, attributes = "", undirected = false) {
    return '<use class="ch02-reverse-flow' + (undirected ? ' is-undirected' : '') + '" href="#' + esc(id)
      + '" data-flow-semantics="AC-path-illustration-not-instantaneous-direction" ' + attributes + '/>';
  }

  function edgeIsActive(component, active) {
    return component.electricalEdgeIds.some((id) => active.mainEdges.has(id) || active.controlEdges.has(id));
  }

  function renderComponent(component, portMap, visualState, active, edgeFlows) {
    const ports = component.portIds.map((id) => portMap.get(id));
    const state = componentState(component, visualState);
    const closed = state.closed;
    const geometry = component.geometry;
    const interactive = interactiveIds.has(component.componentId);
    // Annotate existing conductive strokes; never re-create their coordinates.
    // Frames, actuators, hitboxes, mechanical links and coil outlines never enter here.
    function conductive(markup, index, equivalentWireId = null, undirected = false) {
      const edgeId = state.edgeIds[index];
      const enabled = equivalentWireId
        ? active.mainWires.has(equivalentWireId) || active.controlWires.has(equivalentWireId)
        : closed[index] && (active.mainEdges.has(edgeId) || active.controlEdges.has(edgeId));
      let part = 0;
      return markup.replace(/<path /g, () => {
        const id = "ch02-reverse-conductor-" + component.componentId + "-" + index + "-" + part++;
        const mapping = equivalentWireId ? 'data-equivalent-wire-id="' + equivalentWireId + '"' : 'data-edge-id="' + edgeId + '"';
        if (enabled) edgeFlows.push(flowUse(id, mapping + ' data-flow-component="' + component.componentId + '"', undirected));
        return '<path id="' + id + '" data-conductive-geometry="true" ' + mapping + ' ';
      });
    }
    let body = "";
    switch (component.type) {
      case "source_bank":
        body = ports.map((a) => '<ellipse class="source-terminal" cx="' + a.x + '" cy="' + a.y + '" rx="15" ry="10"/>' + line(p(a.x - 19, a.y + 13), p(a.x + 19, a.y - 13))).join("");
        break;
      case "breaker_bank":
      case "main_contact_bank":
        body = ports.slice(0, 3).map((a, index) => {
          const b = ports[index + 3];
          const isClosed = Boolean(closed[index]);
          const terminal = component.type === "main_contact_bank" ? '<circle cx="' + (a.x - 3) + '" cy="' + a.y + '" r="3"/>' : "";
          const fixed = line(p(a.x, a.y - 3), a);
          return terminal + fixed + conductive(isClosed ? line(a, b) : line(b, p(a.x - 16, b.y + 2)), index);
        }).join("");
        break;
      case "fuse_bank":
        body = ports.slice(0, 3).map((a, index) => rect(a.x - 8, a.y, 16, ports[index + 3].y - a.y) + conductive(line(a, ports[index + 3]), index)).join("");
        break;
      case "fuse_pair":
        body = [0, 2].map((index) => rect(ports[index].x, ports[index].y - 9, ports[index + 1].x - ports[index].x, 18)
          + conductive(line(ports[index], ports[index + 1]), index, index === 0 ? "cw_01" : "cw_20", true)).join("");
        break;
      case "thermal_relay_main":
        body = rect(geometry.x, geometry.y, geometry.width, geometry.height) + ports.slice(0, 3).map((a, index) => conductive(index === 1
          ? '<path d="' + pathData([a, p(a.x, a.y + 5), p(a.x - 16, a.y + 5), p(a.x - 16, a.y + 19), p(a.x, a.y + 19), ports[index + 3]]) + '"/>'
          : line(a, ports[index + 3]), index)).join("");
        break;
      case "motor": {
        const display = { stopped: "停止", forward: "正转", reverse: "反转", fault: "故障" }[visualState.motor] || "停止";
        body = '<ellipse cx="' + geometry.cx + '" cy="' + geometry.cy + '" rx="' + geometry.rx + '" ry="' + geometry.ry + '"/>'
          + '<text class="motor-state" x="' + (geometry.cx + geometry.rx + 11) + '" y="' + (geometry.cy + 5) + '">' + display + '</text>';
        break;
      }
      case "coil":
        body = rect(ports[0].x, ports[0].y - geometry.height / 2, ports[1].x - ports[0].x, geometry.height);
        break;
      case "contact_no":
      case "contact_nc":
      case "push_button_no":
      case "push_button_nc":
      case "thermal_relay_nc": {
        const [a, b] = ports;
        const normallyClosed = component.type.endsWith("_nc");
        const isClosed = Boolean(closed[0]);
        const center = (a.x + b.x) / 2;
        body = conductive(contact(a, b, normallyClosed, isClosed), 0, null, normallyClosed);
        if (component.type.startsWith("push_button")) {
          const top = a.y - 46;
          const pressOffset = state.pressed ? 5 : 0;
          body += '<path d="' + pathData([p(center - 23, top + 13), p(center - 23, top), p(center + 23, top), p(center + 23, top + 13)]) + '"/>'
            + line(p(center, top + pressOffset), p(center, top + 17 + pressOffset))
            + line(p(center, a.y - 17 + pressOffset), p(center, a.y + (normallyClosed ? 8 : -12) + pressOffset));
        }
        if (component.type === "thermal_relay_nc") {
          body += line(p(center, a.y + 13), p(center, a.y + 29))
            + '<path class="thermal-link" d="' + pathData([p(center, a.y + 37), p(center, a.y + 43)]) + '"/>'
            + '<path d="' + pathData([p(center - 30, a.y + 59), p(center - 16, a.y + 59), p(center - 16, a.y + 45), p(center + 16, a.y + 45), p(center + 16, a.y + 59), p(center + 30, a.y + 59)]) + '"/>';
        }
        break;
      }
      default: throw new Error("Unknown textbook symbol: " + component.type);
    }
    const stateClass = (closed.length ? (closed.every(Boolean) ? " is-closed" : " is-open") : "")
      + (state.pressed ? " is-pressed" : "") + (state.energized ? " is-energized" : "")
      + (edgeIsActive(component, active) ? " is-active-edge" : "")
      + (component.componentId === "motor" ? " motor-" + visualState.motor : "")
      + (["fr1_main", "fr1_nc"].includes(component.componentId) && visualState.protectionTripped ? " is-tripped" : "");
    const interactiveAttrs = interactive
      ? ' data-interactive="true" tabindex="0" role="button" aria-label="操作 ' + esc(component.componentId) + '"'
      : "";
    const hitBox = interactionBoxes[component.componentId];
    const hitboxMarkup = hitBox ? '<rect class="ch02-reverse-hitbox" x="' + hitBox[0] + '" y="' + hitBox[1] + '" width="' + hitBox[2] + '" height="' + hitBox[3] + '"/>' : "";
    const activeEdgeIds = component.electricalEdgeIds.filter((id) => active.mainEdges.has(id) || active.controlEdges.has(id));
    return '<g class="ch02-reverse-component' + stateClass + '" data-component-id="' + component.componentId + '" data-mapping-status="' + component.mappingStatus
      + '" data-closed="' + closed.join(" ") + '" data-energized="' + Boolean(state.energized) + '" data-active-edge-ids="' + esc(activeEdgeIds.join(" ")) + '"' + interactiveAttrs + '>' + hitboxMarkup + body + '</g>';
  }

  platform.moduleRenderers.createCh02ReverseRenderer = (data) => {
    const report = data.validateGeometry();
    if (!report.valid) throw new Error(report.errors.join("; "));
    const portMap = new Map(data.ports.map((port) => [port.portId, port]));
    const view = data.viewBox;
    let mountedRoot = null;
    let actionHandler = null;
    let releaseListener = null;
    let interactionController = null;
    const heldButtons = new Set();

    function releaseButtons() {
      if (!heldButtons.size) return;
      [...heldButtons].forEach((componentId) => actionHandler?.(componentId, "release"));
      heldButtons.clear();
    }

    function attachInteractions(root) {
      if (mountedRoot === root) return;
      interactionController?.abort();
      interactionController = new AbortController();
      const listenerOptions = { signal: interactionController.signal };
      mountedRoot = root;
      root.addEventListener("pointerdown", (event) => {
        const item = event.target.closest("[data-interactive='true']");
        if (!item || !root.contains(item)) return;
        const componentId = item.dataset.componentId;
        event.preventDefault();
        if (["sb1", "sb2", "sb3"].includes(componentId)) {
          heldButtons.add(componentId);
          actionHandler?.(componentId, "press");
        } else {
          actionHandler?.(componentId, "toggle");
        }
      }, listenerOptions);
      root.addEventListener("keydown", (event) => {
        const item = event.target.closest("[data-interactive='true']");
        if (!item || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        const componentId = item.dataset.componentId;
        actionHandler?.(componentId, ["sb1", "sb2", "sb3"].includes(componentId) ? "pulse" : "toggle");
      }, listenerOptions);
      releaseListener = () => releaseButtons();
      global.addEventListener("pointerup", releaseListener, listenerOptions);
      global.addEventListener("blur", releaseListener, listenerOptions);
    }

    return Object.freeze({
      render({ root, visualState, onAction, teachingFocus = [], source = "Live" }) {
        if (!root) return;
        actionHandler = onAction;
        attachInteractions(root);
        const active = activeState(visualState);
        const activeWireIds = new Set(visualState.visualActiveWireIds);
        const activeWires = data.wires.filter((wire) => activeWireIds.has(wire.wireId));
        const edgeFlows = [];
        const componentLayer = data.components.map((component) => renderComponent(component, portMap, visualState, active, edgeFlows)).join("");
        const wireLayer = data.wires.map((wire) => '<path class="ch02-reverse-wire" id="ch02-reverse-wire-' + wire.wireId + '" data-wire-id="' + wire.wireId + '" data-electrical-wire-ids="' + wire.electricalWireIds.join(" ") + '" d="' + pathData(wire.points) + '"/>').join("");
        // Active overlays reference frozen base paths and define no geometry.
        const activeLayer = activeWires.map((wire) => '<use class="ch02-reverse-wire-active" data-wire-id="' + wire.wireId + '" data-electrical-wire-ids="' + wire.electricalWireIds.join(" ") + '" href="#ch02-reverse-wire-' + wire.wireId + '"/>').join("");
        // Both overlays consume the SAME binding membership and base geometry.
        // Visual wires are already oriented source->load / controls->coil->return.
        // No direction data or coordinates are copied from legacy calibration.
        const wireFlows = activeWires.map((wire) => flowUse("ch02-reverse-wire-" + wire.wireId,
          'data-flow-wire-id="' + wire.wireId + '"')).join("");
        root.innerHTML = '<section class="ch02-reverse-static-module" data-module="ch02_reverse" data-render-stage="component-dynamics">'
          + '<svg class="ch02-reverse-board" viewBox="0 0 ' + view.width + ' ' + view.height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="正反转控制教材原理图，元件状态由电气求解器驱动">'
          + '<title>流动短线仅示意闭合交流电路路径，不代表交流瞬时方向；元件整体高亮不属于电流路径。</title>'
          + '<rect class="ch02-reverse-background" width="' + view.width + '" height="' + view.height + '"/>'
          + '<g class="ch02-reverse-wire-layer">' + wireLayer + activeLayer + '</g>'
          + '<g class="ch02-reverse-crossing-layer">' + data.crossings.map((crossing) => '<g data-crossing-id="' + crossing.crossingId + '" data-electrically-connected="false" data-wire-a="' + crossing.wireA + '" data-wire-b="' + crossing.wireB + '"/>').join("") + '</g>'
          + '<g class="ch02-reverse-mechanical-layer">' + data.mechanicalLinks.map((link) => '<path data-link-id="' + link.linkId + '" d="' + pathData(link.points) + '"/>').join("") + '</g>'
          + '<g class="ch02-reverse-component-layer">' + componentLayer + '</g>'
          + '<g class="ch02-reverse-flow-layer" aria-hidden="true">' + wireFlows + edgeFlows.join("") + '</g>'
          + '<g class="ch02-reverse-junction-layer">' + data.junctions.map((junction) => {
            const junctionWires = data.wires.filter((wire) => wire.points.some((point) => point.x === junction.x && point.y === junction.y));
            const isActive = junctionWires.some((wire) => activeWireIds.has(wire.wireId));
            return '<circle class="ch02-reverse-junction' + (isActive ? ' is-active-junction' : '') + '" data-junction-id="' + junction.junctionId + '" data-active="' + isActive + '" cx="' + junction.x + '" cy="' + junction.y + '" r="2.6"/>';
          }).join("") + '</g>'
          + '<g class="ch02-reverse-label-layer">' + data.labels.map((label) => '<text class="' + label.kind + '" x="' + label.x + '" y="' + label.y + '" text-anchor="' + label.anchor + '">' + esc(label.text) + '</text>').join("") + '</g>'
          + '</svg></section>';
        root.querySelector(".ch02-reverse-board").dataset.stateSource = source;
        // Lightweight non-conductive focus halo; no extra paths or electrical mapping.
        root.querySelectorAll("[data-component-id]").forEach((node) => {
          node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId));
        });
      },
      releaseButtons,
      unmount({ root }) {
        releaseButtons();
        interactionController?.abort();
        interactionController = null;
        if (releaseListener) {
          global.removeEventListener("pointerup", releaseListener);
          global.removeEventListener("blur", releaseListener);
        }
        releaseListener = null;
        if (root) root.replaceChildren();
        mountedRoot = null;
      }
    });
  };
})(globalThis);
