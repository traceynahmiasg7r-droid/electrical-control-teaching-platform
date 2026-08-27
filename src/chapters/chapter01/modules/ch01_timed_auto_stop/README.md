# ch01_timed_auto_stop

第一章独立增量模块：电机启动后定时自动停止。按规范将 120 秒时序压缩为每次“推进 30 秒”的可检查教学步骤；不会修改公共平台或其他章节模块。

- 路由：`timed-auto-stop`
- 参考图：`assets/reference/timed-auto-stop.jpg`
- 操作：QF1 合/分闸、SB1 启动、推进 30 秒、人工停止
- 关键因果：KM1 自锁 → KT1/KT2 计时 → KT2 延时 NC 到时断开 → 电机停止
