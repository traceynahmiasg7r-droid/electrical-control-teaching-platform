# ch01_forward_reverse

第一章第 61 页“正反转控制”实验模块。

本模块通过第一章专用 Module Contract / Facade 接入层复用第二章已经锁定并通过回归的正反转电路 Port。它不修改第二章 Geometry、ports、wires、deviceEdges、Solver、Current Flow 或成熟视觉，因此两章展示同一电气真源，同时保持独立的 `chapterId`、`moduleId`、`routeId` 和导航身份。

- 正转链：QF1 合闸 -> SB2 -> KM1 线圈 -> KM1 自锁与主触点 -> M 正转。
- 反转链：QF1 合闸 -> SB3 -> KM2 线圈 -> KM2 自锁与换相主触点 -> M 反转。
- 互锁：KM1、KM2 的常闭辅助触点阻止两个接触器同时吸合。
- 安全换向：运行中直接按相反方向按钮会被电气互锁阻止，需先按 SB1 停止。
- 保护：FR1 过载后控制回路断开；复位后不会自动重新启动。

运行验收：

```bash
node src/chapters/chapter01/modules/ch01_forward_reverse/tests/module.tests.js
```
