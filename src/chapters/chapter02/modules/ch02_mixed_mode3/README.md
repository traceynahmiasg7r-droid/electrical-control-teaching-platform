# ch02_mixed_mode3

原图14的优化交互模块。差异点是中间继电器 K 专门承担长动记忆，KM1 只承担电机执行；SB3 点动会先解除 K 的记忆，再直接驱动 KM1。

模块只依赖同一提交中的 `_ch02_mixed_remote_shared/runtime.js`，未修改第二章已有四个成熟模块或公共平台文件。
