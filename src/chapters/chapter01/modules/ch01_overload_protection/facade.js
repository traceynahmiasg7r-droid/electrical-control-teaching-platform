(function installCh01OverloadProtectionFacade(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleFacades = platform.moduleFacades || {};
  platform.moduleFacades.createCh01OverloadProtectionFacade = () => platform.chapterRuntimes.createDirectStartFacade({
    moduleId: "ch01_overload_protection",
    routeId: "ch01-overload-protection",
    circuitData: platform.chapterCircuitData.ch01OverloadProtection,
    mode: "self_hold",
    copy: {
      title: "热继电器过载保护演示",
      initialTitle: "FR 过载保护原理",
      initialText: "电动机正常运行时，FR1 控制常闭触点保持闭合；发生过载后该触点断开，使 KM1 线圈失电、主触点释放并切断电动机电源。",
      powerTitle: "QF1 动作反馈",
      powerOn: "QF1 已合闸，FR1 正常时控制回路进入待启动状态。",
      powerOff: "QF1 已分闸，KM1 自锁解除，电动机停止。"
    }
  });
})(globalThis);
