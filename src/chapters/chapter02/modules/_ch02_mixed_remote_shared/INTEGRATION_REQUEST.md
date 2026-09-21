# 平台维护者接入申请（不由章节开发者直接修改公共层）

四个模块代码、Geometry、Solver、Action、Teaching Feedback、Playback 与测试已经包含在本目录及相邻四个模块目录中。当前 `main` 尚无自动扫描机制，因此需要平台维护者在独立、小范围公共层 PR 中完成：

1. 在 `index.html` 的 Module Contract / Adapter 之后按顺序加载：共享 `runtime.js`、四个模块的 `circuit.data.js`、`facade.js`、`module.js`，并加载共享 `styles.css`。
2. 在 `initializePlatformRuntime()` 的 `registrations` 数组中追加四个无参 factory：
   - `createCh02MixedMode1()`
   - `createCh02MixedMode2()`
   - `createCh02MixedMode3()`
   - `createCh02MultiStation()`
3. 复跑第二章既有四模块 Solver 回归、模块切换生命周期与导航顺序检查。

本功能分支不直接执行以上公共层改动，以保持第二章成熟电路、Platform、Registry、Schema 与 `index.html` 的保护基线不变。
