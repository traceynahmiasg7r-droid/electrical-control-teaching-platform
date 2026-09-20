(function installMainControlVisualBinding(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.bindCh02MainControlVisualState = (data, snapshot, solver) => {
    if (!solver.converged) throw new Error("Cannot display an unconverged main-control state");
    const rawMain = new Set(solver.activeMainWireIds || []);
    const rawControl = new Set(solver.activeControlWireIds || []);
    const mainEdges = new Set(solver.extension?.activeMainEdgeIds || []);
    const controlEdges = new Set(solver.extension?.activeControlEdgeIds || []);
    const activeWires = data.wires.filter((wire) => wire.electricalWireIds.some((id) => rawMain.has(id) || rawControl.has(id))).map((wire) => wire.wireId);
    const buttonPressed = {
      sb1: snapshot.operation.controls.startPrimary === "pressed",
      sb2: snapshot.operation.controls.stopPrimary === "pressed",
      sb3: snapshot.operation.controls.startSecondary === "pressed",
      sb4: snapshot.operation.controls.stopSecondary === "pressed"
    };
    const components = Object.fromEntries(data.components.map((component) => {
      const edgeIds = component.electricalEdgeIds || [];
      const closed = edgeIds.map((id) => Boolean(solver.edgeStates?.[id]?.conductive));
      const energized = component.componentId === "km1_coil" ? Boolean(solver.stableDeviceStates.KM1)
        : component.componentId === "km2_coil" ? Boolean(solver.stableDeviceStates.KM2)
          : component.componentId === "motor1" ? solver.motorStates.M1?.running === true
            : component.componentId === "motor2" ? solver.motorStates.M2?.running === true : false;
      return [component.componentId, { edgeIds, closed, energized, pressed: Boolean(buttonPressed[component.componentId]) }];
    }));
    return {
      components,
      visualActiveWireIds: Object.freeze(activeWires),
      activeMainWireIds: [...rawMain],
      activeControlWireIds: [...rawControl],
      activeMainEdgeIds: [...mainEdges],
      activeControlEdgeIds: [...controlEdges],
      motorStates: solver.motorStates,
      protectionTripped: { fr1: solver.protectionStates.FR1?.tripped === true, fr2: solver.protectionStates.FR2?.tripped === true }
    };
  };
})(globalThis);
