(function installMachineToolV2Renderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pt = (value) => Array.isArray(value) ? { x: value[0], y: value[1] } : value;
  const line = (a, b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const polyline = (items) => items.map((value, i) => { const p = pt(value); return `${i ? "L" : "M"} ${p.x} ${p.y}`; }).join(" ");
  const flag = (value) => value === true || value === "pressed" || value === "energized" || value === "closed";
  const directionNames = { forward: "正转", reverse: "反转", up: "上升", down: "下降", clockwise: "正转", counterclockwise: "反转", loosen: "松开", clamp: "夹紧", running: "运行", on: "运行" };
  function text(label, x, y, options = {}) {
    const angle = options.rotate ? ` transform="rotate(${options.rotate} ${x} ${y})"` : "";
    const size = options.size ? ` font-size="${options.size}"` : "";
    const typography = esc(label).replace(/([A-Z]+)(\d+(?:-\d+)?)/g, '$1<tspan baseline-shift="sub" font-size="70%">$2</tspan>');
    return `<text class="${options.className || "machine-v2-device-label"}" x="${x}" y="${y}" text-anchor="${options.anchor || "middle"}"${angle}${size}>${typography}</text>`;
  }
  platform.moduleRenderers = platform.moduleRenderers || {};
  platform.moduleRenderers.createMachineToolCircuitsV2Renderer = (data) => {
    const report = data.validateGeometry?.();
    if (report && !report.valid) throw new Error(report.errors.join("; "));
    const portById = new Map(data.ports.map((port) => [port.portId, port]));
    const edgeById = new Map(data.deviceEdges.map((edge) => [edge.edgeId, edge]));
    const port = (id) => {
      const result = typeof id === "string" ? portById.get(id) : pt(id);
      if (!result || !Number.isFinite(result.x) || !Number.isFinite(result.y)) throw new Error(`Missing visual port: ${id}`);
      return result;
    };
    let rootNode = null, controller = null, onAction = null, heldCommand = null, suppressClickUntil = 0;
    const holdCommands = new Set(["spindleStart", "spindleStop", "rockerUp", "rockerDown", "loosen", "clamp"]);
    function releaseHeld() {
      if (!heldCommand) return;
      const command = heldCommand; heldCommand = null;
      suppressClickUntil = Date.now() + 600;
      onAction?.("releaseControl", { command });
    }
    function attach(root) {
      if (rootNode === root) return;
      controller?.abort(); controller = new AbortController(); rootNode = root;
      const options = { signal: controller.signal };
      root.addEventListener("pointerdown", (event) => {
        const target = event.target.closest("[data-interactive='true']"), command = target?.dataset.action;
        if (event.button !== 0 || !holdCommands.has(command) || heldCommand) return;
        event.preventDefault(); heldCommand = command;
        root.setPointerCapture?.(event.pointerId);
        onAction?.("pressControl", { command });
      }, options);
      // Root survives SVG rerenders; document release also handles pointer-up
      // outside the drawing, keyboard activation and cancellation reliably.
      const doc = root.ownerDocument;
      doc.addEventListener("pointerup", releaseHeld, options);
      doc.addEventListener("pointercancel", releaseHeld, options);
      root.addEventListener("lostpointercapture", releaseHeld, options);
      doc.defaultView?.addEventListener("blur", releaseHeld, options);
      root.addEventListener("click", (event) => {
        const scene = event.target.closest("[data-scene]");
        if (scene) { onAction?.("scene", scene.dataset.scene); return; }
        const target = event.target.closest("[data-interactive='true']");
        if (Date.now() < suppressClickUntil && holdCommands.has(target?.dataset.action)) return;
        if (target?.dataset.action) onAction?.(target.dataset.action);
      }, options);
      root.addEventListener("keydown", (event) => {
        const target = event.target.closest("[data-interactive='true']");
        if (target?.dataset.action && ["Enter", " "].includes(event.key) && !event.repeat) {
          event.preventDefault();
          if (holdCommands.has(target.dataset.action)) { heldCommand = target.dataset.action; onAction?.("pressControl", { command: heldCommand }); }
          else onAction?.(target.dataset.action);
        }
      }, options);
      doc.addEventListener("keyup", (event) => { if (["Enter", " "].includes(event.key)) releaseHeld(); }, options);
    }
    function draw(visual) {
      const defs = [], flow = [], activeEdges = new Set(visual.activeEdgeIds || []), activeWires = new Set(visual.activeWireIds || []);
      const edgeClosed = (edgeId, g = {}) => {
        const state = visual.edgeStates?.[edgeId];
        if (typeof state === "boolean") return state;
        if (state && typeof state.conductive === "boolean") return state.conductive;
        const edge = edgeById.get(edgeId);
        return edge?.defaultClosed ?? (g.normal === "nc" || edge?.condition === "always");
      };
      // Each visible conductor is defined once. Mechanics never enter this registry.
      function conductor(edgeId, path, g = {}) {
        const id = `machine-v2-edge-${edgeId}`, live = activeEdges.has(edgeId) && edgeClosed(edgeId, g);
        defs.push(`<path id="${esc(id)}" d="${path}"/>`);
        if (live) flow.push(`<use class="machine-v2-wire-flow" href="#${esc(id)}" data-flow-edge-id="${esc(edgeId)}"/>`);
        return `<use class="machine-v2-conductor${live ? " is-active-conductor" : ""}" href="#${esc(id)}" data-conductive-geometry="true" data-edge-id="${esc(edgeId)}"/>`;
      }
      function label(component, fallback) {
        const g = component.geometry;
        if (g.hideLabel || !component.label) return "";
        return text(component.label, g.labelX ?? fallback.x, g.labelY ?? fallback.y, { rotate: g.labelRotate, anchor: g.labelAnchor, size: g.labelSize });
      }
      function group(component, body, attributes = {}, bounds) {
        const g = component.geometry, action = g.action || component.action;
        const interactive = action ? ` data-interactive="true" data-action="${esc(action)}" tabindex="0" role="button" aria-label="${esc(g.actionLabel || component.label)}"` : "";
        const extra = Object.entries(attributes).map(([key, value]) => ` data-${key}="${esc(value)}"`).join("");
        const cls = ["machine-v2-device", `machine-v2-${component.type}`, attributes.closed === true ? "is-closed" : "", attributes.closed === false ? "is-open" : "", attributes.energized ? "is-energized" : "", attributes.running ? "is-running" : "", attributes.pressed ? "is-pressed" : ""].filter(Boolean).join(" ");
        const hit = action && bounds ? `<rect class="machine-v2-hitbox" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"/>` : "";
        return `<g class="${cls}" data-component-id="${esc(component.componentId)}" data-component-type="${esc(component.type)}"${extra}${interactive}>${body}${hit}</g>`;
      }
      function contact(component) {
        const g = component.geometry, a = port(g.a), b = port(g.b), id = component.electricalEdgeIds[0];
        const closed = edgeClosed(id, g), normalNC = g.normal === "nc", pressedKey = g.pressedKey || component.componentId.replace(/_(?:no|nc).*$/, "");
        const pressed = flag(visual.pressed?.[pressedKey] ?? visual.pressed?.[pressedKey.toUpperCase()]);
        const delta = pressed ? 7 : 0, x = g.actuatorX ?? (a.x + b.x) / 2;
        let blade, fixed = "";
        if (normalNC) {
          blade = closed ? `M ${a.x} ${a.y} L ${b.x} ${b.y + 14} L ${b.x} ${b.y}` : `M ${a.x} ${a.y} L ${b.x - 10} ${b.y - 19}`;
          fixed = `<path class="machine-v2-symbol" d="M ${b.x} ${b.y} v 20"/>`;
        } else {
          blade = closed ? line(a, b) : `M ${a.x} ${a.y} L ${b.x - 10} ${b.y - 20}`;
          fixed = `<path class="machine-v2-symbol" d="M ${b.x - 6} ${b.y} H ${b.x}"/>`;
        }
        let mechanism = "";
        if (g.symbol === "button" || component.type === "button") mechanism = `<g class="machine-v2-button-actuator" transform="translate(0 ${delta})"><path class="machine-v2-symbol" d="M ${x - 17} ${a.y - 28} v -13 h 34 v 13"/><path class="machine-v2-mechanical-link" d="M ${x} ${a.y - 40} V ${a.y - 3}"/></g>`;
        else if (g.symbol === "limit") {
          const rollerX = a.x + 8, rollerY = a.y + (closed && normalNC ? 1 : -3);
          mechanism = `<circle class="machine-v2-contact-roller" cx="${rollerX}" cy="${rollerY}" r="4"/>`;
        }
        else if (g.symbol === "thermal") mechanism = `<path class="machine-v2-symbol" d="M ${x - 34} ${a.y + 44} h 16 v -15 h 34 v 15 h 16 M ${x} ${a.y + 29} v -19"/>`;
        else if (g.symbol === "timer-no" || g.symbol === "timer-nc") {
          const y = a.y + (g.timerBelow ? 25 : -28), sign = g.timerBelow ? -1 : 1;
          mechanism = `<path class="machine-v2-symbol" d="M ${x - 15} ${y} q 15 ${sign * 17} 30 0 M ${x - 5} ${y + sign * 10} V ${a.y - 3} M ${x + 5} ${y + sign * 10} V ${a.y - 3}"/>`;
        }
        else if (g.kind === "switch" || g.symbol === "switch") mechanism = `<path class="machine-v2-symbol" d="M ${x - 10} ${a.y - 29} h 20 M ${x} ${a.y - 29} v 15"/>`;
        if (g.symbol === "interlock") fixed += `<path class="machine-v2-symbol" d="M ${b.x} ${b.y + (normalNC ? 4 : 0)} q -9 -7 -10 1 q 1 5 7 3"/>`;
        return group(component, `${conductor(id, blade, g)}${fixed}${mechanism}${label(component, { x, y: a.y - 42 })}`, { closed, pressed }, { x: Math.min(a.x, b.x) - 12, y: Math.min(a.y, b.y) - 54, width: Math.abs(b.x - a.x) + 24, height: 92 });
      }
      function bank(component) {
        const g = component.geometry, poles = g.poles, endpoints = poles.flatMap((pole) => [port(pole.a), port(pole.b)]);
        const xMin = Math.min(...endpoints.map((p) => p.x)), xMax = Math.max(...endpoints.map((p) => p.x)), yMin = Math.min(...endpoints.map((p) => p.y)), yMax = Math.max(...endpoints.map((p) => p.y));
        const blades = poles.map((pole, i) => {
          const a = port(pole.a), b = port(pole.b), id = component.electricalEdgeIds[i], closed = edgeClosed(id, g);
          return conductor(id, line(b, closed ? a : { x: a.x - (g.openOffset || 21), y: a.y + (g.openDrop || 1) }), g);
        }).join("");
        const mechanics = g.mechanical ? `<path class="machine-v2-mechanical-link" d="${Array.isArray(g.mechanical) ? polyline(g.mechanical) : `M ${xMin - 10} ${yMin + (yMax - yMin) * .27} H ${xMax + 2}`}"/>` : "";
        return group(component, `${blades}${mechanics}${label(component, { x: xMax + 30, y: (yMin + yMax) / 2 })}`, { closed: component.electricalEdgeIds.every((id) => edgeClosed(id, g)) }, { x: xMin - 30, y: yMin - 8, width: xMax - xMin + 45, height: yMax - yMin + 16 });
      }
      function fuse(component) {
        const g = component.geometry, a = port(g.a), b = port(g.b), horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, length = horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
        const w = horizontal ? Math.min(g.length || 38, length) : (g.width || 19), h = horizontal ? (g.width || 17) : Math.min(g.length || 38, length);
        return group(component, `<rect class="machine-v2-symbol-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}"/>${conductor(component.electricalEdgeIds[0], line(a, b), g)}${label(component, { x, y: y - 23 })}`);
      }
      function thermal(component) {
        const g = component.geometry, a = port(g.a), b = port(g.b), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, h = Math.abs(b.y - a.y), width = g.width || 65;
        const path = `M ${a.x} ${a.y} V ${a.y + h * .22} H ${x - 18} V ${b.y - h * .22} H ${b.x} V ${b.y}`;
        return group(component, `<rect class="machine-v2-symbol-body" x="${x - width / 2}" y="${Math.min(a.y, b.y)}" width="${width}" height="${h}"/>${conductor(component.electricalEdgeIds[0], path, g)}${label(component, { x: x + width / 2 + 35, y: y + 10 })}`);
      }
      function coil(component) {
        const g = component.geometry, a = port(g.a), b = port(g.b), x = Math.min(a.x, b.x), y = (a.y + b.y) / 2, w = Math.abs(b.x - a.x), h = g.height || 38;
        const energized = flag(visual.stableDeviceStates?.[g.state || component.label]);
        const timer = g.timer ? `<rect class="machine-v2-timer-half" x="${x}" y="${y}" width="${w}" height="${h / 2}"/>` : "";
        return group(component, `<rect class="machine-v2-coil-body" x="${x}" y="${y - h / 2}" width="${w}" height="${h}"/>${timer}${label(component, { x: x + w / 2, y: y - h / 2 - 14 })}`, { energized });
      }
      function motor(component) {
        const g = component.geometry, r = g.r || 61, key = g.state || g.label || component.label, state = visual.motorStates?.[key] || {}, running = Boolean(state.running);
        const motionRadius = r - 8;
        const motion = running ? `<title>${esc(g.label || component.label)}：${directionNames[state.direction] || "运行"}</title><g class="machine-v2-motor-motion" style="transform-origin:${g.x}px ${g.y}px"><path d="M ${g.x - motionRadius} ${g.y} A ${motionRadius} ${motionRadius} 0 0 1 ${g.x} ${g.y - motionRadius}"/><path d="M ${g.x - 7} ${g.y - motionRadius - 5} l 9 5 l -9 5"/></g>` : "";
        return group(component, `<circle class="machine-v2-motor-body" cx="${g.x}" cy="${g.y}" r="${r}"/>${text(g.label || component.label, g.x, g.y + 1, { className: "machine-v2-motor-mark", size: g.fontSize || 37 })}${text("3~", g.x, g.y + 33, { className: "machine-v2-motor-phase", size: 29 })}${motion}`, { running, direction: state.direction || "none" });
      }
      function lamp(component) {
        const g = component.geometry, r = g.r || 20, key = g.state || component.label, energized = flag(visual.lamps?.[key]) || flag(visual.stableDeviceStates?.[key]), offset = r * .71;
        return group(component, `<circle class="machine-v2-lamp-body" cx="${g.x}" cy="${g.y}" r="${r}"/><path class="machine-v2-symbol" d="M ${g.x - offset} ${g.y - offset} L ${g.x + offset} ${g.y + offset} M ${g.x + offset} ${g.y - offset} L ${g.x - offset} ${g.y + offset}"/>${label(component, { x: g.x, y: g.y - r - 12 })}`, { energized });
      }
      function windingPath(a, b, direction = 1, turns = 4, depth = 13) {
        const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y), length = horizontal ? b.x - a.x : b.y - a.y, step = length / turns;
        let d = `M ${a.x} ${a.y}`;
        for (let i = 0; i < turns; i++) d += horizontal ? ` q ${step / 2} ${depth * direction} ${step} 0` : ` q ${depth * direction} ${step / 2} 0 ${step}`;
        return d;
      }
      function winding(component) {
        const g = component.geometry, a = port(g.a), b = port(g.b);
        return group(component, `${conductor(component.electricalEdgeIds[0], windingPath(a, b, g.direction ?? -1, g.turns || 4, g.depth || 13), g)}${label(component, { x: a.x - 25, y: (a.y + b.y) / 2 })}`);
      }
      function transformer(component) {
        const g = component.geometry, primary = g.primary.map(port), secondary = g.secondary.map(port), ids = component.electricalEdgeIds;
        const upper = windingPath(primary[0], primary[1], g.primaryDirection ?? 1, g.turns || 4, 17), lower = windingPath(secondary[0], secondary[1], g.secondaryDirection ?? -1, g.turns || 4, 17);
        const winding = ids.length === 2 ? `${conductor(ids[0], upper, g)}${conductor(ids[1], lower, g)}` : `<path class="machine-v2-symbol" d="${upper} ${lower}"/>`;
        return group(component, `${winding}${label(component, { x: (primary[0].x + primary[1].x) / 2, y: primary[0].y - 13 })}`);
      }
      function renderComponent(component) {
        if (["contact", "button", "switch"].includes(component.type)) return contact(component);
        if (["bank", "breaker-bank", "main-switch-bank", "main-contacts"].includes(component.type)) return bank(component);
        if (component.type === "fuse") return fuse(component);
        if (component.type === "thermal") return thermal(component);
        if (component.type === "coil") return coil(component);
        if (component.type === "motor") return motor(component);
        if (component.type === "lamp") return lamp(component);
        if (component.type === "winding") return winding(component);
        if (component.type === "transformer") return transformer(component);
        if (component.type === "ground") { const g = component.geometry; return group(component, `<path class="machine-v2-symbol" d="M ${g.x} ${g.y} v 7 m -18 0 h 36 m -29 8 h 22 m -15 8 h 8"/>`); }
        throw new Error(`Unsupported source symbol: ${component.type}`);
      }
      const phaseTerminals = (data.supplies?.phases || []).map((id) => { const p = port(id); return `<circle class="machine-v2-source-terminal" cx="${p.x}" cy="${p.y}" r="5.2"/>`; }).join("");
      const components = data.components.map(renderComponent).join("") + phaseTerminals, base = [], active = [];
      data.wires.forEach((wire) => {
        const id = `machine-v2-geometry-${wire.wireId}`;
        defs.push(`<path id="${esc(id)}" d="${polyline(wire.points)}"/>`);
        base.push(`<use class="machine-v2-wire ${esc(wire.domain)}" href="#${esc(id)}" data-wire-id="${esc(wire.wireId)}"/>`);
        if (activeWires.has(wire.wireId)) {
          active.push(`<use class="machine-v2-wire-active ${esc(wire.domain)}" href="#${esc(id)}" data-wire-id="${esc(wire.wireId)}"/>`);
          flow.push(`<use class="machine-v2-wire-flow ${esc(wire.domain)}" href="#${esc(id)}" data-flow-wire-id="${esc(wire.wireId)}"/>`);
        }
      });
      const activePorts = new Set(data.wires.filter((wire) => activeWires.has(wire.wireId)).flatMap((wire) => [wire.from, wire.to]));
      const junctions = (data.junctions || []).filter((junction) => junction.visible !== false).map((junction) => `<circle class="machine-v2-junction${activePorts.has(junction.portId) ? " is-active" : ""}" data-junction-id="${esc(junction.junctionId)}" cx="${junction.x}" cy="${junction.y}" r="${junction.r || 4.3}"/>`).join("");
      // Distinct crossing ports are non-connected; no invented X or junction.
      const decorations = (data.decorations || []).map((item) => {
        const end = pt(item.points[item.points.length - 1]);
        const arrow = item.kind === "arrow" ? ` M ${end.x - 4} ${end.y + 22} L ${end.x} ${end.y} L ${end.x + 4} ${end.y + 22}` : "";
        return `<path class="${item.kind === "mechanical" ? "machine-v2-mechanical-link" : "machine-v2-symbol"}" data-decoration-id="${esc(item.id)}" d="${polyline(item.points)}${arrow}"/>`;
      }).join("");
      const labels = (data.labels || []).map((item) => text(item.text, item.x, item.y, { ...item, className: `machine-v2-label machine-v2-label-${item.kind || "source"}` })).join("");
      return { defs: defs.join(""), wires: base.join("") + active.join(""), components, junctions, decorations, labels, flow: flow.join("") };
    }
    return Object.freeze({
      render({ root, visualState = {}, activeScene = "spindle", teachingFocus = [], source = "Live", onAction: nextAction }) {
        if (!root) return;
        onAction = nextAction; attach(root);
        const contents = draw(visualState), box = data.viewBox;
        const tabs = (data.scenes || []).map((scene) => `<button type="button" class="machine-v2-scene-tab${scene.id === activeScene ? " is-active" : ""}" role="tab" aria-selected="${scene.id === activeScene}" data-scene="${esc(scene.id)}">${esc(scene.title)}</button>`).join("");
        root.innerHTML = `<section class="machine-v2-module" data-module="ch02_machine_tool_circuits_v2"><div class="machine-v2-scene-tabs" role="tablist" aria-label="机床教学场景">${tabs}</div><div class="machine-v2-canvas-shell"><svg class="machine-v2-board" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Z3040 机床综合线路教材电路" data-state-source="${esc(source)}"><title>黑色为教材电路，红色为真实导通路径，绿色表示元件工作状态</title><defs>${contents.defs}</defs><rect class="machine-v2-background" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><g class="machine-v2-wire-layer">${contents.wires}</g><g class="machine-v2-component-layer">${contents.components}</g><g class="machine-v2-decoration-layer" aria-hidden="true">${contents.decorations}</g><g class="machine-v2-flow-layer" aria-hidden="true">${contents.flow}</g><g class="machine-v2-junction-layer">${contents.junctions}</g><g class="machine-v2-label-layer">${contents.labels}</g></svg></div></section>`;
        const focus = new Set(teachingFocus);
        root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", focus.has(node.dataset.componentId)));
      },
      unmount({ root }) { releaseHeld(); controller?.abort(); controller = null; rootNode = null; onAction = null; if (root) root.replaceChildren(); }
    });
  };
})(globalThis);
