(function installJogVisualBinding(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.bindCh02JogVisualState = (data, snapshot, solver) => {
    if (solver?.converged === false) throw new Error("Cannot display an unconverged jog state");
    const rawMain = new Set(solver?.activeMainWireIds || []);
    const rawControl = new Set(solver?.activeControlWireIds || []);
    const activeMainEdges = new Set(solver?.extension?.activeMainEdgeIds || solver?.activeMainEdgeIds || []);
    const activeControlEdges = new Set(solver?.extension?.activeControlEdgeIds || solver?.activeControlEdgeIds || []);
    const operation = snapshot?.operation || {};
    const controls = operation.controls || {};
    const sbPressed = controls.jog === "pressed";
    const overload = operation.protections?.overload === "overload";
    const edgeStates = solver?.edgeStates || {};
    const components = Object.fromEntries(data.components.map((component) => {
      const edgeIds = component.electricalEdgeIds || [];
      const closed = edgeIds.map((edgeId) => Boolean(edgeStates[edgeId]?.conductive));
      const energized = component.componentId === "coil" ? Boolean(solver?.stableDeviceStates?.KM)
        : component.componentId === "motor" ? Boolean(solver?.motorStates?.M?.running || solver?.motorRunning)
          : false;
      return [component.componentId, { edgeIds, closed, energized, pressed: component.componentId === "sb" && sbPressed }];
    }));
    const visualActiveWireIds = data.wires.filter((wire) => wire.electricalWireIds.some((id) => rawMain.has(id) || rawControl.has(id))).map((wire) => wire.wireId);
    return {
      components,
      visualActiveWireIds: Object.freeze(visualActiveWireIds),
      activeMainWireIds: [...rawMain],
      activeControlWireIds: [...rawControl],
      activeMainEdgeIds: [...activeMainEdges],
      activeControlEdgeIds: [...activeControlEdges],
      motorStates: solver?.motorStates || { M: { running: Boolean(solver?.motorRunning), direction: solver?.motorRunning ? "forward" : "none" } },
      protectionTripped: { fr: overload }
    };
  };
})(globalThis);
