# ch02_mixed_control

第二章新增实验模块：点动与长动混合控制。

## 教学范围

- 方式一：SA 转换开关选择点动或长动；
- 方式二：SB1 长动、SB3 点动；
- 方式三：继电器 K 负责长动保持，SB3 切换为点动路径。

三种方式共用 QF1、FU、KM1、FR1、M 的主回路。按钮只产生 Action，KM1/K/M 均由模块 Solver 推导；Current Flow 使用原 `wire.routePoints`。

## 文件职责

- `module.meta.json`：可扫描元数据；
- `circuit.data.js`：Geometry、Ports、Wires、Device Edges 与三种控制回路；
- `solver.js`：operationState、保持记忆、稳定状态与统一 Solver Result；
- `renderer.js` / `styles.css`：模块私有 SVG 渲染与命名空间样式；
- `facade.js` / `module.js`：Module Contract 1.1 / facade-v1 接入；
- `tests/module.tests.js`：Contract、Geometry、Solver 与生命周期验收入口。
- `assets/reference/`：用户提供的三张原图只读副本，分别对应方式一、方式二、方式三。

## 接入边界

本模块不修改 `index.html`、`src/platform/**`、`src/registry/**`、`src/schemas/**`、公共组件或第二章既有四个成熟模块。正式接入时由平台维护者在集成层加载本目录脚本和样式，并调用 `createCh02MixedControl()` 注册。
