(function installContinuousVisualBinding(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.bindCh02ContinuousVisualState = (data, snapshot, solver) => {
    if (solver?.converged === false) throw new Error("Cannot display an unconverged continuous state");
    const main = new Set(solver?.activeMainWireIds || []), control = new Set(solver?.activeControlWireIds || []);
    const mainEdges = new Set(solver?.extension?.activeMainEdgeIds || solver?.activeMainEdgeIds || []), controlEdges = new Set(solver?.extension?.activeControlEdgeIds || solver?.activeControlEdgeIds || []);
    const operation = snapshot?.operation || {}, controls = operation.controls || {}, overload = operation.protections?.overload === "overload";
    const edges = solver?.edgeStates || {};
    const components = Object.fromEntries(data.components.map((component) => {
      const ids = component.electricalEdgeIds || [], closed = ids.map((id) => Boolean(edges[id]?.conductive));
      const energized = component.componentId === "coil" || component.componentId === "km1_main" || component.componentId === "km1_self" ? Boolean(solver?.stableDeviceStates?.KM1) : component.componentId === "motor" ? Boolean(solver?.motorStates?.M?.running || solver?.motorRunning) : false;
      const pressed = (component.componentId === "sb1" && controls.start === "pressed") || (component.componentId === "sb2" && controls.stop === "pressed");
      return [component.componentId, { edgeIds: ids, closed, energized, pressed }];
    }));
    const visualActiveWireIds = data.wires.filter((wire) => wire.electricalWireIds.some((id) => main.has(id) || control.has(id))).map((wire) => wire.wireId);
    return { components, visualActiveWireIds, activeMainWireIds: [...main], activeControlWireIds: [...control], activeMainEdgeIds: [...mainEdges], activeControlEdgeIds: [...controlEdges], motorStates: solver?.motorStates || { M: { running: Boolean(solver?.motorRunning), direction: solver?.motorRunning ? "forward" : "none" } }, protectionTripped: { fr1: overload }, selfHoldConductive: Boolean(solver?.extension?.selfHoldConductive) };
  };
})(globalThis);
