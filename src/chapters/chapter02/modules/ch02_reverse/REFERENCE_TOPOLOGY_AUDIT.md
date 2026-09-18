# ch02_reverse 教材拓扑审计（Gate 0）

## 阶段 2 复核修订（2026-09-17，当前有效）

已按授权完成最小电气修正；本节优先于下方阶段 1 历史记录：

- `edge_sb3_nc` 已串入 `cw_07`，与 SB3 的 `pressed/released` 状态共用；SB3 按下时 NO 闭合、NC 断开。
- `edge_sb2_nc` 已串入 `cw_15`，与 SB2 的 `pressed/released` 状态共用；SB2 按下时 NO 闭合、NC 断开。
- `cw_07`、`cw_15` 不再作为可绕过 NC 的直通 wire；图搜索只通过对应 device edge。
- 正转按住 SB3、反转按住 SB2 均按“原接触器先释放、对向接触器后吸合”收敛，迭代过程中没有双线圈稳定吸合。
- 静态 Geometry 坐标、端口、junction、crossing、线路 path 和元件锚点未改变；静态 Geometry fingerprint：`248befb2c0522e4f72bb9574baa50b0cd3afd195a8a069bd40617e1b28ffb018`。

当前阶段 2 统计：`MATCH=22`，`MISMATCH=3`，`UNCERTAIN=0`，`TOTAL=25`。剩余三项是 FU2 两极的 `FU2_VISUAL_MODEL_MISMATCH` 与历史 `jx_07/xc_03` metadata，不是当前联动逻辑 blocker。旧 TEST 05、09 的“保持原方向”预期已标记失效并更新为教材真实换向预期。

阶段 2 验收证据：`output/playwright/stage2-validation.json`；电气断言 331 项、96 种状态组合、既有 Solver 14/14 均通过。Renderer 只消费 Solver/Visual Binding 状态，未接入 Active Wire Highlight、Current Flow 或 Playback 最终视觉。

下方“阶段 1 复核修订”中的 blocker 和动态 BLOCKED 描述为修正前历史记录，不再代表当前状态。

## 阶段 1 复核修订（2026-09-17，优先于下文初版结论）

初版漏列了教材中两组按钮联动常闭触点，以及 FU2 下极返回支路跨越 L3 竖线的非连接 crossing。因此，下文原来的“所有动态拓扑等价 / TOPOLOGY_BLOCKERS=[]”不能继续作为动态阶段的依据。初版正文保留供追溯。

FU2 结论不变：`FU2_VISUAL_MODEL_MISMATCH`。不以 FU2 为由阻断静态描摹。

本轮按最新指令完成阶段 1 静态图；没有修改 Solver、Action 或 electrical topology。新 SVG 中如实画出两组按钮 NC 及机械联动虚线，但将它们标记为 `unmapped-dynamic`，没有伪造 Solver edge，也没有绑定动态状态。

### 补充证据

指定原图中，上排自锁汇合之后、KI2 电气互锁 NC 之前，还有一组由 SB3 联动的 NC，原图约 `(918..981,348)`。下排自锁汇合之后、KI1 电气互锁 NC 之前，还有一组由 SB2 联动的 NC，原图约 `(918..979,487)`。联动关系由原图虚线明确指向对应按钮，不是两接触器的电气互锁触点。

|补充项|教材路径|现有 Solver 路径|判定|
|---|---|---|---|
|23：SB3 联动 NC|node 3 → SB3 NC → KI2 NC → KI1 coil|node_3 → cw_07 → ki2_interlock_l，无 SB3 NC edge|MISMATCH：真实动态可达关系不同|
|24：SB2 联动 NC|node 4 → SB2 NC → KI1 NC → KI2 coil|node_4 → cw_15 → ki1_interlock_l，无 SB2 NC edge|MISMATCH：真实动态可达关系不同|
|25：FU2 返回支路 / L3 crossing|FU2 下极左端接 L2，经过 L3 时不连接；原图约 `(386,373)`|cw_20 返回 term_v1，不连接 term_w1|MATCH：静态 geometry 已补充该 crossing|

浏览器内可复现的只读检查（访问 `index.html?module=forward-reverse`）：

```js
const forwardHeld = solveControlCircuit(
  { qf1: "closed", sb1: "released", sb2: "released", sb3: "pressed", fr1: "normal" },
  { ki1: true, ki2: false }
);
// 实测：coils={ki1:true,ki2:false}, converged=true。
// 教材：SB3 的 NC 此时断开，KI1 自锁后的公共串联路径必须中断。
const reverseHeld = solveControlCircuit(
  { qf1: "closed", sb1: "released", sb2: "pressed", sb3: "released", fr1: "normal" },
  { ki1: false, ki2: true }
);
// 实测：coils={ki1:false,ki2:true}, converged=true。
// 教材：SB2 的 NC 此时断开，KI2 自锁后的公共串联路径必须中断。
```

