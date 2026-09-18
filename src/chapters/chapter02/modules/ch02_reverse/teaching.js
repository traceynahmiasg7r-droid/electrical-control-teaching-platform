(function installReverseTeaching(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const scenarios = Object.freeze([
    ["forward-start", "正转启动"], ["forward-stop", "正转停止"],
    ["reverse-start", "反转启动"], ["reverse-stop", "反转停止"],
    ["forward-reverse", "正转 → 反转"], ["reverse-forward", "反转 → 正转"],
    ["overload", "FR1 过载保护"], ["reset", "FR1 复位"]
  ].map(([id, title]) => Object.freeze({ id, title })));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // Detached operation sequences, evaluated by the existing electrical Solver.
  // Observation steps share a solved state; they do NOT invent coil/contact delays.
  function buildScenario(id, evaluate) {
    if (!scenarios.some((s) => s.id === id)) throw new Error("Unknown reverse scenario: " + id);
    let raw = evaluate({ qf1: "open", sb1: "released", sb2: "released", sb3: "released", fr1: "normal" }, { ki1: false, ki2: false }).final;
    const steps = [];
    function change(patch) {
      const result = evaluate({ ...raw.operationState, ...patch }, raw.solver.stableControlState);
      raw = result.final;
      return result;
    }
    function add(title, text, focus, frame = raw, duration = 1700) {
      steps.push({ id: id + "-" + steps.length, title, text, duration,
        displayState: { raw: clone(frame), teachingFocus: focus, principleText: text,
          source: "Playback", electricalPhase: frame.solver.displayPhase || "settled" } });
    }
    const reverse = id.startsWith("reverse");
    const button = reverse ? "sb3" : "sb2", name = reverse ? "KI2" : "KI1";
    const own = reverse ? "ki2" : "ki1", other = reverse ? "ki1" : "ki2";
    const direction = reverse ? "反转" : "正转";
    const phase = reverse ? "U=L3、V=L2、W=L1；交换两相改变相序，因此电机反转。" : "U=L1、V=L2、W=L3，建立正相序，电机正转。";
    change({ qf1: "closed" });
    if (id.endsWith("-start")) {
      add("QF1 合闸", "主、控制回路具备供电条件；启动触点尚未闭合，两只接触器均释放，电机停止。", ["qf1"]);
      change({ [button]: "pressed" });
      add("按下 " + button.toUpperCase(), button.toUpperCase() + " 的 NO 闭合、联动 NC 同时断开。经停止、保护及对向接触器 NC，当前线圈通路成立。", [button, button + "_nc"]);
      add(name + " 线圈得电", name + " 线圈已由真实控制回路得电。以下几步观察同一个已求解状态，不虚构线圈与触点间的额外延时。", [own + "_coil"]);
      add(name + " 触点联动", "主触点和自锁 NO 闭合，同时本接触器互锁 NC 断开，阻止对向接触器同时吸合。", [own + "_main", own + "_self", own + "_interlock"]);
      add("主回路相序", phase, [own + "_main", "fr1_main"], raw, 2000);
      add("M " + direction, "电机方向由主回路三相可达关系判定。" + phase, ["motor"]);
      change({ [button]: "released" });
      add(button.toUpperCase() + " 松开", "启动 NO 断开，联动 NC 恢复；" + name + " 自锁 NO 提供并联保持路径，线圈不会因按钮松开而失电。", [button, own + "_self"]);
      add(name + " 自锁维持", "红色控制路径现经自锁支路继续供给线圈；按钮只发出启动命令，不必一直按住。", [own + "_self", own + "_coil"], raw, 2000);
    } else if (id.endsWith("-stop")) {
      change({ [button]: "pressed" }); change({ [button]: "released" });
      add(direction + " 自锁运行", name + " 通过自锁维持，主触点供给三相电机。", [own + "_self", "motor"]);
      change({ sb1: "pressed" });
      add("SB1 切断控制回路", "SB1 常闭触点打开，使接触器线圈失电。SB1 控制的是接触器控制电流，不直接承载电机三相主电流。", ["sb1"]);
      add(name + " 释放", "线圈失电使主触点与自锁 NO 释放、互锁 NC 恢复；主回路断开，电机停止。", [own + "_coil", own + "_main", "motor"]);
      change({ sb1: "released" });
      add("松开停止按钮", "控制回路恢复允许启动，但自锁已经解除。未重新按启动按钮，电机不会自动重启。", ["sb1", own + "_self"]);
    } else if (id === "forward-reverse" || id === "reverse-forward") {
      change({ [button]: "pressed" }); change({ [button]: "released" });
      add(direction + " 稳定运行", name + " 自锁维持；先观察原方向，再观察双重联锁的换向顺序。", [own + "_self", "motor"]);
      const nextButton = reverse ? "sb2" : "sb3", nextName = reverse ? "KI1" : "KI2";
      const result = change({ [nextButton]: "pressed" });
      if (!result.releaseFrame) throw new Error("Reversal requires a Solver-proven both-off iteration");
      const off = result.releaseFrame;
      add("按下 " + nextButton.toUpperCase() + "：NC 先切断旧方向", "联动 NO/NC 共用一次按钮状态更新。NC 切断原线圈串联路径；对向接触器 NC 在旧方向释放前阻止新方向建立。", [nextButton, nextButton + "_nc"], off, 2000);
      add(name + " 线圈失电", "这是 Solver 换向迭代中的双释放观察帧：旧线圈已失电，新接触器尚未吸合，不是一个可长期维持的稳态。", [own + "_coil"], off);
      add(name + " 主触点释放", "原方向主触点断开，三相主回路退出；本帧电机显示停止，随后才建立新方向。", [own + "_main", "motor"], off);
      add(name + " 自锁打开", "原方向保持支路解除，不能绕过按钮联动 NC 继续自锁。", [own + "_self"], off);
      add(name + " 互锁 NC 恢复", "旧接触器释放后其 NC 恢复，配合新启动 NO，下一次 Solver 迭代才允许新线圈得电。", [own + "_interlock"], off, 2000);
      add(nextName + " 得电", "图搜索确认新的完整控制通路，新线圈得电。旧方向先退出，新方向再建立；全过程没有双接触器同时吸合。", [other + "_coil"]);
      add(nextName + " 触点联动", "新主触点、自锁 NO 闭合；新接触器互锁 NC 打开，继续阻止旧方向吸合。", [other + "_main", other + "_self", other + "_interlock"]);
      add("换相与新方向", reverse ? "由反向连接切回 U=L1、V=L2、W=L3，恢复正相序，M 正转。" : "两相交换为 U=L3、V=L2、W=L1，相序改变，M 反转。不是仅凭接触器名称指定转向。", [other + "_main", "motor"], raw, 2000);
      change({ [nextButton]: "released" });
      add("新方向自锁", "松开启动按钮，新接触器通过自己的自锁 NO 保持运行。", [other + "_self"]);
    } else {
      change({ sb2: "pressed" }); change({ sb2: "released" });
      add("电机运行", "KI1 自锁运行；FR1 主回路热元件监测负载，其 NC 位于控制返回路径。", ["motor", "fr1_main"]);
      change({ fr1: "overload" });
      add("FR1 过载：NC 打开", "FR1 保护动作打开控制返回线上的 NC，线圈失电。FR1 主回路热元件不是用来直接断开三相电流的触点。", ["fr1_nc", "fr1_main"], raw, 2000);
      add("接触器释放，电机停止", "控制回路断开使 KI1 释放，主触点切断电机电源，自锁同时解除。未复位前不能启动。", ["ki1_coil", "ki1_main", "motor"]);
      if (id === "reset") {
        change({ fr1: "normal" });
        add("FR1 复位", "启动按钮已松开，复位只恢复 FR1 NC 和再次启动条件。自锁触点仍开，KI1/KI2 均释放，电机不自动重启。", ["fr1_nc", "ki1_self", "motor"], raw, 2000);
        add("等待新启动命令", "必须重新按 SB2 或 SB3 才能建立线圈通路。保护复位不等于启动。", ["sb2", "sb3"]);
      }
    }
    return steps;
  }

  function liveFeedback(snapshot, action) {
    const op = snapshot.operation, motor = snapshot.motor.state;
    if (motor === "fault") return { title: "电气异常", text: "相序未知或非法，电机不显示正常运行。请停止并检查电气状态。", tone: "error" };
    if (action === "PROTECTION_RESET") return { title: "FR1 复位", text: op.protections.overload === "overload"
      ? "请先松开启动按钮再复位；保护仍保持动作，禁止带启动命令复位。"
      : "FR1 NC 已恢复，允许再次启动；自锁已解除，复位不会自动重启，需重新按 SB2 或 SB3。", tone: "info" };
    if (op.protections.overload === "overload") return { title: "FR1 过载保护", text: "FR1 NC 打开切断控制返回通路，线圈失电、主触点释放，电机停止。未复位禁止启动；先松开按钮再复位。", tone: "error" };
    if (op.power !== "closed") return { title: "QF1 分闸", text: "QF1 断开，主、控制回路均未建立供电通路。合闸后还需按启动按钮，接触器不会自动吸合。", tone: "info" };
    if (motor === "forward" || motor === "reverse") {
      const f = motor === "forward", own = f ? "KI1" : "KI2", other = f ? "KI2" : "KI1", button = f ? "SB2" : "SB3";
      return { title: (f ? "正转" : "反转") + " · 自锁与双重联锁", text: button + " NO 闭合发出启动命令，联动 NC 先切断对向线圈。若原方向正在运行，它先释放，待 " + other + " 互锁 NC 恢复，" + own + " 才能得电。主触点和自锁 NO 随之闭合，互锁 NC 打开；按钮松开后由自锁保持。" + (f ? "U=L1、V=L2、W=L3，电机正转。" : "U=L3、V=L2、W=L1，两相交换改变相序，电机反转。"), tone: "info" };
    }
    return { title: action === "STOP_PRESS" ? "SB1 停止" : "合闸待命", text: action === "STOP_PRESS"
      ? "SB1 切断接触器控制回路，线圈失电、主触点与自锁释放，电机停止。SB1 不直接承载三相主电流；松开后需重新启动。"
      : "QF1 已合闸，两接触器释放。按 SB2 正转或 SB3 反转；按钮联动 NC 与接触器互锁 NC 共同防止双接触器吸合。", tone: "info" };
  }
  platform.reverseTeaching = Object.freeze({ scenarios, buildScenario, liveFeedback });
})(globalThis);
