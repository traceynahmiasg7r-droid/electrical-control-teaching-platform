# 第二章混合/多地点控制模块私有共享运行层

本目录只服务于同一开发者提交的 `ch02_mixed_mode1`、`ch02_mixed_mode2`、`ch02_mixed_mode3` 和 `ch02_multi_station` 四个模块，用于避免在四个模块内复制 Solver、SVG 渲染和验收逻辑。

- 不属于 `src/components/` 公共元件库，不改变公共元件标准。
- 不向 `window` 写入模块状态；只在 `ECTPPlatform.mixedRemoteShared` 暴露无状态工厂。
- 所有运行状态均由每个 Facade 实例私有持有，`unmount()` 后恢复原实验容器显示状态。
- HL1/HL2 仅作为 Solver 结果的派生显示，未假装形成公共 `indicator` 行为标准。