完整实测 path items 位于 `output/playwright/stage1-validation.json`，通过 `output/playwright/capture-stage1.cjs` 生成。正转保持路径经过 `cw_05 → edge_ki1_self_no → cw_06 → cw_07 → edge_ki2_interlock_nc → cw_08 → cw_09`；反转保持路径经过 `cw_13 → edge_ki2_self_no → cw_14 → cw_15 → edge_ki1_interlock_nc → cw_16 → cw_17`。它们不会因为对向按钮按下而断开。

更新计数以原第 7 节 22 项加上本节 3 项为唯一计数来源：

```text
MATCH = 20
MISMATCH = 5
UNCERTAIN = 0
TOTAL = 25
FU2 = FU2_VISUAL_MODEL_MISMATCH
TOPOLOGY_BLOCKERS = [SB3_LINKED_NC_MISSING, SB2_LINKED_NC_MISSING]
阶段 1 = 静态截图待人工验收
动态阶段 = BLOCKED，需先获得拓扑差异处理决定及阶段 2 明确授权
```

现有正反转 14/14 测试保持通过，只证明既有行为未回归，不代表新增发现的教材双重联锁行为已覆盖。不得让 Renderer 直接按按钮猜测电机结果，也不得将这两组按钮 NC 当作 FU2 那样永远常导通。

阶段 1 的最终单一坐标系来自指定原图，裁切原点为 `(40,174)`，SVG `viewBox="0 0 1435 610"`。仅绘制电路本体，没有嵌入参考图。新静态图包含 84 个视觉端口、59 条唯一视觉 wire path、20 组元件、14 个明确 T 形 junction、7 个非连接 electrical crossing；机械联动线独立标记，不纳入电气连接。

---

审计范围：`ch02_reverse` / route `forward-reverse`。本文件只记录指定教材原图与正式 `main` 现有 Solver topology 的对照，不引入 Renderer、动画、Current Flow 或新的 circuit data。

## 0. 基线与参考图

- 正式仓库：`https://github.com/traceynahmiasg7r-droid/electrical-control-teaching-platform`
- 正式基线：`main`
- 扫描副本：`C:\Users\75953\Desktop\忆阻器pdf与参考文献包\.formal-main-scan-63eb2726f8234b64b89dedcfe8c08ae6`
- 基线 `HEAD`：`b83883f99b7720dcb01f47ceec179327ea86208f`
- 本地跟踪引用 `origin/main`：`b83883f99b7720dcb01f47ceec179327ea86208f`
- 基线结论：扫描时 `main == origin/main` 且工作树干净。随后仅建立本地分支 `feature/ch02-reverse-renderer-v3`。
- 远端刷新说明：初次正式 clone 已来自 GitHub；本轮 `git pull` 因 Windows Schannel 无可用凭据失败。2026-09-17 再次申请只读远端核验时，自动审批服务返回 503，因此本报告不把未完成的实时刷新声称为成功。
- 未创建提交，未 push，未 merge。

指定教材参考图：

```text
C:\电路截图\屏幕截图 2026-09-14 055320.png
```

|属性|值|
|---|---|
|读取结果|成功|
|原始尺寸|`1489 x 808`|
|文件大小|`166155` bytes|
|SHA-256|`A703FF1CEB6C47A18E229B27579D69DA5DDEF0B4A6072B5AC7109D7B65ABDAB9`|
|本轮真源|上述本地教材图；未用仓库旧 `forward_reverse_source.png` 替代|

建议 Gate 1 使用的有效电路裁切区域（原图像素近似值，正式描摹时再做一次边界验收）：

```text
x=52, y=174, width=1412, height=604
```

该区域覆盖左侧三相主回路、中央控制回路、FR1、M 和最右返回线；排除 PPT 页眉、标题、蓝色边框、右下装饰和无教学意义留白。

## 1. 项目与模块定位

