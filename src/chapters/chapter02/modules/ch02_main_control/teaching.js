(function installMainControlTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const scenarios = Object.freeze([
    ["overview", "主电路与控制电路"], ["motor1-start", "1M 启动：控制到主回路"],
    ["motor1-stop", "1M 停止"], ["motor2-start", "2M 启动：控制到主回路"],
    ["motor2-stop", "2M 停止"], ["fr1-overload", "FR1 保护"], ["fr2-overload", "FR2 保护"]
  ].map(([id, title]) => Object.freeze({ id, title })));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function buildScenario(id, evaluate) {
    const meta = scenarios.find((item) => item.id === id); if (!meta) throw new Error("Unknown main-control scenario " + id);
    let raw = evaluate({ qf1: "open", sb1: "released", sb2: "released", sb3: "released", sb4: "released", fr1: "normal", fr2: "normal" }, { km1: false, km2: false }).final;
    const steps = [];
    function change(patch) { const result = evaluate({ ...raw.operationState, ...patch }, raw.stableControlState); raw = result.final; return result; }
    function add(title, text, focus, frame = raw, duration = 1700) {
      steps.push({ id: id + "-" + steps.length, title, text, duration, displayState: { raw: clone(frame), teachingFocus: focus, principleText: text } });
    }
    if (id === "overview") {
      add("教材结构", "左侧三相主电路经过 QF1、FU1、KM1/KM2 主触点、FR1/FR2 后分别到达 1M/2M；右侧控制电路只控制接触器线圈。", ["km1_main", "km2_main", "km1_coil", "km2_coil"]);
      change({ qf1: "closed" }); add("QF1 合闸", "QF1 只建立三相电源条件；接触器线圈尚未得电，主触点保持断开，两个电机停止。", ["qf1"]);
      add("控制与主回路分工", "SB 按钮和 FR 常闭触点位于控制回路，线圈是控制对象；KM 主触点位于主回路，负责把三相电源接到电机。", ["sb1", "sb2", "fr1_nc", "km1_coil", "km1_main"]);
      return steps;
    }
    const second = id.includes("motor2") || id.includes("fr2"), motor = second ? "motor2" : "motor1", coil = second ? "km2" : "km1", start = second ? "sb3" : "sb1", stop = second ? "sb4" : "sb2", fr = second ? "fr2" : "fr1", name = second ? "2M" : "1M", km = second ? "KM2" : "KM1";
    change({ qf1: "closed" }); add("QF1 合闸", "主回路和控制回路获得供电条件，但启动按钮尚未建立线圈通路。", ["qf1"]);
    if (id.endsWith("start")) {
      change({ [start]: "pressed" }); add(start.toUpperCase() + " 闭合", start.toUpperCase() + " 常开触点闭合，控制电流经过停止按钮、启动按钮和 " + fr.toUpperCase() + " 常闭触点到达 " + km.toUpperCase() + " 线圈。", [start, fr + "_nc", coil + "_coil"]);
      add(km + " 线圈得电", km + " 线圈属于控制电路，吸合后同时带动其主触点和自锁辅助触点。", [coil + "_coil"]);
      add(km + " 主触点闭合", km + " 主触点属于主电路，闭合后三相电源通过对应热继电器主回路接入 " + name + "。", [coil + "_main", motor, "fr" + (second ? "2" : "1") + "_main"]);
      add(name + " 运行", name + " 运行是主电路三相都真实可达的结果；控制按钮本身不直接承载主电流。", [motor], raw, 2000);
      change({ [start]: "released" }); add("松开启动按钮", "启动按钮恢复断开，但 " + km + " 自锁辅助触点闭合，线圈控制回路继续保持，电机不会因松手停止。", [start, coil + "_self"]);
    } else if (id.endsWith("stop")) {
      change({ [start]: "pressed" }); change({ [start]: "released" }); add(name + " 自锁运行", km + " 通过自锁辅助触点保持得电，主触点继续给电机供电。", [coil + "_self", motor]);
      change({ [stop]: "pressed" }); add(stop.toUpperCase() + " 切断控制回路", stop.toUpperCase() + " 常闭触点打开，" + km + " 线圈失电；它不是直接切断电机三相主电流。", [stop, coil + "_coil"]);
      add(km + " 释放", "线圈释放使主触点和自锁辅助触点同时打开，主回路断开，" + name + " 停止。", [coil + "_main", coil + "_self", motor]);
      change({ [stop]: "released" }); add("停止后待命", "停止按钮松开只恢复控制回路，接触器不会自动重新吸合；必须重新按启动按钮。", [stop]);
    } else {
      change({ [start]: "pressed" }); change({ [start]: "released" }); add(name + " 正常运行", km + " 线圈与主触点均已工作，热继电器正在监视对应主回路。", [motor, fr + "_main"]);
      change({ [fr]: "overload" }); add(fr.toUpperCase() + " 过载", fr.toUpperCase() + " 常闭控制触点打开，" + km + " 线圈失电，主触点释放，" + name + " 停止。", [fr + "_nc", coil + "_coil", motor], raw, 2000);
      add("保护后的控制关系", "FR 通过控制回路间接释放接触器；复位只恢复再次启动条件，不会自动重新启动电机。", [fr + "_main", fr + "_nc"]);
    }
    return steps;
  }
  platform.mainControlTeaching = Object.freeze({ scenarios, buildScenario });
})(globalThis);
