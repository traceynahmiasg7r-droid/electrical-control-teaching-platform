(function installCh01OverloadProtectionCircuitData(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.chapterCircuitData = platform.chapterCircuitData || {};
  const source = platform.chapterCircuitData.ch01DirectStartProtection;
  if (!source) throw new Error("ch01_overload_protection requires ch01_direct_start_protection circuit data");

  const oldPrefix = "ch01_direct_start_protection__";
  const newPrefix = "ch01_overload_protection__";
  const remapId = (value) => typeof value === "string" && value.startsWith(oldPrefix)
    ? `${newPrefix}${value.slice(oldPrefix.length)}`
    : value;
  const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(
    Object.fromEntries(Object.entries(item).map(([key, value]) => [
      key,
      key === "routePoints"
        ? Object.freeze(value.map((point) => Object.freeze({ ...point })))
        : remapId(value)
    ]))
  )));

  platform.chapterCircuitData.ch01OverloadProtection = Object.freeze({
    schemaVersion: "1.0",
    moduleId: "ch01_overload_protection",
    mode: "self_hold",
    geometryLockId: "ch01_overload_protection_geometry_v1_locked",
    referencePages: Object.freeze([113]),
    ports: freezeItems(source.ports),
    junctions: freezeItems(source.junctions),
    wires: freezeItems(source.wires),
    components: freezeItems(source.components),
    deviceEdges: freezeItems(source.deviceEdges),
    labels: Object.freeze({ title: "过载保护", start: "SB1 启动", stop: "SB2 停止" })
  });
})(globalThis);