|职责|正式位置|当前事实|
|---|---|---|
|平台入口 / Platform Shell|`index.html`|页面、legacy SVG board、模块注册以及目标模块的 legacy runtime 均在此|
|Module Contract|`src/schemas/module-contract.js`|定义 module meta、Action、State、SolverResult 和 ViewModel 合约|
|Registry|`src/registry/module-registry.js`|按 `moduleId` / `routeId` 注册与解析|
|Module Loader|`src/platform/module-loader/module-loader.js`|创建 scope、加载 Facade module、校验 contract|
|Facade Adapter|`src/platform/module-adapter/facade-module-adapter.js`|将 legacy port 包装为统一 module definition|
|Runtime Scope|`src/platform/runtime/runtime-scope.js`|管理 timer、interval、cleanup 和 AbortSignal|
|Navigation|`src/platform/navigation/chapter-navigation.js`|章节与 route 导航|
|章节模块|`src/chapters/chapter01/**`、`src/chapters/chapter02/**`|各章 module/facade；部分成熟模块已有独立 data/solver/renderer/tests|
|`ch02_reverse`|`src/chapters/chapter02/modules/ch02_reverse/module.js`、`facade.js`|当前只有 module/facade|
|目标 Solver|`index.html`|仍未拆出独立 `solver.js`|
|Playback / Teaching Feedback|`index.html` 和 `facade.js`|已有 displayState、replay steps、feedback 的业务出口|

`ch02_reverse/module.js` 的 meta：

```text
moduleId = ch02_reverse
routeId = forward-reverse
integrationMode = facade-v1
geometryLockId = forward_reverse_geometry_v1_locked
```

注册链路为：

```text
platform.moduleDefinitions.createCh02Reverse({
  circuitData: getLegacyCircuitData("forward-reverse"),
  port: createReverseModulePort()
})
```

目标目录当前没有独立 `circuit.data.js`、`renderer.js`、`solver.js`、`module.meta.json` 或 `tests/`。

## 2. 当前 Solver topology 数据

`index.html` 中与本审计直接相关的数据：

|集合|数量|内容|
|---|---:|---|
|`calibrationPortMap`|71|65 个非 node port + `node_2..node_7` 六个 node|
|`calibrationJunctions`|7|`jx_01..jx_07`|
|`calibrationWires`|50|`mw_01..mw_30` + `cw_01..cw_20`|
|`calibrationCrossings`|1|`xc_03`，声明为 `electrical_junction`|
|`deviceEdgeDefs`|25|QF1、FU1、按钮、接触器、线圈、FR1|

关键 Solver 常量：

```text
CONTROL_SUPPLY_SOURCE_PORT = src_l3
CONTROL_RETURN_SOURCE_PORT = src_l2
MAIN_PHASE_SOURCE_PORTS = { l1: src_l1, l2: src_l2, l3: src_l3 }
MAIN_LOAD_PORTS = { U: load_u_in_pending, V: load_v_in_pending, W: load_w_in_pending }
```

成熟逻辑函数位于 `index.html`：

```text
getDeviceEdgeConductive()
computeDeviceEdgeStates()
buildElectricalGraph()
collectReachableNodes()
findPathItems()
solveControlCircuit()
solveMainCircuit()
recomputeElectricalSolver()
```

`buildElectricalGraph()` 将 wire 端点、明确 junction 坐标和 conductive device edge 组成无向 adjacency。它不会因为两条折线在画面中相交就自动连接。

## 3. 教材主回路逐线审计

教材连接：

```text
L1/L2/L3 -> QF1 -> FU1 -> KI1/KI2 三相主触点
           -> U2/V2/W2 -> FR1 -> U3/V3/W3 -> M
```

|序号|教材逐线连接|当前 Solver 对应路径|判定|
|---:|---|---|---|
|M01|L1 → QF1 → FU1 → U1|`src_l1` → `mw_01` → `qf1_edge_l1` → `mw_02` → `fu1_edge_l1` → `mw_03` → `term_u1`|MATCH|
|M02|L2 → QF1 → FU1 → V1|`src_l2` → `mw_04` → `qf1_edge_l2` → `mw_05` → `fu1_edge_l2` → `mw_06` → `term_v1`|MATCH|
|M03|L3 → QF1 → FU1 → W1|`src_l3` → `mw_07` → `qf1_edge_l3` → `mw_08` → `fu1_edge_l3` → `mw_09` → `term_w1`|MATCH|
|M04|U1 分至 KI1-A 与 KI2-A 输入|`term_u1` / `jx_01` → `mw_10`,`mw_16`|MATCH|
|M05|V1 分至 KI1-B 与 KI2-B 输入|`term_v1` / `jx_02` → `mw_11`,`mw_18`|MATCH|
|M06|W1 分至 KI1-C 与 KI2-C 输入|`term_w1` / `jx_03` → `mw_12`,`mw_20`|MATCH|
|M07|KI1-A 输出 → U2|`edge_ki1_main_a` → `mw_13` → `term_u2`|MATCH|
|M08|KI1-B 输出 → V2|`edge_ki1_main_b` → `mw_14` → `term_v2`|MATCH|
|M09|KI1-C 输出 → W2|`edge_ki1_main_c` → `mw_15` → `term_w2`|MATCH|
|M10|KI2-A 输出 → W2|`edge_ki2_main_a` → `mw_17` → `term_w2`|MATCH|
|M11|KI2-B 输出 → V2|`edge_ki2_main_b` → `mw_19` → `term_v2`|MATCH|
|M12|KI2-C 输出 → U2|`edge_ki2_main_c` → `mw_21` → `term_u2`|MATCH|
|M13|U2 → FR1-U → U3 → M-U|`mw_22` → `edge_fr1_u` → `mw_23` → `mw_24` → `load_u_in_pending`|MATCH|
|M14|V2 → FR1-V → V3 → M-V|`mw_25` → `edge_fr1_v` → `mw_26` → `mw_27` → `load_v_in_pending`|MATCH|
|M15|W2 → FR1-W → W3 → M-W|`mw_28` → `edge_fr1_w` → `mw_29` → `mw_30` → `load_w_in_pending`|MATCH|

