# ch01_forward_reverse

第一章第61页“正反转电路”的独立交互模块，不复用第二章正反转的 Geometry、Solver、按钮编号或保护元件。

## 电气基准

- 控制电源：A—N，220V。
- SB1：正转启动常开按钮。
- SB2：反转启动常开按钮。
- SB3：两条控制支路共用的常闭停止按钮。
- KM1：自锁后按 ABC 相序接通电动机。
- KM2：自锁后交换 A、C 两相，按 CBA 相序接通电动机。
- KM1、KM2 的常闭辅助触点互相串入对方线圈支路，形成接触器电气互锁。
- 运行中直接按相反方向按钮不会换向，必须先按 SB3 停止。
- 本模块不包含 QF、FU、FR；过载动作在独立的“过载保护”模块中教学。
- 电机图形不旋转，动态效果只用于表示实际导通的主回路和控制回路。

## 验收

```bash
node src/chapters/chapter01/modules/ch01_forward_reverse/tests/module.tests.js
```
