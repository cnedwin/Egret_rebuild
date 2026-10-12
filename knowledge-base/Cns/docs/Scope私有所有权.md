# Scope 私有所有权

工程预览 **0.35.0** 保留 Scope 公共 API，将四个内部成员 values、controller、onClosed、validateAcceptance 改为 JavaScript 私有字段／方法。仍允许添加同名属性，但这些属性不再影响相应内部路径。

Scope 登记继续去重单一所有者，保留所有者与 Engine 归属，并先取消、再按获取顺序的逆序清理资源。清理失败继续保留诊断及迟到清理错误。关闭后的 Scope 继续退出真实 Engine 的关闭跟踪。原公共 signal 仍为取消信号。不增加导出、工厂、依赖、宿主访问或 DOM／Node 全局。

独立编写的公共测试使用构建后的 `@egret/engine`。Scope 未修改时，普通基线通过，六项正确性测试得到 **1 项通过／5 项指定失败**。修复后通过 **6/6**；保留的生命周期测试通过 **183/183**，构建、严格类型及生产边界检查通过。五项实际观察的 TS2740 到 TS2739 变化仅更新诊断标记和精确表；fixture 指令与严格匹配规则不变。仅源码的独立规范及实现评审均无开放问题。见[验证记录](../../evidence/scope-private-ownership-verification.json)，SHA-256 `efef7669f7b525de922f52d6d57f5fd31daff73b7566909368ba728a6df0fe6c`。

跟踪 fixture 观察当前 Engine 在关闭后动态调用公共 dispose 的行为；该调用路径变化时须重新绑定测试。本次结果仅覆盖四个显式同名属性案例。任意公共方法覆盖、全部 Engine／controller 内部成员、原型篡改、安全隔离、实际 GC 和设备性能均不在结果范围内。Spine 动画／渲染与完整 **R020/V020** 仍未完成。本元数据截止点的最终完整公开检查、Git 推送和远端交付为 **PENDING**。