教材与 Solver 的换相语义一致：

```text
KI1: U=L1, V=L2, W=L3 -> forward
KI2: U=L3, V=L2, W=L1 -> reverse
```

三相不完整为 `stopped`；三相完整但不是上述两种排列为 `fault`。

## 4. 教材控制回路逐线审计

教材连接：

```text
L3/W1 -> FU2 上极 -> SB1 NC -> 节点 2
节点 2 -> (SB2 NO || KI1 self NO) -> 节点 3 -> KI2 interlock NC -> KI1 coil
节点 2 -> (SB3 NO || KI2 self NO) -> 节点 4 -> KI1 interlock NC -> KI2 coil
两线圈返回 -> 节点 7 -> FR1 NC -> FU2 下极 -> L2/V1
```

|序号|教材逐线连接|当前 Solver 对应路径|判定|
|---:|---|---|---|
|C01|L3/W1 → FU2 上极 → SB1 输入|`term_w1` → `cw_01` → `sb1_l`；FU2 未独立建模|VISUAL/MODELING MISMATCH|
|C02|SB1 NC → 节点 2|`edge_sb1_nc` → `cw_02` → `node_2`|MATCH|
|C03|节点 2 → SB2 NO → 节点 3|`cw_03` → `edge_sb2_no` → `cw_04` → `node_3`|MATCH|
|C04|节点 2 → KI1 self NO → 节点 3|`cw_05` → `edge_ki1_self_no` → `cw_06`|MATCH|
|C05|节点 3 → KI2 interlock NC → 节点 5|`cw_07` → `edge_ki2_interlock_nc` → `cw_08`|MATCH|
|C06|节点 5 → KI1 coil → 节点 7|`cw_09` → `edge_coil_ki1` → `cw_10`|MATCH|
|C07|节点 2 → SB3 NO → 节点 4|`cw_11` → `edge_sb3_no` → `cw_12`|MATCH|
|C08|节点 2 → KI2 self NO → 节点 4|`cw_13` → `edge_ki2_self_no` → `cw_14`|MATCH|
|C09|节点 4 → KI1 interlock NC → 节点 6|`cw_15` → `edge_ki1_interlock_nc` → `cw_16`|MATCH|
|C10|节点 6 → KI2 coil → 节点 7|`cw_17` → `edge_coil_ki2` → `cw_18`|MATCH|
|C11|节点 7 → FR1 NC|`cw_19` → `edge_fr1_nc`|MATCH|
|C12|FR1 NC → FU2 下极 → L2/V1|`fr1_nc_r` → `cw_20` → `term_v1`；FU2 未独立建模|VISUAL/MODELING MISMATCH|

### 4.1 FU2 可复现证据

#### 教材

1. FU2 是两极熔断器。
2. FU2 上极左端接 FU1 后的 L3/W1 节点，上极右端直接进入 SB1 左端。
3. FU2 下极左端接 FU1 后的 L2/V1 节点，下极右端接最下方控制返回线；返回线另一端来自 FR1 NC 右端。
4. FU2 上极之后直接进入 SB1；上极与下极均没有旁路。

#### 当前 Solver

控制 source port：

```text
CONTROL_SUPPLY_SOURCE_PORT = src_l3
```

在 `QF1=closed`、FU1 正常导通时，按 `buildElectricalGraph()`/BFS 实际得到的 source → SB1 输入路径为：

```text
src_l3 (441,204)
  -- mw_07 --> qf1_l3_in (441,238)
  -- qf1_edge_l3 --> qf1_l3_out / fu1_l3_in (452,316)
  -- fu1_edge_l3 --> fu1_l3_out (452,383)
  -- mw_09 --> term_w1 / jx_03 (451,443)
  -- cw_01 --> sb1_l (583,451)
```

端口 `qf1_l3_out` 与 `fu1_l3_in` 共坐标；`mw_08` 是零长度 self-loop，所以 BFS 路径无需经过该 item。这是当前 graph 的端口折叠方式，不是 FU2 旁路。

