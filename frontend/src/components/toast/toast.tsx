import { component$ } from '@qwik.dev/core'
import styles from './toast.module.css'

interface ToastProps {
  msg: string
  kind: 'ok' | 'err'
}

export const Toast = component$<ToastProps>(({ msg, kind }) => {
  return (
    <div
      class={['mono', styles.toast].join(' ')}
      role={kind === 'err' ? 'alert' : 'status'}
      data-kind={kind}
    >
      <span class="dot" data-state={kind === 'ok' ? 'up' : 'down'}></span>
      <span class={styles.text}>{msg}</span>
    </div>
  )
})
