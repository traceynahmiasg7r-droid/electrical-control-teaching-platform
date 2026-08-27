# ch02_multisite_control

第二章新增实验模块：多地点远程控制。

## 电气关系

- 1SB1 与 2SB1 启动按钮并联，任一地点均可启动；
- 1SB2 与 2SB2 停止按钮串联，任一地点均可停止；
- KM1 辅助 NO 建立自锁，KM1 主触点控制三相电动机 M；
- FR1 控制 NC 动作后释放 KM1，复位不会自动重启；
- HL1 / HL2 只作为本模块 `extension.indicators` 的原型显示，由 KM1 信号支路派生，不升级公共 HL 标准。

## 文件职责

- `module.meta.json`：可扫描元数据；
- `circuit.data.js`：Geometry、Ports、Wires、Device Edges；
- `solver.js`：operationState、自锁与统一 Solver Result；
- `renderer.js` / `styles.css`：模块私有 SVG 渲染与命名空间样式；
- `facade.js` / `module.js`：Module Contract 1.1 / facade-v1 接入；
- `tests/module.tests.js`：Contract、Geometry、Solver 与生命周期验收入口。
- `assets/reference/`：用户提供的多地点远程控制原图只读副本。

## 接入边界

本模块不修改 `index.html`、`src/platform/**`、`src/registry/**`、`src/schemas/**`、公共组件或第二章既有四个成熟模块。正式接入时由平台维护者在集成层加载本目录脚本和样式，并调用 `createCh02MultisiteControl()` 注册。