控制 return port：

```text
CONTROL_RETURN_SOURCE_PORT = src_l2
```

FR1 NC 右端 → return source 的实际路径为：

```text
fr1_nc_r (1412,553)
  -- cw_20 --> term_v1 / jx_02 (389,477)
  -- mw_06 --> fu1_l2_out (393,383)
  -- fu1_edge_l2 --> fu1_l2_in / qf1_l2_out (393,316)
  -- qf1_edge_l2 --> qf1_l2_in (382,238)
  -- mw_04 --> src_l2 (382,202)
```

端口 `fu1_l2_in` 与 `qf1_l2_out` 共坐标；`mw_05` 同样是零长度 self-loop。

旁路与 reachability 检查结果：

```text
移除 cw_01：src_l3 -> sb1_l = UNREACHABLE
移除 cw_20：fr1_nc_r -> src_l2 = UNREACHABLE
```

因此：

- source 到 SB1 没有绕过 FU2 所在串联位置的额外可达路径。
- FR1 NC 到 return source 没有绕过 FU2 下极的额外可达路径。
- 当前功能范围没有 FU2 `blown/open` state。
- 在 `normal/conductive` 假设下，把 `cw_01` 和 `cw_20` 各细分并插入一个始终 conductive 的 FU2 edge，不改变任何 reachability。

**FU2 最终结论：`FU2_VISUAL_MODEL_MISMATCH`。**

这不是 `FU2_TRUE_TOPOLOGY_MISMATCH`。Gate 1 可在新 visual geometry 中补画 FU2 两极和端子，并映射到 `cw_01`/`cw_20` 的等效连续路径；本 Gate 不修改 Solver。

## 5. referenceJunctions[]

下面的 `position` 是原图中的相对位置描述；`visualLines` 是应在新单一 SVG 中汇合的视觉线路；`currentMapping` 是当前 Solver 对应节点。

```js
[
  {
    id: "rj_l1_after_fu1",
    position: "左侧主回路，FU1-L1 下方",
    electricalNode: "L1/U1 after FU1",
    visualLines: ["FU1-L1-out", "KI1-A-in", "KI2-A-in"],
    currentMapping: { port: "term_u1", junction: "jx_01", wires: ["mw_03", "mw_10", "mw_16"] },
    evidence: "明确 T 形分支",
    status: "MATCH"
  },
  {
    id: "rj_l2_after_fu1",
    position: "左侧主回路，FU1-L2 下方并向 FU2 下极分支",
    electricalNode: "L2/V1 after FU1",
    visualLines: ["FU1-L2-out", "KI1-B-in", "KI2-B-in", "FU2-lower-in"],
    currentMapping: { port: "term_v1", junction: "jx_02", wires: ["mw_06", "mw_11", "mw_18", "cw_20"] },
    evidence: "明确 T 形/共节点；FU2 下极由 cw_20 等效",
    status: "MATCH"
  },
  {
    id: "rj_l3_after_fu1",
    position: "左侧主回路，FU1-L3 下方并向 FU2 上极分支",
    electricalNode: "L3/W1 after FU1",
    visualLines: ["FU1-L3-out", "KI1-C-in", "KI2-C-in", "FU2-upper-in"],
    currentMapping: { port: "term_w1", junction: "jx_03", wires: ["mw_09", "mw_12", "mw_20", "cw_01"] },
    evidence: "明确 T 形/共节点；FU2 上极由 cw_01 等效",
    status: "MATCH"
  },
  {
    id: "rj_u2",
    position: "换相触点下方，FR1-U 输入前",
    electricalNode: "U2",
    visualLines: ["KI1-A-out", "KI2-C-out", "FR1-U-in"],
    currentMapping: { port: "term_u2", junction: "jx_04", wires: ["mw_13", "mw_21", "mw_22"] },
    evidence: "两接触器输出在 U2 明确汇合",
    status: "MATCH"
  },
  {
    id: "rj_v2",
    position: "换相触点下方，FR1-V 输入前",
    electricalNode: "V2",
    visualLines: ["KI1-B-out", "KI2-B-out", "FR1-V-in"],
    currentMapping: { port: "term_v2", junction: "jx_05", wires: ["mw_14", "mw_19", "mw_25"] },
    evidence: "两接触器输出在 V2 明确汇合",
    status: "MATCH"
  },
  {
    id: "rj_w2",
    position: "换相触点下方，FR1-W 输入前",
    electricalNode: "W2",
    visualLines: ["KI1-C-out", "KI2-A-out", "FR1-W-in"],
    currentMapping: { port: "term_w2", junction: "jx_06", wires: ["mw_15", "mw_17", "mw_28"] },
    evidence: "两接触器输出在 W2 明确汇合",
    status: "MATCH"
  },
  {
    id: "rj_control_node_2",
    position: "SB1 后的左侧控制母线",
    electricalNode: "node 2",
    visualLines: ["SB1-out", "SB2-in", "KI1-self-in", "SB3-in", "KI2-self-in"],
    currentMapping: { port: "node_2", wires: ["cw_02", "cw_03", "cw_05", "cw_11", "cw_13"] },
    evidence: "连续竖母线上的多个明确 T 形分支",
    status: "MATCH"
  },
  {
    id: "rj_control_node_3",
    position: "SB2 与 KI1 自锁并联支路右侧",
    electricalNode: "node 3",
    visualLines: ["SB2-out", "KI1-self-out", "KI2-interlock-in"],
    currentMapping: { port: "node_3", wires: ["cw_04", "cw_06", "cw_07"] },
    evidence: "两支路汇合后进入 KI2 NC",
    status: "MATCH"
  },
  {
    id: "rj_control_node_4",
    position: "SB3 与 KI2 自锁并联支路右侧",
    electricalNode: "node 4",
    visualLines: ["SB3-out", "KI2-self-out", "KI1-interlock-in"],
    currentMapping: { port: "node_4", wires: ["cw_12", "cw_14", "cw_15"] },
    evidence: "两支路汇合后进入 KI1 NC",
    status: "MATCH"
  },
  {
    id: "rj_control_node_5",
    position: "KI2 互锁 NC 与 KI1 线圈之间",
    electricalNode: "node 5",
    visualLines: ["KI2-interlock-out", "KI1-coil-in"],
    currentMapping: { port: "node_5", wires: ["cw_08", "cw_09"] },
    evidence: "明确串联节点",
    status: "MATCH"
  },
  {
    id: "rj_control_node_6",
    position: "KI1 互锁 NC 与 KI2 线圈之间",
    electricalNode: "node 6",
    visualLines: ["KI1-interlock-out", "KI2-coil-in"],
    currentMapping: { port: "node_6", wires: ["cw_16", "cw_17"] },
    evidence: "明确串联节点",
    status: "MATCH"
  },
  {
    id: "rj_control_node_7",
    position: "两线圈右端与 FR1 NC 左端之间",
    electricalNode: "node 7",
    visualLines: ["KI1-coil-out", "KI2-coil-out", "FR1-NC-in"],
    currentMapping: { port: "node_7", wires: ["cw_10", "cw_18", "cw_19"] },
    evidence: "两线圈返回明确汇合后进入 FR1 NC",
    status: "MATCH"
  }
]
```

