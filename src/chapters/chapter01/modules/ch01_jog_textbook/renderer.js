(function installCh01JogTextbookRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const path = (points) => points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const text = (label, x, y, size = 42, kind = "component", width = null) => `<text class="ch01-jog-textbook-label ${kind}" x="${x}" y="${y}" text-anchor="middle" font-size="${size}"${width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : ""}>${escape(label)}</text>`;
  platform.moduleRenderers.createCh01JogTextbookRenderer = (data) => {
    const report = data.validateGeometry(); if (!report.valid) throw new Error(report.errors.join("; "));
    const ports = new Map(data.ports.map((p) => [p.portId, p]));
    let rootNode = null, controller = null, onAction = null;
    const pointerOwners = new Set(), keyOwners = new Set();
    const countOwners = () => pointerOwners.size + keyOwners.size;
    function notifyPress() { onAction?.("pressControl", { command: "jog" }); }
    function notifyRelease() { onAction?.("releaseControl", { command: "jog" }); }
    function clearOwners() { const wasHeld = countOwners(); pointerOwners.clear(); keyOwners.clear(); if (wasHeld) notifyRelease(); }
    function attach(root) {
      if (root === rootNode) return;
      clearOwners(); controller?.abort(); controller = new AbortController(); rootNode = root;
      const options = { signal: controller.signal }, doc = root.ownerDocument;
      const isButton = (event) => event.target.closest?.('[data-component-id="sb1"]');
      root.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !isButton(event)) return;
        event.preventDefault(); const previous = countOwners(); pointerOwners.add(event.pointerId); root.setPointerCapture?.(event.pointerId); if (!previous) notifyPress();
      }, options);
      const endPointer = (event) => { const had = pointerOwners.delete(event.pointerId); if (had && !countOwners()) notifyRelease(); };
      doc.addEventListener("pointerup", endPointer, options); doc.addEventListener("pointercancel", endPointer, options); root.addEventListener("lostpointercapture", endPointer, options);
      root.addEventListener("keydown", (event) => {
        if (![" ", "Enter"].includes(event.key) || !isButton(event)) return;
        event.preventDefault(); if (event.repeat) return;
        const previous = countOwners(); keyOwners.add(event.key); if (!previous) notifyPress();
      }, options);
      doc.addEventListener("keyup", (event) => { const had = keyOwners.delete(event.key); if (had && !countOwners()) notifyRelease(); }, options);
      doc.defaultView?.addEventListener("blur", clearOwners, options);
    }
    return Object.freeze({
      render({ root, visualState = {}, source = "Live", teachingFocus = [], onAction: callback }) {
        if (!root) return; onAction = callback; attach(root);
        const activeWires = new Set(visualState.activeWireIds || [...(visualState.activeMainWireIds || []), ...(visualState.activeControlWireIds || [])]), activeEdges = new Set(visualState.activeEdgeIds || []);
        const closed = (id) => Boolean(visualState.edgeStates?.[id]?.conductive);
        const defs = [], base = [], active = [], flow = [];
        function conductive(edgeId, d) {
          const id = `ch01-jog-edge-${edgeId}`, on = activeEdges.has(edgeId) && closed(edgeId);
          defs.push(`<path id="${id}" d="${d}"/>`);
          if (on) flow.push(`<use class="ch01-jog-textbook-flow" data-flow-edge-id="${edgeId}" href="#${id}"/>`);
          return `<use class="ch01-jog-textbook-conductor${on ? " is-active" : ""}" data-edge-id="${edgeId}" href="#${id}"/>`;
        }
        data.wires.forEach((wire) => {
          const id = `ch01-jog-wire-${wire.wireId}`; defs.push(`<path id="${id}" d="${path(wire.points)}"/>`);
          base.push(`<use class="ch01-jog-textbook-wire" data-wire-id="${wire.wireId}" href="#${id}"/>`);
          if (activeWires.has(wire.wireId)) { active.push(`<use class="ch01-jog-textbook-active" data-wire-id="${wire.wireId}" href="#${id}"/>`); flow.push(`<use class="ch01-jog-textbook-flow" data-flow-wire-id="${wire.wireId}" href="#${id}"/>`); }
        });
        const bank = data.components.find((c) => c.type === "bank"), bg = bank.geometry;
        const bankParts = bg.poles.map((pole) => {
          const a = ports.get(pole.a), b = ports.get(pole.b), isClosed = closed(pole.edgeId);
          return `<g data-pole-id="${pole.edgeId}" data-closed="${isClosed}">${conductive(pole.edgeId, path(isClosed ? [a, b] : [b, pole.openTip]))}<path class="ch01-jog-textbook-symbol" d="M ${a.x} ${a.y - 9} L ${a.x - 14} ${a.y} L ${a.x} ${a.y + 10} Z"/></g>`;
        }).join("");
        const bankMarkup = `<g class="ch01-jog-textbook-component" data-component-id="km_main">${bankParts}${text(bank.label, bg.labelX, bg.labelY, 42, "component", bg.labelWidth)}</g>`;
        const button = data.components.find((c) => c.type === "button"), g = button.geometry, a = ports.get(g.a), b = ports.get(g.b);
        const isClosed = closed("sb1_no"), pressed = visualState.pressed?.sb1 === true || visualState.pressed?.sb1 === "pressed";
        const actuator = `<g class="ch01-jog-textbook-actuator" transform="translate(0 ${pressed ? 9 : 0})"><path class="ch01-jog-textbook-symbol" d="M 970 684 V ${g.capY} H 1043 V 684 M ${g.actuatorX} ${g.capY} v 15 M ${g.actuatorX} 695 v 18"/></g>`;
        const buttonMarkup = `<g class="ch01-jog-textbook-component" data-component-id="sb1" data-closed="${isClosed}" data-pressed="${pressed}" tabindex="0" role="button" aria-label="按住点动 · SB1">${conductive("sb1_no", path([a, isClosed ? b : g.openTip]))}${actuator}${text(button.label, g.labelX, g.labelY, 42, "component", g.labelWidth)}<rect class="ch01-jog-textbook-hitbox" x="949" y="649" width="109" height="105"/></g>`;
        const coil = data.components.find((c) => c.type === "coil"), cg = coil.geometry, coilOn = Boolean(visualState.stableDeviceStates?.KM);
        const coilMarkup = `<g class="ch01-jog-textbook-component${coilOn ? " is-energized" : ""}" data-component-id="km_coil" data-energized="${coilOn}"><rect class="ch01-jog-textbook-coil" x="${ports.get(cg.a).x}" y="${cg.top}" width="${ports.get(cg.b).x - ports.get(cg.a).x}" height="${cg.bottom - cg.top}"/>${text(coil.label, cg.labelX, cg.labelY, 42, "component", cg.labelWidth)}</g>`;
        const motor = data.components.find((c) => c.type === "motor"), mg = motor.geometry, running = Boolean(visualState.motorStates?.M?.running);
        const motorMarkup = `<g class="ch01-jog-textbook-component${running ? " is-running" : ""}" data-component-id="motor" data-running="${running}"><ellipse class="ch01-jog-textbook-motor" cx="${mg.x}" cy="${mg.y}" rx="${mg.rx}" ry="${mg.ry}"/>${text("M", mg.x, mg.y + 13, 42)}${running ? `<title>电动机正在点动，松开 SB1 即停止</title><path class="ch01-jog-textbook-motion" d="M 417 1073 A 54 35 0 0 1 471 1038"/>` : ""}</g>`;
        const sourceSymbols = data.supplies.phases.map((id) => { const p = ports.get(id); return `<ellipse class="ch01-jog-textbook-source" cx="${p.x}" cy="${p.y}" rx="12" ry="8"/>`; }).join("") + data.sourceBars.map((bar) => `<path class="ch01-jog-textbook-symbol" d="${path(bar.points)}"/>`).join("");
        const labels = data.labels.map((item) => text(item.text, item.x, item.y, item.size, item.kind, item.width)).join("");
        const box = data.viewBox;
        root.innerHTML = `<section class="ch01-jog-textbook-module" data-module="ch01_jog"><svg class="ch01-jog-textbook-board" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="教材：电动机点动控制主电路与控制电路" data-state-source="${escape(source)}"><title>按教材原图描摹，黑色为基础电路，红色为真实导通路径，绿色为元件工作状态</title><defs>${defs.join("")}</defs><rect class="ch01-jog-textbook-background" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><g class="ch01-jog-textbook-wire-layer">${base.join("")}${active.join("")}</g><g class="ch01-jog-textbook-component-layer">${bankMarkup}${buttonMarkup}${coilMarkup}${motorMarkup}${sourceSymbols}</g><g class="ch01-jog-textbook-flow-layer">${flow.join("")}</g><g class="ch01-jog-textbook-label-layer">${labels}</g></svg></section>`;
        root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId)));
      },
      resetInput() { pointerOwners.clear(); keyOwners.clear(); },
      unmount({ root }) { clearOwners(); controller?.abort(); controller = null; rootNode = null; onAction = null; root?.replaceChildren(); }
    });
  };
})(globalThis);
