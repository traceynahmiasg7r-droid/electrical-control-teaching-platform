(function installCh01ContinuousTextbookRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const path = (points) => points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const text = (label, x, y, size = 42, kind = "component", width = null) => `<text class="ch01-continuous-textbook-label ${kind}" x="${x}" y="${y}" text-anchor="middle" font-size="${size}"${width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : ""}>${escape(label)}</text>`;
  platform.moduleRenderers.createCh01ContinuousTextbookRenderer = (data) => {
    const report = data.validateGeometry(); if (!report.valid) throw new Error(report.errors.join("; "));
    const ports = new Map(data.ports.map((p) => [p.portId, p]));
    let rootNode = null, controller = null, onAction = null;
    const pointerOwners = new Map(), keyOwners = new Map();
    const ownerCount = (componentId) => [...pointerOwners.values(), ...keyOwners.values()].filter((id) => id === componentId).length;
    const notify = (componentId, phase) => onAction?.(phase === "press" ? "pressControl" : "releaseControl", { command: componentId === "sb2" ? "stop" : "start" });
    const clearOwners = () => { pointerOwners.clear(); keyOwners.clear(); };
    function attach(root) {
      if (root === rootNode) return;
      clearOwners(); controller?.abort(); controller = new AbortController(); rootNode = root;
      const options = { signal: controller.signal }, doc = root.ownerDocument;
      const buttonFor = (target) => target?.closest?.('[data-component-id="sb1"],[data-component-id="sb2"]')?.dataset.componentId;
      root.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return; const componentId = buttonFor(event.target); if (!componentId) return;
        event.preventDefault(); const before = ownerCount(componentId); pointerOwners.set(event.pointerId, componentId); root.setPointerCapture?.(event.pointerId); if (!before) notify(componentId, "press");
      }, options);
      const endPointer = (event) => { const componentId = pointerOwners.get(event.pointerId); if (!componentId) return; pointerOwners.delete(event.pointerId); if (!ownerCount(componentId)) notify(componentId, "release"); };
      doc.addEventListener("pointerup", endPointer, options); doc.addEventListener("pointercancel", endPointer, options); root.addEventListener("lostpointercapture", endPointer, options);
      root.addEventListener("keydown", (event) => {
        if (![" ", "Enter"].includes(event.key) || event.repeat) return; const componentId = buttonFor(event.target); if (!componentId) return;
        event.preventDefault(); const before = ownerCount(componentId); keyOwners.set(event.key, componentId); if (!before) notify(componentId, "press");
      }, options);
      doc.addEventListener("keyup", (event) => { const componentId = keyOwners.get(event.key); if (!componentId) return; keyOwners.delete(event.key); if (!ownerCount(componentId)) notify(componentId, "release"); }, options);
      doc.defaultView?.addEventListener("blur", clearOwners, options);
    }
    return Object.freeze({
      render({ root, visualState = {}, source = "Live", teachingFocus = [], onAction: callback }) {
        if (!root) return; onAction = callback; attach(root);
        const activeWires = new Set(visualState.activeWireIds || [...(visualState.activeMainWireIds || []), ...(visualState.activeControlWireIds || [])]);
        const activeEdges = new Set(visualState.activeEdgeIds || [...(visualState.activeMainEdgeIds || []), ...(visualState.activeControlEdgeIds || [])]);
        const edgeState = (id) => visualState.edgeStates?.[id] || {};
        const closed = (id, fallback = false) => Object.prototype.hasOwnProperty.call(edgeState(id), "conductive") ? Boolean(edgeState(id).conductive) : fallback;
        const kmOn = Boolean(visualState.stableDeviceStates?.KM ?? visualState.stableDeviceStates?.km ?? visualState.devices?.KM?.energized);
        const pressed = visualState.pressed || visualState.controls || {};
        const isPressed = (id) => pressed[id] === true || pressed[id] === "pressed" || pressed[id]?.state === "pressed";
        const defs = [], base = [], active = [], flow = [];
        function define(id, d) { defs.push(`<path id="${id}" d="${d}"/>`); return id; }
        function useEdge(edgeId, d, fallbackClosed = false) {
          const id = define(`ch01-continuous-edge-${edgeId}`, d), conduct = closed(edgeId, fallbackClosed), on = activeEdges.has(edgeId) && conduct;
          if (on) flow.push(`<use class="ch01-continuous-textbook-flow" data-flow-edge-id="${edgeId}" href="#${id}"/>`);
          return `<use class="ch01-continuous-textbook-conductor${on ? " is-active" : ""}" data-edge-id="${edgeId}" data-conductive="${conduct}" href="#${id}"/>`;
        }
        data.wires.forEach((wire) => {
          const id = define(`ch01-continuous-wire-${wire.wireId}`, path(wire.points));
          base.push(`<use class="ch01-continuous-textbook-wire" data-wire-id="${wire.wireId}" href="#${id}"/>`);
          if (activeWires.has(wire.wireId)) { active.push(`<use class="ch01-continuous-textbook-active" data-wire-id="${wire.wireId}" href="#${id}"/>`); flow.push(`<use class="ch01-continuous-textbook-flow" data-flow-wire-id="${wire.wireId}" href="#${id}"/>`); }
        });
        const bank = data.components.find((c) => c.type === "bank"), bg = bank.geometry;
        const bankParts = bg.poles.map((pole) => {
          const a = ports.get(pole.a), b = ports.get(pole.b), isClosed = closed(pole.edgeId, kmOn);
          return `<g data-pole-id="${pole.edgeId}" data-closed="${isClosed}">${useEdge(pole.edgeId, path(isClosed ? [a, b] : [b, pole.openTip]), isClosed)}<path class="ch01-continuous-textbook-symbol" d="M ${a.x} ${a.y - 9} L ${a.x - 14} ${a.y} L ${a.x} ${a.y + 10} Z"/></g>`;
        }).join("");
        const bankMarkup = `<g class="ch01-continuous-textbook-component${kmOn ? " is-energized" : ""}" data-component-id="km_main" data-energized="${kmOn}">${bankParts}${text(bank.label, bg.labelX, bg.labelY, 42, "component", bg.labelWidth)}</g>`;
        const renderButton = (component, fallbackClosed) => {
          const g = component.geometry, id = component.componentId, nc = component.contactType === "NC", stateClosed = closed(component.electricalEdgeIds[0], fallbackClosed), down = isPressed(id), a = ports.get(g.a), b = ports.get(g.b);
          const bladePath = nc ? (stateClosed ? [a, g.closedTip, b] : [a, g.openTip]) : (stateClosed ? [a, b] : [a, g.openTip]);
          const blade = useEdge(component.electricalEdgeIds[0], path(bladePath), stateClosed);
          const stop = nc ? `<path class="ch01-continuous-textbook-symbol" d="M ${b.x} ${g.closedTip.y} V ${g.stopBottom}"/>` : "";
          const actuator = component.type === "button" ? `<g class="ch01-continuous-textbook-actuator" transform="translate(0 ${down ? 9 : 0})"><path class="ch01-continuous-textbook-symbol" d="M ${g.capLeft} ${g.capY + g.capLeg} V ${g.capY} H ${g.capRight} V ${g.capY + g.capLeg} M ${g.actuatorX} ${g.capY + g.capLeg} V ${g.capY + g.capLeg + 15}"/></g>` : "";
          return `<g class="ch01-continuous-textbook-component${down ? " is-pressed" : ""}${stateClosed ? " is-closed" : ""}" data-component-id="${id}" data-closed="${stateClosed}" data-pressed="${down}" tabindex="0" role="button" aria-label="${escape(id === "sb2" ? "按住停止按钮 SB2" : "按下启动按钮 SB1")}">${blade}${stop}${actuator}${text(component.label, g.labelX, g.labelY, 42, "component", g.labelWidth)}<rect class="ch01-continuous-textbook-hitbox" x="${g.hitbox.x}" y="${g.hitbox.y}" width="${g.hitbox.width}" height="${g.hitbox.height}"/></g>`;
        };
        const sb1 = data.components.find((c) => c.componentId === "sb1"), self = data.components.find((c) => c.componentId === "km_self"), sb2 = data.components.find((c) => c.componentId === "sb2");
        const buttonMarkup = renderButton(sb1, isPressed("sb1"));
        const selfG = self.geometry, selfClosed = closed("km_self_no", kmOn);
        const selfMarkup = `<g class="ch01-continuous-textbook-component${selfClosed ? " is-closed" : ""}" data-component-id="km_self" data-closed="${selfClosed}">${useEdge("km_self_no", path(selfClosed ? [ports.get(selfG.a), ports.get(selfG.b)] : [ports.get(selfG.a), selfG.openTip]), selfClosed)}<path class="ch01-continuous-textbook-symbol" d="M ${ports.get(selfG.a).x} ${ports.get(selfG.a).y - 8} L ${ports.get(selfG.a).x - 12} ${ports.get(selfG.a).y} L ${ports.get(selfG.a).x} ${ports.get(selfG.a).y + 9} Z"/>${text(self.label, selfG.labelX, selfG.labelY, 42, "component", selfG.labelWidth)}</g>`;
        const stopMarkup = renderButton(sb2, !isPressed("sb2"));
        const coil = data.components.find((c) => c.type === "coil"), cg = coil.geometry, coilOn = kmOn;
        const coilMarkup = `<g class="ch01-continuous-textbook-component${coilOn ? " is-energized" : ""}" data-component-id="km_coil" data-energized="${coilOn}"><rect class="ch01-continuous-textbook-coil" x="${ports.get(cg.a).x}" y="${cg.top}" width="${ports.get(cg.b).x - ports.get(cg.a).x}" height="${cg.bottom - cg.top}"/>${text(coil.label, cg.labelX, cg.labelY, 42, "component", cg.labelWidth)}</g>`;
        const motor = data.components.find((c) => c.type === "motor"), mg = motor.geometry, running = Boolean(visualState.motorStates?.M?.running ?? visualState.motorStates?.motor?.running);
        const motorMarkup = `<g class="ch01-continuous-textbook-component${running ? " is-running" : ""}" data-component-id="motor" data-running="${running}"><ellipse class="ch01-continuous-textbook-motor" cx="${mg.x}" cy="${mg.y}" rx="${mg.rx}" ry="${mg.ry}"/>${text("M", mg.x, mg.y + 13, 42)}${running ? `<title>电动机正在长动运行，按下 SB2 停止</title><path class="ch01-continuous-textbook-motion" d="M ${mg.x - 54} ${mg.y} A 54 35 0 0 1 ${mg.x} ${mg.y - 35}"/>` : ""}</g>`;
        const sources = data.supplies.phases.map((id) => { const p = ports.get(id); return `<ellipse class="ch01-continuous-textbook-source" cx="${p.x}" cy="${p.y}" rx="12" ry="9"/>`; }).join("") + data.sourceBars.map((bar) => `<path class="ch01-continuous-textbook-symbol" data-source-symbol="${bar.id}" d="${path(bar.points)}"/>`).join("");
        const decorations = data.decorations.map((item) => `<path class="ch01-continuous-textbook-teaching-decoration" data-decoration-id="${item.id}" d="${item.d}" fill="${item.fill}"/>`).join("");
        const labels = data.labels.map((item) => text(item.text, item.x, item.y, item.size, item.kind, item.width)).join("");
        const box = data.viewBox;
        root.innerHTML = `<section class="ch01-continuous-textbook-module" data-module="ch01_continuous"><svg class="ch01-continuous-textbook-board" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="教材：电动机长动控制与自锁电路" data-state-source="${escape(source)}"><title>教材原图描摹：黑色基础线路，红色真实导通路径，绿色动作元件</title><defs>${defs.join("")}</defs><rect class="ch01-continuous-textbook-background" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><g class="ch01-continuous-textbook-decoration-layer">${decorations}</g><g class="ch01-continuous-textbook-wire-layer">${base.join("")}${active.join("")}</g><g class="ch01-continuous-textbook-component-layer">${bankMarkup}${buttonMarkup}${selfMarkup}${stopMarkup}${coilMarkup}${motorMarkup}${sources}</g><g class="ch01-continuous-textbook-flow-layer">${flow.join("")}</g><g class="ch01-continuous-textbook-label-layer">${labels}</g></svg></section>`;
        root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId)));
      },
      resetInput() { clearOwners(); },
      unmount({ root }) { clearOwners(); controller?.abort(); controller = null; rootNode = null; onAction = null; root?.replaceChildren(); }
    });
  };
})(globalThis);