教材图没有用黑点标出所有节点，但上述位置均是线端落到母线、T 形分支或器件串联端点，不依赖“视觉相交即连接”的推断。

## 6. referenceCrossings[]

换相区存在六个视觉交叉，原图无黑点、无端点落线、无 T 形分支，均不得电气连接：

```js
[
  {
    id: "rc_source_l2_over_l1",
    position: "KI2 输入换相区",
    lineA: "L2/V1 -> KI2-B-in",
    lineB: "L1/U1 vertical feeder",
    electricallyConnected: false,
    evidence: "视觉交叉，无黑点/T 形"
  },
  {
    id: "rc_source_l3_over_l1",
    position: "KI2 输入换相区",
    lineA: "L3/W1 -> KI2-C-in",
    lineB: "L1/U1 vertical feeder",
    electricallyConnected: false,
    evidence: "视觉交叉，无黑点/T 形"
  },
  {
    id: "rc_source_l3_over_l2",
    position: "KI2 输入换相区",
    lineA: "L3/W1 -> KI2-C-in",
    lineB: "L2/V1 vertical feeder",
    electricallyConnected: false,
    evidence: "视觉交叉，无黑点/T 形"
  },
  {
    id: "rc_output_v2_over_u2",
    position: "KI2 输出换相区",
    lineA: "KI2-B-out -> V2",
    lineB: "KI1-A-out -> U2 vertical",
    electricallyConnected: false,
    evidence: "只在 V2 端点汇合；经过 U2 竖线时无连接标记"
  },
  {
    id: "rc_output_w2_over_u2",
    position: "KI2 输出换相区",
    lineA: "KI2-A-out -> W2",
    lineB: "KI1-A-out -> U2 vertical",
    electricallyConnected: false,
    evidence: "只在 W2 端点汇合；经过 U2 竖线时无连接标记"
  },
  {
    id: "rc_output_w2_over_v2",
    position: "KI2 输出换相区",
    lineA: "KI2-A-out -> W2",
    lineB: "KI1-B-out -> V2 vertical",
    electricallyConnected: false,
    evidence: "只在 W2 端点汇合；经过 V2 竖线时无连接标记"
  }
]
```

