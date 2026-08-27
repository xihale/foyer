// @qwik.dev/core beta 的公开类型入口暂未导出 PropFunction;其定义即 QRL 别名。
// 待上游补回后可直接改为从 '@qwik.dev/core' 导入。
import type { QRL } from '@qwik.dev/core'

/** 以 $ 结尾的回调 prop 类型(可序列化函数) */
export type PropFunction<T> = QRL<T>
