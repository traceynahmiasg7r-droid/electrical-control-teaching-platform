# ch02_multi_station

原图15的优化交互模块。差异点是两处启动按钮并联、两处停止按钮串联，共同作用于同一 KM1 与电机；HL1/HL2 仅作为 Solver 结果的派生显示，符合当前 HL 尚未冻结为公共行为标准的限制。

模块只依赖同一提交中的 `_ch02_mixed_remote_shared/runtime.js`，未修改第二章已有四个成熟模块或公共平台文件。