控制区的红/黑虚线是机械联锁说明线，不是 electrical wire，故不列入 `referenceCrossings[]`。

当前 legacy metadata 另有问题：`jx_07` 与 `xc_03` 均声称 `(267,758)` 连接 `mw_17` 和 `mw_21`，但 `mw_17` 的 route 位于 `y=827`，根本不经过该坐标。该声明对 `buildElectricalGraph()` 实际不可生效，未改变 reachability；它属于 **legacy visual metadata mismatch**，Gate 1 不得继承。

## 7. 教材 Topology → 当前 Solver 映射

该表是 MATCH/MISMATCH/UNCERTAIN 统计的唯一计数来源；前面的逐线表、junction 和 crossing 清单是证据，不重复计数。

|#|教材元素|教材连接|当前 port|当前 wire|当前 deviceEdge|判定|
|---:|---|---|---|---|---|---|
|1|QF1 三极|L1/L2/L3 串联总开关|`qf1_l*_in/out`|`mw_01,02,04,05,07,08`|`qf1_edge_l1/l2/l3`|MATCH|
|2|FU1 三极|QF1 后三相串联熔断|`fu1_l*_in/out`|`mw_02,03,05,06,08,09`|`fu1_edge_l1/l2/l3`|MATCH|
|3|FU2 上极|L3/W1 到 SB1 串联熔断|等效端点 `term_w1`,`sb1_l`|`cw_01`|无显式 edge|MISMATCH: `FU2_VISUAL_MODEL_MISMATCH`|
|4|FU2 下极|FR1 NC 返回到 L2/V1 串联熔断|等效端点 `fr1_nc_r`,`term_v1`|`cw_20`|无显式 edge|MISMATCH: `FU2_VISUAL_MODEL_MISMATCH`|
|5|SB1 NC|控制公共停止|`sb1_l/r`|`cw_01,02`|`edge_sb1_nc`|MATCH|
|6|SB2 NO|正转启动支路|`sb2_l/r`|`cw_03,04`|`edge_sb2_no`|MATCH|
|7|SB3 NO|反转启动支路|`sb3_l/r`|`cw_11,12`|`edge_sb3_no`|MATCH|
|8|KI1 main|U1/V1/W1 直通 U2/V2/W2|`ki1_main_*_in/out`|`mw_10..15`|`edge_ki1_main_a/b/c`|MATCH|
|9|KI2 main|U1/V1/W1 换相到 W2/V2/U2|`ki2_main_*_in/out`|`mw_16..21`|`edge_ki2_main_a/b/c`|MATCH|
|10|KI1 self NO|节点 2 与节点 3 间并联自锁|`ki1_self_l/r`|`cw_05,06`|`edge_ki1_self_no`|MATCH|
|11|KI2 self NO|节点 2 与节点 4 间并联自锁|`ki2_self_l/r`|`cw_13,14`|`edge_ki2_self_no`|MATCH|
|12|KI1 interlock NC|KI2 coil 前电气互锁|`ki1_interlock_l/r`|`cw_15,16`|`edge_ki1_interlock_nc`|MATCH|
|13|KI2 interlock NC|KI1 coil 前电气互锁|`ki2_interlock_l/r`|`cw_07,08`|`edge_ki2_interlock_nc`|MATCH|
|14|KI1 coil|正转支路线圈|`coil_ki1_l/r`|`cw_09,10`|`edge_coil_ki1`|MATCH|
|15|KI2 coil|反转支路线圈|`coil_ki2_l/r`|`cw_17,18`|`edge_coil_ki2`|MATCH|
|16|FR1 main|U2/V2/W2 串联热元件至 U3/V3/W3|`fr1_u/v/w_in/out`|`mw_22,23,25,26,28,29`|`edge_fr1_u/v/w`|MATCH|
|17|FR1 NC|节点 7 至控制返回串联保护|`fr1_nc_l/r`|`cw_19,20`|`edge_fr1_nc`|MATCH|
|18|M|U3/V3/W3 三相输入|`load_u/v/w_in_pending`|`mw_24,27,30`|由 `MAIN_LOAD_PORTS` 求相序|MATCH|
|19|正转 U/V/W|U=L1,V=L2,W=L3|三个 load ports|KI1 主路径 wires|KI1 main + FR1 edges|MATCH|
|20|反转 U/V/W|U=L3,V=L2,W=L1|三个 load ports|KI2 换相路径 wires|KI2 main + FR1 edges|MATCH|
|21|控制返回|两线圈 → node 7 → FR1 NC → FU2 下极 → L2/V1|`node_7`,`fr1_nc_l/r`,`term_v1`,`src_l2`|`cw_10,18,19,20` + L2 supply path|`edge_fr1_nc`,`fu1_edge_l2`,`qf1_edge_l2`|MATCH|
|22|legacy `jx_07/xc_03`|教材换相交叉应按原图分别判定，不存在该坐标上的 `mw_17/mw_21` junction|无有效共同端口|metadata 声称 `mw_17,mw_21`，但 `mw_17` 不经过 `(267,758)`|无|MISMATCH: legacy visual metadata，不影响 graph|

