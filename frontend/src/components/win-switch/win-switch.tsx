import type { Signal } from '@qwik.dev/core'
import { component$ } from '@qwik.dev/core'
import styles from './win-switch.module.css'

interface WinSwitchProps {
  /** 当前时间窗(受控) */
  win: Signal<'24h' | '7d'>
}

const labels = { '24h': '24 小时', '7d': '7 天' } as const

export const WinSwitch = component$<WinSwitchProps>(({ win }) => {
  return (
    <div class={styles.winSwitch} data-win={win.value} role="radiogroup" aria-label="时间窗口">
      <span class={styles.thumb} aria-hidden="true"></span>
      {(['24h', '7d'] as const).map((w) => (
        <button
          type="button"
          key={w}
          class={[styles.opt, win.value === w && styles.isActive].filter(Boolean).join(' ')}
          role="radio"
          aria-checked={win.value === w}
          onClick$={() => (win.value = w)}
        >
          {labels[w]}
        </button>
      ))}
    </div>
  )
})
