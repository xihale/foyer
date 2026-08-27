import { $, component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import styles from './row-actions.module.css'

interface RowActionsProps {
  onEdit$: PropFunction<() => void>
  onDelete$: PropFunction<() => void>
}

/** 编辑 + 两步删除:第一次点击进入确认态(3s 未确认自动复位),再次点击执行 */
export const RowActions = component$<RowActionsProps>(({ onEdit$, onDelete$ }) => {
  const armed = useSignal(false)
  // 计时器句柄存进 signal:$() 闭包序列化后仍能取到最新值
  const timer = useSignal<number | null>(null)

  const clickDelete = $(() => {
    if (armed.value) {
      armed.value = false
      if (timer.value !== null) clearTimeout(timer.value)
      void onDelete$()
    } else {
      armed.value = true
      if (timer.value !== null) clearTimeout(timer.value)
      timer.value = window.setTimeout(() => (armed.value = false), 3000)
    }
  })

  return (
    <div class={styles.actionGroup}>
      <button type="button" class={styles.actionBtn} onClick$={() => onEdit$()}>
        编辑
      </button>
      <span class={styles.sep} aria-hidden="true"></span>
      {armed.value ? (
        <button type="button" class={[styles.actionBtn, styles.confirm].join(' ')} onClick$={() => clickDelete()}>
          确认删除
        </button>
      ) : (
        <button type="button" class={[styles.actionBtn, styles.danger].join(' ')} onClick$={() => clickDelete()}>
          删除
        </button>
      )}
    </div>
  )
})