完整统计：

```text
MATCH     = 19
MISMATCH  = 3
UNCERTAIN = 0
TOTAL     = 22
```

三个 MISMATCH 均为非阻断视觉/建模问题：FU2 上极、FU2 下极、失效的旧 `jx_07/xc_03` metadata。没有发现真实 reachability 或相序差异。

## 8. TOPOLOGY_BLOCKERS

```text
TOPOLOGY_BLOCKERS = []
```

未发现以下任何真实拓扑错误：

- 控制电源接错相；
- FU2 前后本应不同的节点被错误短接；
- 绕过 FU2 串联位置的旁路；
- KI1/KI2 换相关系错误；
- U/V/W 相序错误；
- FR1 主回路或 NC 返回接错；
- SB1/SB2/SB3、自锁、互锁或线圈 reachability 错误。

## 9. 可复用状态与业务逻辑

Solver 稳定输出：

```text
stableControlState.ki1 / ki2
edgeStates
activeControlWireIds
activeMainWireIds
activeControlEdgeIds
activeMainEdgeIds
activeMainWirePhaseMap
motorPhases
motorState
converged
iterationCount
lastAction
```

`ch02_reverse/facade.js::normalizeSolverResult()` 已导出 active wire IDs、edge IDs、phase map 和 motor state。正常运行可使用实时 Solver snapshot；Replay 应优先使用 `state.currentFlow.lastReplayDescriptor.steps[*].displayState`。

Playback / Teaching Feedback 可复用入口：

```text
buildDisplayStateFromSnapshot()
createReplayStep()
startCurrentFlowReplay()
getReplayStepEntries()
createReverseModulePort().getReplaySteps()
createReverseModulePort().getFeedback()
facade.buildReplaySteps()
facade.buildTeachingFeedback()
renderFacadeTeachingFeedback()
```

Renderer 后续只能消费 Solver/Replay DisplayState，不得根据“按了哪个按钮”自行推断接触器、相序或 active wires。

## 10. 成熟逻辑与旧视觉边界

应保留并冻结其电气语义：

- `getDeviceEdgeConductive()`；
- `computeDeviceEdgeStates()`；
- `buildElectricalGraph()`、reachability 与 path finding；
- control iteration、自锁、互锁、FR1 overload；
- `solveControlCircuit()`、`solveMainCircuit()`、motor phase sequence；
- Facade、Action、Module Contract、Registry、Loader、Runtime Scope、Platform Shell；
- Playback / Teaching Feedback 业务逻辑。

可在后续 Gate 从零重构的旧视觉：

- `calibrationPortMap` 的旧坐标；
- `calibrationComponentBBoxes`；
- `calibrationWires.routePoints` 的旧几何；
- `calibrationJunctions` / `calibrationCrossings` 的旧视觉 metadata；
- `create*` legacy SVG component factory；
- `renderCalibrationWireLayer()`、`renderCurrentFlowLayer()`；
- legacy viewport fit、reference overlay、calibration UI。

注意：当前 `calibrationWires` 和 junction keys 参与 `buildElectricalGraph()`。Gate 1 不能直接替换这些旧结构；新 visual geometry 必须通过稳定 electrical IDs 做只读映射。

## 11. Gate 0 结论

```text
FU2 conclusion   = FU2_VISUAL_MODEL_MISMATCH
TOPOLOGY_BLOCKERS = []
Gate 0            = PROCEED
Gate 1 recommendation = PROCEED
```

进入 Gate 1 的约束：

1. 从指定教材图重新描摹，不换算或继承旧 calibration 坐标。
2. FU2 画成两极、静态、常导通保护元件，并保留视觉端子。
3. FU2 上/下极分别映射到 `cw_01`/`cw_20` 的现有等效 electrical path。
4. 不继承 `jx_07/xc_03`；六个换相 crossing 必须按本报告保持 `electricallyConnected:false`。
5. 不修改 Solver、`index.html` 或现有 Electrical Topology，除非后续有单独批准的集成任务。

本轮到此停止。未创建 `circuit.data.js`、Renderer、动画、Current Flow 或测试文件；未修改 Solver、`index.html` 或其它项目文件。
