(function installMachineToolV2Teaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const holdHint = "可先聚焦升降按钮并按住空格键，再用鼠标点击“模拟松开到位”；松开空格键即释放按钮。";
  const scenes = [
    { id: "spindle", title: "场景 1：主轴单向旋转", description: "SB2 启动、KM1 自锁，SB1 停止；FR1 保护主轴。合闸后若 SQ3 未夹紧，先模拟夹紧到位。" },
    { id: "up", title: "场景 2：摇臂上升", description: `按住 SB3：先自动松开，SQ2 到位后 KM2 驱动上升；松手停止升降，KT 断电延时后自动夹紧。${holdHint}` },
    { id: "down", title: "场景 3：摇臂下降", description: `按住 SB4：先自动松开，SQ2 到位后 KM3 驱动下降；下限位 SQ1-2 切断下降请求。${holdHint}` },
    { id: "loosen", title: "场景 4：主轴箱松开", description: "按住 SB5 使 KM4 驱动液压泵松开；其联动 NC 同时切换 YV 支路。按钮松手复位。" },
    { id: "clamp", title: "场景 5：主轴箱夹紧", description: "SB6 手动夹紧；SQ3 未到位时存在自动夹紧通路。KM4/KM5 由常闭辅助触点互锁。" },
    { id: "auxiliary", title: "场景 6：辅助控制", description: "SA1 控制照明，SA2 控制冷却泵；SQ4 切换 HL1/HL2，KM1 辅助触点控制 HL3。" }
  ];
  const action = (command, payload = {}) => ({ command, payload });
  const release = (command) => action("release", { command });
  const step = (title, text, actions = [], focus = []) => ({ title, text, actions, focus });
  const ready = [action("powerClose"), action("clampLimit")];
  const scripts = {
    spindle: [
      step("教材初始状态", "QF 分闸，所有线圈失电；SQ3 常闭触点按教材初始位置绘制。"),
      step("合闸后的自动夹紧", "SQ3 尚未夹紧，常闭支路使 KM5 与 YV 得电。先模拟夹紧到位，不能隐藏这条真实通路。", [action("powerClose")], ["km5_coil", "sq3", "yv"]),
      step("夹紧到位", "SQ3 动作，自动夹紧支路断开，KM5 与液压泵停止。", [action("clampLimit")], ["sq3", "m3"]),
      step("按下启动 SB2", "SB2 常开触点闭合，KM1 线圈得电，三相主触点闭合，主轴 M1 运行。", [action("spindleStart")], ["sb2", "km1_coil", "m1"]),
      step("松开 SB2，KM1 自锁", "启动按钮恢复断开；KM1 自锁触点维持线圈通路，主轴继续运行。", [release("spindleStart")], ["km1_self", "km1_coil", "m1"]),
      step("按下停止 SB1", "SB1 常闭触点断开，KM1 释放；主触点和自锁触点同步恢复，M1 停止。", [action("spindleStop")], ["sb1", "km1_main", "m1"]),
      step("松开停止按钮", "SB1 恢复闭合，自锁触点已经断开，主轴不会自动重启。", [release("spindleStop")], ["sb1", "km1_self"])
    ],
    up: [
      step("准备升降", "合闸并模拟夹紧到位，建立可观察的初始机械状态。", ready, ["sq3"]),
      step("按住上升 SB3", "SB3 联动触点切换，KT 通电立即动作，KM4 先驱动液压泵自动松开；SQ2 未到位，M2 尚未上升。", [action("rockerUp")], ["sb3_no", "sb3_nc", "kt_coil", "km4_coil"]),
      step("SQ2 松开到位", "仍按住 SB3，SQ2 联动触点切换：KM4 停止，KM2 得电；KM3 常闭互锁保障上升方向。", [action("looseLimit")], ["sq2_no", "sq2_nc", "km2_coil", "m2"]),
      step("松开 SB3", "升降请求消失，KM2 与 M2 立即停止；KT 线圈失电，延时触点暂时保持。", [release("rockerUp")], ["sb3_no", "kt_coil", "kt_delay_nc"]),
      step("KT 断电延时结束", "教学模拟 1.5 秒后，KT 延时触点恢复，SQ3 尚未夹紧时自动夹紧。教材没有标注具体秒数。", [action("timerComplete")], ["kt_delay_nc", "km5_coil", "m3"]),
      step("SQ3 夹紧到位", "SQ3 切断自动夹紧通路，液压泵停止，本轮升降完成。", [action("clampLimit")], ["sq3", "m3"])
    ],
    down: [
      step("准备下降", "合闸并模拟夹紧到位。", ready, ["sq3"]),
      step("按住下降 SB4", "SB4 联动触点切换，KT 得电，液压泵先松开；SQ2 未到位时下降电机保持停止。", [action("rockerDown")], ["sb4_no", "sb4_nc", "kt_coil", "km4_coil"]),
      step("SQ2 松开到位", "保持 SB4 按下，SQ2 到位后 KM3 得电，M2 以下降相序运行，KM2 被互锁。", [action("looseLimit")], ["sq2_no", "km3_coil", "m2"]),
      step("触发下降限位", "SQ1-2 常闭触点断开，下降请求被切断；KM3 释放，KT 进入断电延时。", [action("lowerLimit")], ["sq1_down", "km3_coil", "kt_coil"]),
      step("松手并完成延时", "松开 SB4。教学模拟延时结束后，未夹紧的机械状态允许自动夹紧。", [release("rockerDown"), action("timerComplete")], ["kt_delay_nc", "km5_coil"]),
      step("夹紧并复位行程", "夹紧到位切断泵回路；行程开关复位不等同于重新按下启动按钮。", [action("clampLimit"), action("lowerLimit", { value: false })], ["sq3", "sq1_down"])
    ],
    loosen: [
      step("准备手动松开", "合闸，模拟夹紧到位以结束初始自动夹紧。", ready, ["sq3"]),
      step("按住 SB5", "SB5 常开触点建立手动松开通路，KM4 与液压泵工作；SB5 常闭触点同步断开。", [action("loosen")], ["sb5_no", "sb5_nc", "km4_coil", "m3"]),
      step("观察松开位置", "模拟 SQ2 松开到位。手动 SB5 路径与自动松开路径分别由 Solver 判断，不能用场景直接指定停机。", [action("looseLimit")], ["sq2_no", "sq2_nc", "m3"]),
      step("松开 SB5，恢复自动夹紧", "SQ2 已模拟松开到位，因此 SQ3 尚未夹紧。松开 SB5 后，手动松开请求解除，KM5 与 YV 经真实自动通路得电，液压泵开始夹紧。", [release("loosen")], ["sb5_no", "sb5_nc", "sq3", "km5_coil", "yv", "m3"]),
      step("完成夹紧", "模拟 SQ3 夹紧到位，自动夹紧通路断开，KM5、YV 和液压泵停止。", [action("clampLimit")], ["sq3", "km5_coil", "yv", "m3"])
    ],
    clamp: [
      step("观察自动夹紧", "QF 合闸而 SQ3 未到位，KM5 经自动通路得电；这不是软件虚构的启动命令。", [action("powerClose")], ["sq3", "km5_coil", "m3"]),
      step("自动夹紧到位", "模拟 SQ3 到位，自动路径打开，KM5 释放。", [action("clampLimit")], ["sq3", "m3"]),
      step("按住手动夹紧 SB6", "SB6 常开触点建立手动夹紧请求，KM4 常闭触点提供反向互锁；联动 NC 同时切换 YV 路径。", [action("clamp")], ["sb6_no", "sb6_nc", "km5_coil"]),
      step("松开 SB6", "手动请求解除。SQ3 已到位，自动通路仍断开，液压泵停止。", [release("clamp")], ["sb6_no", "m3"]),
      step("液压泵过载 FR2", "FR2 只保护 KM4/KM5 液压泵支路，不能把它错误当作整台机床总停机开关。", [action("fr2Trip")], ["fr2_nc", "km4_coil", "km5_coil"]),
      step("复位 FR2", "保护恢复。若 SQ3 未到位且自动通路成立，复位可能重新启动夹紧；当前已到位，因此保持停止。", [action("fr2Reset")], ["fr2_nc", "sq3"])
    ],
    auxiliary: [
      step("辅助回路准备", "合闸并完成夹紧，观察初始位置指示灯。", ready, ["hl1", "hl2"]),
      step("打开照明 SA1", "SA1 闭合，独立照明次级经 FU3、SA1 与 EL 形成回路。", [action("lighting")], ["sa1", "el"]),
      step("打开冷却泵 SA2", "三极 SA2 同步闭合，M4 获得三相电源。", [action("coolant")], ["sa2", "m4"]),
      step("切换位置 SQ4", "SQ4 两组机械联动触点切换，HL1 与 HL2 分别反映两种位置。", [action("indicator")], ["sq4_1", "sq4_2", "hl1", "hl2"]),
      step("主轴运行指示", "按下并松开 SB2，KM1 自锁；其指示辅助触点使 HL3 得电。", [action("spindleStart"), release("spindleStart")], ["km1_lamp", "hl3", "m1"]),
      step("全部分闸", "QF 分闸，线圈、电机和灯均失电；真实开关与机械位置按 Solver 状态保留。", [action("powerOpen")], ["qf", "m4", "el"])
    ]
  };
  const actionLabels = Object.freeze({ spindleStart: "启动主轴 SB2", spindleStop: "停止主轴 SB1", rockerUp: "按住上升 SB3", rockerDown: "按住下降 SB4", loosen: "按住松开 SB5", clamp: "按住夹紧 SB6", powerClose: "QF 合闸", powerOpen: "QF 分闸", lighting: "切换照明 SA1", coolant: "切换冷却泵 SA2", indicator: "切换位置 SQ4", looseLimit: "模拟 SQ2 位置", clampLimit: "模拟 SQ3 位置", upperLimit: "模拟上限位 SQ1-1", lowerLimit: "模拟下限位 SQ1-2", fr1Trip: "FR1 主轴过载", fr1Reset: "FR1 复位", fr2Trip: "FR2 液压泵过载", fr2Reset: "FR2 复位", reset: "模块复位", timerComplete: "KT 断电延时结束" });
  function buildScenario(id, evaluate) {
    const sceneId = scenes.some((scene) => scene.id === id) ? id : "spindle";
    const componentForFocus = { sb3_no: "sb3", sb4_no: "sb4", sb5_no: "sb5", sb6_no: "sb6", sq2_no: "sq2_up", sq2_nc: "sq2_loose", sq3: "sq3_yv" };
    let actions = [];
    return scripts[sceneId].map((item, index) => {
      actions = [...actions, ...item.actions];
      return { id: `${sceneId}-${index}`, title: item.title, text: item.text, duration: 1700, displayState: { raw: evaluate({ scene: sceneId, actions }), teachingFocus: item.focus.map((id) => componentForFocus[id] || id) } };
    });
  }
  function liveFeedback(snapshot, lastAction, result) {
    const op = snapshot.operation, stable = result.stableDeviceStates || {}, motors = result.motorStates || {};
    const scene = scenes.find((item) => item.id === op.scene) || scenes[0];
    let text = scene.description, tone = "info";
    if (op.power !== "closed") { text = `QF 已分闸，真实电源断开；先合闸，再按当前场景操作。${op.limits.SQ3 ? "当前机械位置已夹紧到位。" : "当前 SQ3 未夹紧，合闸会自动夹紧，请模拟夹紧到位。"}`; tone = "warning"; }
    else if (result.extension?.diagnostics?.length) { text = result.extension.diagnostics.map((item) => typeof item === "string" ? item : item.message || item.code).join("；"); tone = "warning"; }
    else if (op.protections.primary === "overload" && op.scene === "spindle") { text = `FR1 已过载，KM1 线圈通路断开，主轴停止。${op.controls.sb2 === "pressed" ? "SB2 仍被按住，复位可能立即恢复启动；先松开按钮再复位。" : "SB2 已松开，复位不会自行重新启动；再次按 SB2 才启动。"}`; tone = "warning"; }
    else if (op.protections.secondary === "overload" && ["up", "down", "loosen", "clamp"].includes(op.scene)) { text = "FR2 已过载，KM4/KM5 液压泵回路断开；它不直接切断 KT、M2 或 YV。复位后若 SQ3 未夹紧，自动夹紧可能恢复。"; tone = "warning"; }
    else if (op.timer === "timing") text = "升降请求已解除，M2 停止；KT 正在断电延时保持。教学模拟 1.5 秒后触点恢复，未夹紧时进入自动夹紧。教材未标注具体延时数值。";
    else if (stable.KM5 && !op.limits.SQ3) text = "未夹紧：SQ3 常闭通路正在自动夹紧。KM5 与 M3 工作，请模拟夹紧到位；这条路径由 Solver 判定。";
    else if (stable.KT && !op.limits.SQ2) text = `升降按钮按住中，KT 通电立即动作；液压泵先自动松开。继续保持按钮并模拟 SQ2 松开到位，才能驱动摇臂。${holdHint}`;
    else if (motors.M2?.running) text = `摇臂正在${motors.M2.direction === "up" ? "上升" : "下降"}，对应接触器已吸合，另一方向被互锁。松开按钮或触发行程限位立即停止升降。`;
    else if (motors.M3?.running) text = `液压泵正在${motors.M3.direction === "loosen" ? "松开" : "夹紧"}；按钮 NO/NC 与相反方向互锁触点同步参与真实通路。`;
    else if (motors.M1?.running && op.scene === "spindle") text = op.controls.sb2 === "pressed" ? "SB2 按下，KM1 得电，主触点与自锁触点闭合，M1 运行。松开 SB2 可观察自锁。" : "SB2 已松开，KM1 通过自己的常开辅助触点自锁，M1 继续运行；按住 SB1 可停止。";
    else if (lastAction?.command === "fr2Reset") text = "FR2 已复位。是否重新夹紧由 SQ3、KT 和按钮通路决定；不能把自动夹紧回路解释为固定的防重启逻辑。";
    else if (lastAction?.message) text = lastAction.message;
    else if (lastAction?.command === "release") text = `已松开${actionLabels[lastAction.releasedCommand]?.replace("按住", "") || "操作按钮"}，机械联动 NO/NC 已复位。${scene.description}`;
    else if (actionLabels[lastAction?.command]) text = `${actionLabels[lastAction.command]}。${scene.description}`;
    return { title: scene.title, text, tone };
  }
  platform.machineToolV2Teaching = Object.freeze({ scenes, scenarios: scenes, scripts, actionLabels, buildScenario, liveFeedback });
})(globalThis);
