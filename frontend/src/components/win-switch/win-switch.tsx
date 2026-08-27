import type { Signal } from '@qwik.dev/core'
import { component$ } from '@qwik.dev/core'
import styles from './win-switch.module.css'

interface WinSwitchProps {
  /** 当前时间窗(受控) */
  win: Signal<'24h' | '7d'>
}

/** 24h / 7d 切换:Swiss Segmented Switch */
export const WinSwitch = component$<WinSwitchProps>(({ win }) => {
  return (
    <div class={styles.winSwitch} role="radiogroup" aria-label="时间窗口">
      {(['24h', '7d'] as const).map((w) => (
        <button
          type="button"
          key={w}
          class={['mono', styles.opt, win.value === w && styles.isActive]
            .filter(Boolean)
            .join(' ')}
          role="radio"
          aria-checked={win.value === w}
          onClick$={() => (win.value = w)}
        >
          {w}
        </button>
      ))}
    </div>
  )
})
