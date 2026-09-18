(function installReverseVisualBinding(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  // Electrical bindings are separate from the approved, frozen Stage 1 drawing.
  const seriesContacts = Object.freeze({ sb3_nc: "edge_sb3_nc", sb2_nc: "edge_sb2_nc" });
  // Stage3 Visual Membership Clarification: only the three approved
  // same-node QF/FU subdivisions. Never insert these IDs into Raw Solver arrays.
  function visualMembership(data, solver) {
    const main = new Set(solver.activeMainWireIds || []);
    const control = new Set(solver.activeControlWireIds || []);
    const edges = new Set(solver.extension?.activeMainEdgeIds || []);
    const phaseMap = solver.extension?.activeMainWirePhaseMap || {};
    const derivedVisualActiveWireIds = ["l1", "l2", "l3"].filter((phase) =>
      ["qf1_edge_" + phase, "fu1_edge_" + phase].every((id) =>
        edges.has(id) && solver.edgeStates[id]?.conductive === true)
      && [...main].some((id) => phaseMap[id] === phase)
      && solver.motorStates.M.running
    ).map((phase) => "qf_fu_" + phase);
    const derived = new Set(derivedVisualActiveWireIds);
    return {
      derivedVisualActiveWireIds: Object.freeze(derivedVisualActiveWireIds),
      visualActiveWireIds: Object.freeze(data.wires.filter((wire) => derived.has(wire.wireId)
        || wire.electricalWireIds.some((id) => main.has(id) || control.has(id))).map((wire) => wire.wireId))
    };
  }
  platform.bindCh02ReverseVisualState = (data, snapshot, solver) => {
    if (!solver.converged) throw new Error("Cannot display an unconverged electrical state");
    const pressed = { sb1: snapshot.operation.controls.stop === "pressed", sb2: snapshot.operation.controls.forward === "pressed", sb3: snapshot.operation.controls.reverse === "pressed" };
    const components = Object.fromEntries(data.components.map((component) => {
      const edgeIds = seriesContacts[component.componentId] ? [seriesContacts[component.componentId]] : component.electricalEdgeIds;
      const closed = edgeIds.map((id) => {
        if (!solver.edgeStates[id]) throw new Error("Missing Solver edge: " + id);
        return Boolean(solver.edgeStates[id].conductive);
      });
      const energized = component.componentId === "ki1_coil" ? solver.stableDeviceStates.KM1
        : component.componentId === "ki2_coil" ? solver.stableDeviceStates.KM2 : false;
      return [component.componentId, { edgeIds, closed, energized: Boolean(energized), pressed: Boolean(pressed[component.componentId]) }];
    }));
    return {
      ...visualMembership(data, solver),
      components,
      motor: solver.motorStates.M.state,
      protectionTripped: solver.protectionStates.FR1.tripped,
      activeMainWireIds: [...(solver.activeMainWireIds || [])],
      activeControlWireIds: [...(solver.activeControlWireIds || [])],
      activeMainEdgeIds: [...(solver.extension?.activeMainEdgeIds || [])],
      activeControlEdgeIds: [...(solver.extension?.activeControlEdgeIds || [])],
      activeMainWirePhaseMap: JSON.parse(JSON.stringify(solver.extension?.activeMainWirePhaseMap || {}))
    };
  };
})(globalThis);
