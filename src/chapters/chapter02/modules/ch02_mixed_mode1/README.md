# ch02_mixed_mode1

原图12的优化交互模块。差异点是 `SA` 只控制 KM1 自锁支路：点动模式下 SB1 松开即停，长动模式下 KM1 辅助常开保持线圈通路。UI 不直接设置 KM1 或电机状态。

模块只依赖同一提交中的 `_ch02_mixed_remote_shared/runtime.js`，未修改第二章已有四个成熟模块或公共平台文件。
