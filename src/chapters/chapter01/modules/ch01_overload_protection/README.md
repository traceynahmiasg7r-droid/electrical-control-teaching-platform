# ch01_overload_protection

第一章第 113 页“热继电器应用举例”对应的直接启动过载保护实验。

- 正常启动：QF1 合闸 -> SB1 瞬时启动 -> KM1 得电并自锁 -> M 连续运行。
- 过载动作：FR1 进入 `overload` -> 控制 NC 断开 -> KM1 线圈失电 -> 主触点断开 -> M 停止。
- 保护复位：FR1 回到 `normal`，但 KM1 保持释放，电动机不会自动重启。
- 主回路 FR1 热元件按项目 v2.0 规范作为静态导电路径参与拓扑，不伪造复杂热模型。
- FU 保持正常导通，不实现尚未冻结的熔断状态。

端口、导线、器件和器件边均使用 `ch01_overload_protection__*` 命名空间。模块复用第一章已验收的直接启动运行时，不修改公共平台层或既有成熟模块。

运行验收：

```bash
node src/chapters/chapter01/modules/ch01_overload_protection/tests/module.tests.js
```
