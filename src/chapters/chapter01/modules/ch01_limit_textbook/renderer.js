(function installCh01LimitTextbookRenderer(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleRenderers = platform.moduleRenderers || {};
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const path = (points) => points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const label = (value, g, kind = "component") => `<text class="ch01-limit-textbook-label ${kind}" x="${g.labelX ?? g.x}" y="${g.labelY ?? g.y}" text-anchor="middle" font-size="${g.labelSize ?? g.size ?? 23}"${g.labelWidth || g.width ? ` textLength="${g.labelWidth ?? g.width}" lengthAdjust="spacingAndGlyphs"` : ""}>${escape(value)}</text>`;

  platform.moduleRenderers.createCh01LimitTextbookRenderer = (data) => {
    const validation = data.validateGeometry();
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    const ports = new Map(data.ports.map((item) => [item.portId, item]));
    const components = new Map(data.components.map((item) => [item.componentId, item]));
    let rootNode = null, controller = null, onAction = null;
    const pointerOwners = new Map(), keyOwners = new Map();
    const commandFor = (target) => target?.closest?.(".ch01-limit-textbook-hitbox[data-action-command]")?.dataset.actionCommand;
    const protectionFor = (target) => target?.closest?.(".ch01-limit-textbook-hitbox[data-protection-command]")?.dataset.protectionCommand;
    const ownerCount = (command) => [...pointerOwners.values(), ...keyOwners.values()].filter((owned) => owned === command).length;
    const notify = (command, pressed) => onAction?.(pressed ? "pressControl" : "releaseControl", { command });
    const clearOwners = () => { pointerOwners.clear(); keyOwners.clear(); };

    function attach(root) {
      if (rootNode === root) return;
      controller?.abort();
      clearOwners();
      rootNode = root;
      controller = new AbortController();
      const options = { signal: controller.signal }, doc = root.ownerDocument;
      root.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const command = commandFor(event.target);
        if (!command) return;
        event.preventDefault();
        if (pointerOwners.has(event.pointerId)) return;
        const previous = ownerCount(command);
        pointerOwners.set(event.pointerId, command);
        root.setPointerCapture?.(event.pointerId);
        if (!previous) notify(command, true);
      }, options);
      const endPointer = (event) => {
        const command = pointerOwners.get(event.pointerId);
        if (!command) return;
        pointerOwners.delete(event.pointerId);
        if (!ownerCount(command)) notify(command, false);
      };
      doc.addEventListener("pointerup", endPointer, { ...options, capture: true });
      doc.addEventListener("pointercancel", endPointer, { ...options, capture: true });
      root.addEventListener("lostpointercapture", endPointer, options);
      root.addEventListener("keydown", (event) => {
        if (![" ", "Enter"].includes(event.key) || event.repeat) return;
        const command = commandFor(event.target), protection = protectionFor(event.target);
        if (!command && !protection) return;
        event.preventDefault();
        if (protection) { onAction?.("toggleProtection", { command: protection }); return; }
        if (keyOwners.has(event.key)) return;
        const previous = ownerCount(command);
        keyOwners.set(event.key, command);
        if (!previous) notify(command, true);
      }, options);
      doc.addEventListener("keyup", (event) => {
        const command = keyOwners.get(event.key);
        if (!command) return;
        keyOwners.delete(event.key);
        if (!ownerCount(command)) notify(command, false);
      }, { ...options, capture: true });
      root.addEventListener("click", (event) => {
        const protection = protectionFor(event.target);
        if (protection && event.detail !== 0) {
          event.preventDefault();
          onAction?.("toggleProtection", { command: protection });
        }
      }, options);
      doc.defaultView?.addEventListener("blur", () => {
        const commands = new Set([...pointerOwners.values(), ...keyOwners.values()]);
        clearOwners();
        commands.forEach((command) => notify(command, false));
      }, options);
    }

    function render({ root, visualState = {}, source = "Live", teachingFocus = [], onAction: callback = null }) {
      if (!root) return;
      onAction = callback;
      attach(root);
      const focused = root.ownerDocument.activeElement?.dataset.actionCommand || root.ownerDocument.activeElement?.dataset.protectionCommand;
      const focusKind = root.ownerDocument.activeElement?.dataset.actionCommand ? "action" : "protection";
      const activeWires = new Set(visualState.activeWireIds || [...(visualState.activeMainWireIds || []), ...(visualState.activeControlWireIds || [])]);
      const activeEdges = new Set(visualState.activeEdgeIds || []);
      const edgeState = (id) => visualState.edgeStates?.[id] || {};
      const closed = (id, fallback = false) => Object.hasOwn(edgeState(id), "conductive") ? Boolean(edgeState(id).conductive) : fallback;
      const pressed = (id) => visualState.pressed?.[id] === "pressed";
      const kmOn = Boolean(visualState.stableDeviceStates?.KM);
      const running = Boolean(visualState.motorStates?.M?.running);
      const tripped = Boolean(visualState.protectionStates?.FR1?.tripped);
      const triggered = Boolean(visualState.protectionStates?.SQ?.triggered);
      const defs = [], wires = [], active = [], flow = [];
      const define = (id, d) => { defs.push(`<path id="ch01-limit-${id}" d="${d}"/>`); return `#ch01-limit-${id}`; };
      const useEdge = (id, points, fallback = false) => {
        const href = define(`edge-${id}`, path(points));
        const conductive = closed(id, fallback), energized = conductive && activeEdges.has(id);
        if (energized) flow.push(`<use class="ch01-limit-textbook-flow" data-flow-edge-id="${id}" href="${href}"/>`);
        return `<use class="ch01-limit-textbook-conductor${energized ? " is-active" : ""}" data-edge-id="${id}" data-conductive="${conductive}" href="${href}"/>`;
      };
      data.wires.forEach((wire) => {
        const href = define(`wire-${wire.wireId}`, path(wire.points));
        wires.push(`<use class="ch01-limit-textbook-wire" data-wire-id="${wire.wireId}" href="${href}"/>`);
        if (activeWires.has(wire.wireId)) {
          active.push(`<use class="ch01-limit-textbook-active" data-wire-id="${wire.wireId}" href="${href}"/>`);
          flow.push(`<use class="ch01-limit-textbook-flow" data-flow-wire-id="${wire.wireId}" href="${href}"/>`);
        }
      });

      const bank = components.get("km_main"), bankG = bank.geometry;
      const bankParts = bankG.poles.map((pole) => {
        const contactClosed = closed(pole.edgeId, kmOn), circle = pole.circle;
        const blade = contactClosed ? pole.closedConductivePath : [ports.get(pole.b), pole.openTip];
        return `<g data-pole-id="${pole.edgeId}" data-closed="${contactClosed}">${useEdge(pole.edgeId, blade, contactClosed)}<circle class="ch01-limit-textbook-contact-dot" cx="${circle.x}" cy="${circle.y}" r="${circle.r}"/></g>`;
      }).join("");
      const bankMarkup = `<g class="ch01-limit-textbook-component${kmOn ? " is-energized" : ""}" data-component-id="km_main" data-energized="${kmOn}">${bankParts}${label(bank.label, bankG)}</g>`;

      const renderContact = (component) => {
        const g = component.geometry, id = component.componentId, edgeId = component.electricalEdgeIds[0];
        const contactClosed = closed(edgeId, component.contactType === "NC");
        const blade = contactClosed ? g.closedConductivePath : [g.bladePivot, g.openTip];
        const fixed = g.fixedPath?.length ? `<path class="ch01-limit-textbook-symbol" d="${path(g.fixedPath)}"/>` : "";
        const actuator = component.type === "button" ? `<g class="ch01-limit-textbook-actuator" transform="translate(0 ${pressed(id) ? 9 : 0})"><path class="ch01-limit-textbook-symbol" d="M ${g.capLeft} ${g.capY + g.capLeg} V ${g.capY} H ${g.capRight} V ${g.capY + g.capLeg} M ${g.actuatorX} ${g.actuatorTop} V ${g.actuatorBottom}"/></g>` : "";
        const thermal = g.thermalSign ? `<path class="ch01-limit-textbook-symbol" d="${path(g.thermalSign)}"/><path class="ch01-limit-textbook-linkage" d="${path(g.linkage)}"/>` : "";
        const striker = g.striker ? `<path class="ch01-limit-textbook-striker" d="${path(g.striker)}" transform="translate(0 ${triggered ? -10 : 0})"/>` : "";
        const protection = id === "sq" ? "sq" : id === "fr1_nc" ? "fr1" : null;
        const hitbox = g.hitbox || (protection === "fr1" ? { x: 710, y: 775, width: 175, height: 125 } : null);
        const interactive = id === "sb1" || id === "sb2" || protection;
        const interaction = !interactive ? "" : `<rect class="ch01-limit-textbook-hitbox" ${protection ? `data-protection-command="${protection}"` : `data-action-command="${id === "sb1" ? "start" : "stop"}"`} x="${hitbox.x}" y="${hitbox.y}" width="${hitbox.width}" height="${hitbox.height}" tabindex="0" role="button" aria-label="${escape(protection ? (protection === "sq" ? "触发或复位 SQ 行程开关" : "触发或复位 FR1 过载") : (id === "sb1" ? "按住启动 SB1" : "按住停止 SB2"))}"/>`;
        const isOperating = protection === "sq" ? triggered : protection === "fr1" ? tripped : pressed(id);
        const conductor = useEdge(edgeId, blade, contactClosed);
        return `<g class="ch01-limit-textbook-component${contactClosed ? " is-closed" : ""}${isOperating ? " is-operating" : ""}" data-component-id="${id}" data-closed="${contactClosed}" data-pressed="${Boolean(pressed(id))}"${protection ? ` data-triggered="${isOperating}"` : ""}>${fixed}${conductor}${actuator}${thermal}${striker}${label(component.label, g)}${interaction}</g>`;
      };

      const heater = components.get("fr1_main"), hg = heater.geometry;
      const heaterMarkup = `<g class="ch01-limit-textbook-component${tripped ? " is-tripped" : ""}" data-component-id="fr1_main" data-tripped="${tripped}"><path class="ch01-limit-textbook-heater" d="${path(hg.outline)}"/><path class="ch01-limit-textbook-heater-detail" d="${path(hg.notch)}"/>${heater.electricalEdgeIds.map((id) => useEdge(id, hg.conductivePaths[id], true)).join("")}${label(heater.label, hg)}</g>`;
      const coil = components.get("km_coil"), cg = coil.geometry;
      const coilMarkup = `<g class="ch01-limit-textbook-component${kmOn ? " is-energized" : ""}" data-component-id="km_coil" data-energized="${kmOn}"><rect class="ch01-limit-textbook-coil" x="${ports.get(cg.a).x}" y="${cg.top}" width="${ports.get(cg.b).x - ports.get(cg.a).x}" height="${cg.bottom - cg.top}"/>${label(coil.label, cg)}</g>`;
      const motor = components.get("motor"), mg = motor.geometry;
      const motorMarkup = `<g class="ch01-limit-textbook-component${running ? " is-running" : ""}" data-component-id="motor" data-running="${running}"><ellipse class="ch01-limit-textbook-motor" cx="${mg.x}" cy="${mg.y}" rx="${mg.rx}" ry="${mg.ry}"/>${running ? `<ellipse class="ch01-limit-textbook-motor-motion" cx="${mg.x}" cy="${mg.y}" rx="${mg.rx - 6}" ry="${mg.ry - 6}"/>` : ""}${label("M", { x: mg.x, y: mg.y + 9, size: mg.labelSize })}</g>`;
      const sources = data.sourceSymbols.map((symbol) => `<g class="ch01-limit-textbook-source-symbol"><ellipse class="ch01-limit-textbook-source" cx="${symbol.center.x}" cy="${symbol.center.y}" rx="${symbol.rx}" ry="${symbol.ry}"/><path class="ch01-limit-textbook-symbol" d="${path(symbol.slash)} ${path(symbol.points)}"/></g>`).join("");
      const junctions = data.junctions.filter((item) => item.visible).map((item) => `<circle class="ch01-limit-textbook-junction" cx="${item.x}" cy="${item.y}" r="4"/>`).join("");
      const contactMarkup = ["sb1", "km_self", "sb2", "fr1_nc", "sq"].map((id) => renderContact(components.get(id))).join("");
      const box = data.viewBox, title = data.labels.map((item) => label(item.text, item, item.kind || "title")).join("");
      root.innerHTML = `<section class="ch01-limit-textbook-module" data-module="ch01_limit"><svg class="ch01-limit-textbook-board" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="行程开关控制电路" data-state-source="${escape(source)}"><title>行程开关控制电路</title><defs>${defs.join("")}</defs><rect class="ch01-limit-textbook-background" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><g class="ch01-limit-textbook-wire-layer">${wires.join("")}${active.join("")}${junctions}</g><g class="ch01-limit-textbook-component-layer">${bankMarkup}${heaterMarkup}${contactMarkup}${coilMarkup}${motorMarkup}${sources}</g><g class="ch01-limit-textbook-flow-layer">${flow.join("")}</g><g class="ch01-limit-textbook-label-layer">${title}</g></svg></section>`;
      if (focused) root.querySelector(`[data-${focusKind === "action" ? "action" : "protection"}-command="${focused}"]`)?.focus({ preventScroll: true });
      root.querySelectorAll("[data-component-id]").forEach((node) => node.classList.toggle("is-teaching-focus", teachingFocus.includes(node.dataset.componentId)));
    }

    return Object.freeze({
      render,
      resetInput() { clearOwners(); },
      unmount({ root }) { controller?.abort(); controller = null; clearOwners(); onAction = null; root?.replaceChildren(); rootNode = null; }
    });
  };
})(globalThis);
